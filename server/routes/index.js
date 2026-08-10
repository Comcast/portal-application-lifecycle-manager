/*
 * Copyright 2026 Comcast Cable Communications Management, LLC
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @module routes/index
 * @description Express router for Portal Application Lifecycle Manager server API endpoints including config management, content promotion, and cloning.
 * @exports router
 */

const express = require('express');
const logger = require('../common/logger');
const { authenticateArcGISToken } = require('../middleware/auth');
const router = express.Router();
const fs = require("node:fs");
const path = require('node:path');
const { execFile } = require('node:child_process');

// Security constants
const CONFIG_FILE_PATH = path.resolve('./config/env-config.json');
const MAX_CONFIG_SIZE = 1024 * 1024; // 1MB limit for config file
// ReDoS-safe: strict length limit and non-overlapping character class
const MAX_KEY_LENGTH = 200;
const ALLOWED_CONFIG_KEYS = /^[a-zA-Z0-9\s\-_.()[\]{}]{1,200}$/;

/**
 * @swagger
 * /:
 *  get:
 *    summary: Welcome page
 *    description: Returns a welcome message for the Portal Application Lifecycle Manager API
 *    tags:
 *      - General
 *    responses:
 *      200:
 *        description: Welcome message
 *        content:
 *          text/html:
 *            schema:
 *              type: string
 *              example: '<h1>Welcome to Portal Application Lifecycle Manager</h1>'
 */
router.get('/', (req, res) => {
    res.status(200).send('<h1>Welcome to Portal Application Lifecycle Manager</h1>');
})

const validateParams = (requiredFields) => {
    return (req, res, next) => {
        const missingFields = requiredFields.filter(field => {
            const value = req.body[field];
            return value === undefined || value === null || 
                   (typeof value === 'string' && value.trim() === '');
        });
        
        if (missingFields.length > 0) {
            logger.warning(`Missing required fields: ${missingFields.join(', ')}`, {
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                url: req.url
            });
            return res.status(400).json({
                error: `Missing required parameters: ${missingFields.join(', ')}`,
                timestamp: new Date().toISOString()
            });
        }
        next();
    };
};

// Enhanced validation functions
const validateUrl = (url) => {
    try {
        const urlObj = new URL(url);
        // Only allow https URLs for security (P2 fix)
        if (urlObj.protocol !== 'https:') {
            return false;
        }
        // Check for reasonable hostname (prevent localhost/internal IPs in production)
        if (process.env.NODE_ENV === 'production') {
            if (urlObj.hostname === 'localhost' || 
                urlObj.hostname.startsWith('127.') ||
                urlObj.hostname.startsWith('192.168.') ||
                urlObj.hostname.startsWith('10.') ||
                /^172\.(1[6-9]|2\d|3[0-1])\./.test(urlObj.hostname)) {
                return false;
            }
        }
        return true;
    } catch (error) {
        logger.warning('Invalid URL validation failed', { error: error.message });
        return false;
    }
};

const validateItemId = (itemId) => {
    // More restrictive validation - only allow alphanumeric and limited length
    const pattern = /^[a-zA-Z0-9]{16,32}$/;
    return pattern.test(itemId) && String(itemId).length <= 50;
};

const validateCloneOrUpdateRequest = (req, res, sourceEnv, targetEnv, sourceId, targetId, isClone = false) => {
    if (!sourceEnv || !targetEnv || !sourceId) {
        const params = isClone ? 'sourceEnv, targetEnv, itemId' : 'sourceEnv, targetEnv, sourceId, targetId';
        logger.warning(`Missing required parameters in ${isClone ? 'cloneContent' : 'updateContent'}`, { ip: req.ip });
        return res.status(400).json({
            error: `Missing required parameters: ${params}`,
            timestamp: new Date().toISOString()
        });
    }
    
    if (!validateUrl(sourceEnv)) {
        logger.warning(`Invalid sourceEnv URL: ${sourceEnv}`, { ip: req.ip });
        return res.status(400).json({
            error: 'sourceEnv must be a valid HTTPS URL',
            timestamp: new Date().toISOString()
        });
    }
    
    if (!validateUrl(targetEnv)) {
        logger.warning(`Invalid targetEnv URL: ${targetEnv}`, { ip: req.ip });
        return res.status(400).json({
            error: 'targetEnv must be a valid HTTPS URL',
            timestamp: new Date().toISOString()
        });
    }

    if (!validateItemId(sourceId)) {
        logger.warning(`Invalid sourceId format: ${sourceId}`, { ip: req.ip });
        return res.status(400).json({
            error: 'sourceId must be 16-32 alphanumeric characters',
            timestamp: new Date().toISOString()
        });
    }

    if (!isClone && targetId && !validateItemId(targetId)) {
        logger.warning(`Invalid targetId format: ${targetId}`, { ip: req.ip });
        return res.status(400).json({
            error: 'targetId must be 16-32 alphanumeric characters',
            timestamp: new Date().toISOString()
        });
    }

    if (sourceEnv === targetEnv && (isClone || sourceId === targetId)) {
        logger.warning("Attempt to clone/update to same environment", { ip: req.ip });
        return res.status(400).json({
            error: isClone ? 'Source and target environments must be different' : 'Cannot update an item to itself',
            timestamp: new Date().toISOString()
        });
    }

    return null;
};

/**
 * @swagger
 * /getConfig:
 *  get:
 *    summary: Get environment configuration
 *    description: Returns the current environment configuration file containing all environment mappings and settings
 *    tags:
 *      - Config
 *    responses:
 *      200:
 *        description: Successfully fetched the configuration file
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              additionalProperties: true
 *              example:
 *                "GIS Tools Portal":
 *                  type: "url"
 *                  description: "GIS Tools Portal"
 *                  Production: "gistools.example.com"
 *                  Staging: "gistoolss.example.com"
 *                  Development: "gistoolsd.example.com"
 *                  key: "GIS Tools Portal"
 *      500:
 *        description: Failed to read configuration file
 *        content:
 *          text/plain:
 *            schema:
 *              type: string
 *              example: "Failed to read config file"
 */
router.get('/getConfig', authenticateArcGISToken, (req, res) => {
    // Log authenticated access
    logger.info('Config access', {
        user: req.arcgisUser.username,
        portal: req.arcgisUser.portal
    });
    
    // Validate file path to prevent directory traversal
    if (!path.resolve(CONFIG_FILE_PATH).startsWith(path.resolve('./config'))) {
        logger.warning('Potential directory traversal attempt in getConfig', {
            user: req.arcgisUser.username
        });
        return res.status(403).send('Access denied');
    }

    fs.readFile(CONFIG_FILE_PATH, "utf8", (err, jsonString) => {
        if (err) {
          logger.error("File read failed:", {
              error: err.message,
              code: err.code,
              path: CONFIG_FILE_PATH
          });
          res.status(500).send('Failed to read config file');
          return
        }
        
        try {
            // Validate JSON structure before sending
            JSON.parse(jsonString);
            res.status(200).json(JSON.parse(jsonString));
        } catch (parseError) {
            logger.error('Invalid JSON in config file:', parseError.message);
            res.status(500).send('Config file contains invalid JSON');
        }
    });
})

/**
 * @swagger
 * /updateConfig:
 *  post:
 *    summary: Update environment configuration
 *    description: Updates the environment configuration file with new settings and environment mappings
 *    requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            additionalProperties: true
 *            description: Complete configuration object with environment mappings
 *            example:
 *              "GIS Tools Portal":
 *                type: "url"
 *                description: "GIS Tools Portal"
 *                Production: "gistools.example.com"
 *                Staging: "gistoolss.example.com"
 *                Development: "gistoolsd.example.com"
 *                key: "GIS Tools Portal"
 *    tags:
 *      - Config
 *    responses:
 *      200:
 *        description: Configuration file updated successfully
 *        content:
 *          text/plain:
 *            schema:
 *              type: string
 *              example: "Config file updated successfully"
 *      500:
 *        description: Failed to update configuration file
 *        content:
 *          text/plain:
 *            schema:
 *              type: string
 *              example: "Failed to update config file"
 */
router.post('/updateConfig', authenticateArcGISToken, (req, res) => {
    // Log who is updating the configuration
    logger.info('Config update initiated', {
        user: req.arcgisUser.username,
        email: req.arcgisUser.email,
        portal: req.arcgisUser.portal
    });
    
    // Validate request body exists and is an object
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        logger.warning('Invalid config data provided to updateConfig', {
            user: req.arcgisUser.username
        });
        return res.status(400).send('Config data must be a valid object');
    }

    // Check config size limit
    const configString = JSON.stringify(req.body, null, 2);
    if (configString.length > MAX_CONFIG_SIZE) {
        logger.warning(`Config file too large: ${configString.length} bytes`);
        return res.status(400).send('Config file exceeds maximum size limit');
    }

    // Validate all keys are safe (no special characters that could be dangerous)
    // Also check length before regex test to prevent ReDoS
    const hasUnsafeKeys = Object.keys(req.body).some(key => 
        key.length > MAX_KEY_LENGTH || !ALLOWED_CONFIG_KEYS.test(key)
    );
    if (hasUnsafeKeys) {
        const unsafeKeys = Object.keys(req.body).filter(key => 
            key.length > MAX_KEY_LENGTH || !ALLOWED_CONFIG_KEYS.test(key)
        );
        logger.warning('Config contains unsafe keys', { unsafeKeys });
        return res.status(400).contentType('text/plain').send('Config contains invalid key names, ' + unsafeKeys.join(', '));
    }

    // Validate file path to prevent directory traversal  
    if (!path.resolve(CONFIG_FILE_PATH).startsWith(path.resolve('./config'))) {
        logger.warning('Potential directory traversal attempt in updateConfig');
        return res.status(403).send('Access denied');
    }

    logger.info("Updating config file", {
        keysCount: Object.keys(req.body).length,
        sizeBytes: configString.length
    });
    
    fs.writeFile(CONFIG_FILE_PATH, configString, { mode: 0o600 }, err => {
        if (err) {
            logger.error("Error writing config file:", {
                error: err.message,
                code: err.code,
                path: CONFIG_FILE_PATH
            });
            res.status(500).send('Failed to update config file');
        } else {
            logger.info("Config file updated successfully");
            res.status(200).send('Config file updated successfully');
        }
    });
})

/**
 * @swagger
 * /logPromotionAction:
 *  post:
 *    summary: Log content promotion action
 *    description: Logs the result of a content promotion action (success or error) for audit and monitoring purposes
 *    requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              username:
 *                type: string
 *                description: Username of the person performing the promotion
 *                example: "admin@example.com"
 *              id:
 *                type: string
 *                description: ID of the content item being promoted
 *                pattern: '^[a-zA-Z0-9]+$'
 *                example: "1234567890abcdef"
 *              title:
 *                type: string
 *                description: Title of the content item
 *                example: "My ArcGIS App"
 *              sourceEnv:
 *                type: string
 *                description: Source environment URL
 *                format: uri
 *                example: "https://enterprise-dev.example.com"
 *              targetEnv:
 *                type: string
 *                description: Target environment URL
 *                format: uri
 *                example: "https://enterprise-staging.example.com"
 *              success:
 *                type: boolean
 *                description: Whether the promotion was successful (omit if error occurred)
 *                example: true
 *              error:
 *                type: string
 *                description: Error message if promotion failed (omit if successful)
 *                example: "Item not found in source environment"
 *            required:
 *              - username
 *              - id
 *              - title
 *              - sourceEnv
 *              - targetEnv
 *            anyOf:
 *              - required: ["success"]
 *              - required: ["error"]
 *    tags:
 *      - Promote
 *    responses:
 *      200:
 *        description: Promotion action logged successfully
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                message:
 *                  type: string
 *                  enum:
 *                    - "Promotion success logged"
 *                    - "Promotion error logged successfully"
 *                timestamp:
 *                  type: string
 *                  format: date-time
 *      400:
 *        description: Bad request - missing required parameters or invalid data
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                error:
 *                  type: string
 *                timestamp:
 *                  type: string
 *                  format: date-time
 *              example:
 *                error: "Missing required parameters: username, id, title, sourceEnv, targetEnv"
 *                timestamp: "2026-08-10T12:00:00.000Z"
 */
router.post('/logPromotionAction', 
    authenticateArcGISToken,
    validateParams(['username', 'id', 'title', 'sourceEnv', 'targetEnv']), 
    (req, res) => {
        const { username, id, title, sourceEnv, targetEnv, error: errorMsg, success } = req.body;
        
        // Log authenticated user along with action
        logger.info('Promotion action logged', {
            authenticatedUser: req.arcgisUser.username,
            targetUser: username,
            id,
            sourceEnv,
            targetEnv
        });

        // Additional input validation
        if (username && String(username).length > 100) {
            logger.warning('Username too long in logPromotionAction', { ip: req.ip });
            return res.status(400).json({
                error: 'Username exceeds maximum length',
                timestamp: new Date().toISOString()
            });
        }

        if (!validateItemId(id)) {
            logger.warning(`Invalid id format in logPromotionAction: ${id}`, { ip: req.ip });
            return res.status(400).json({
                error: 'ID must be 16-32 alphanumeric characters',
                timestamp: new Date().toISOString()
            });
        }

        if (!validateUrl(sourceEnv) || !validateUrl(targetEnv)) {
            logger.warning('Invalid URL format in logPromotionAction', { 
                sourceEnv, 
                targetEnv,
                ip: req.ip 
            });
            return res.status(400).json({
                error: 'Environment URLs must be valid HTTPS URLs',
                timestamp: new Date().toISOString()
            });
        }

        // Sanitize title and error message to prevent log injection
        const sanitizedTitle = String(title).substring(0, 200) || 'Unknown';
        const sanitizedError = errorMsg ? String(errorMsg).substring(0, 500).replace(/[\r\n\t]/g, ' ') : null;

        if (errorMsg) {
            logger.error("Promotion action failed:", {
                error: sanitizedError,
                username: username,
                id: id,
                title: sanitizedTitle,
                sourceEnv: sourceEnv,
                targetEnv: targetEnv,
                ip: req.ip
            });
            res.status(200).json({
                message: 'Promotion error logged successfully',
                timestamp: new Date().toISOString()
            });
        }
        else if (success) {
            logger.info("Promotion action succeeded:", {
                username,
                id,
                title: sanitizedTitle,
                sourceEnv,
                targetEnv,
                ip: req.ip
            });
            res.status(200).json({
                message: 'Promotion success logged',
                timestamp: new Date().toISOString()
            });
        }
        else {
            logger.warning("No error or success message in logPromotionAction", {
                username: String(username),
                id: String(id),
                ip: req.ip
            });
            res.status(400).json({
                error: 'Either success or error status must be provided',
                timestamp: new Date().toISOString()
            });
        }
    }
);

/**
 * @swagger
 * /cloneContent:
 *  post:
 *    summary: Clone content between environments
 *    description: Creates a complete clone of a specific item from the source environment to the target environment, including all dependencies and configurations
 *    requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              sourceEnv:
 *                type: string
 *                format: uri
 *                description: Source environment URL
 *                example: "https://enterprise-dev.example.com"
 *              targetEnv:
 *                type: string
 *                format: uri
 *                description: Target environment URL
 *                example: "https://enterprise-staging.example.com"
 *              itemId:
 *                type: string
 *                pattern: '^[a-zA-Z0-9]+$'
 *                description: Alphanumeric ID of the item to clone
 *                example: "1234567890abcdef"
 *            required:
 *              - sourceEnv
 *              - targetEnv
 *              - itemId
 *    tags:
 *      - Clone
 *    responses:
 *      200:
 *        description: Content cloned successfully
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                result:
 *                  type: string
 *                  description: Output from the promotion script
 *                timestamp:
 *                  type: string
 *                  format: date-time
 *              example:
 *                result: "Successfully cloned item 1234567890abcdef"
 *                timestamp: "2026-08-10T12:00:00.000Z"
 *      400:
 *        description: Bad request - missing parameters or invalid format
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                error:
 *                  type: string
 *                timestamp:
 *                  type: string
 *                  format: date-time
 *      500:
 *        description: Internal server error - cloning process failed
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                error:
 *                  type: string
 *                timestamp:
 *                  type: string
 *                  format: date-time
 *              example:
 *                error: "Script execution failed"
 *                timestamp: "2026-08-10T12:00:00.000Z"
 */
const executeCloneOrUpdateScript = (args, operationType, itemId, sourceEnv, targetEnv, res) => {
    const scriptPath = path.resolve('./scripts/promote.py');
    
    if (!fs.existsSync(scriptPath) || !scriptPath.endsWith('/scripts/promote.py')) {
        logger.error('Python script not found or invalid path', { scriptPath });
        return res.status(500).json({
            error: 'Internal server error: script not available',
            timestamp: new Date().toISOString()
        });
    }

    const execOptions = {
        timeout: 600000,
        maxBuffer: 1024 * 1024,
        env: { ...process.env, PYTHONPATH: path.resolve('./scripts') }
    };
    
    execFile('python3', args, execOptions, (error, stdout, stderr) => {
        if (error) {
            const errorMessage = error.code === 'ETIMEDOUT' ? 'Operation timed out' : 'Script execution failed';
            logger.error(`${operationType} operation failed`, {
                error: error.message,
                code: error.code,
                itemId,
                sourceEnv,
                targetEnv
            });
            
            if (stderr) {
                logger.warning(`promote.py stderr: ${stderr.substring(0, 1000)}`);
            }
            
            return res.status(500).json({
                error: errorMessage,
                timestamp: new Date().toISOString()
            });
        }
        
        if (stderr) {
            logger.info(`promote.py stderr: ${stderr.substring(0, 1000)}`);
        }
        
        logger.info(`${operationType} operation completed successfully`, {
            itemId,
            sourceEnv,
            targetEnv,
            outputLength: stdout?.length || 0
        });
        
        res.status(200).json({
            result: stdout || 'Operation completed successfully',
            timestamp: new Date().toISOString()
        });
    });
};

router.post('/cloneContent', authenticateArcGISToken, (req, res) => {
    const { sourceEnv, targetEnv, itemId } = req.body;
    
    // Enhanced audit logging with user context
    logger.info('Clone operation initiated', {
        initiatedBy: req.arcgisUser.username,
        userEmail: req.arcgisUser.email,
        userRole: req.arcgisUser.role,
        sourceEnv,
        targetEnv,
        itemId,
        serviceAccount: process.env.ARCGIS_USERNAME,
        timestamp: new Date().toISOString()
    });
    
    const validationError = validateCloneOrUpdateRequest(req, res, sourceEnv, targetEnv, itemId, itemId, true);
    if (validationError) return;
    if (res.headersSent) return;

    logger.info(`Cloning item ${itemId} from ${sourceEnv} to ${targetEnv}`, {
        user: req.arcgisUser.username,
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });

    const args = [
        path.resolve('./scripts/promote.py'),
        '--sourceEnv', sourceEnv,
        '--targetEnv', targetEnv,
        '--sourceId', itemId,
        '--targetId', itemId,
        '--clone', 'true'
    ];
    
    executeCloneOrUpdateScript(args, 'Clone', itemId, sourceEnv, targetEnv, res);
});

/**
 * @swagger
 * /updateContent:
 *  post:
 *    summary: Update content between environments
 *    description: Copies JSON content and configuration from a source item to an existing target item, updating the target item's data without creating a new clone
 *    requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              sourceEnv:
 *                type: string
 *                format: uri
 *                description: Source environment URL
 *                example: "https://enterprise-dev.example.com"
 *              targetEnv:
 *                type: string
 *                format: uri
 *                description: Target environment URL
 *                example: "https://enterprise-staging.example.com"
 *              sourceId:
 *                type: string
 *                pattern: '^[a-zA-Z0-9]+$'
 *                description: Alphanumeric ID of the source item
 *                example: "1234567890abcdef"
 *              targetId:
 *                type: string
 *                pattern: '^[a-zA-Z0-9]+$'
 *                description: Alphanumeric ID of the target item to update
 *                example: "fedcba0987654321"
 *            required:
 *              - sourceEnv
 *              - targetEnv
 *              - sourceId
 *              - targetId
 *    tags:
 *      - Update
 *    responses:
 *      200:
 *        description: Item content updated successfully
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                result:
 *                  type: string
 *                  description: Output from the promotion script
 *                timestamp:
 *                  type: string
 *                  format: date-time
 *              example:
 *                result: "Successfully updated item fedcba0987654321"
 *                timestamp: "2026-08-10T12:00:00.000Z"
 *      400:
 *        description: Bad request - missing parameters or invalid format
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                error:
 *                  type: string
 *                timestamp:
 *                  type: string
 *                  format: date-time
 *      500:
 *        description: Internal server error - update process failed
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                error:
 *                  type: string
 *                timestamp:
 *                  type: string
 *                  format: date-time
 *              example:
 *                error: "Script execution failed"
 *                timestamp: "2026-08-10T12:00:00.000Z"
 */
router.post('/updateContent', authenticateArcGISToken, (req, res) => {
    const { sourceEnv, targetEnv, targetId, sourceId } = req.body;
    
    // Enhanced audit logging with user context
    logger.info('Update operation initiated', {
        initiatedBy: req.arcgisUser.username,
        userEmail: req.arcgisUser.email,
        userRole: req.arcgisUser.role,
        sourceEnv,
        targetEnv,
        sourceId,
        targetId,
        serviceAccount: process.env.ARCGIS_USERNAME,
        timestamp: new Date().toISOString()
    });
    
    const validationError = validateCloneOrUpdateRequest(req, res, sourceEnv, targetEnv, sourceId, targetId, false);
    if (validationError) return;
    if (res.headersSent) return;

    logger.info(`Updating content for item ${sourceId} from ${sourceEnv} to ${targetId} in ${targetEnv}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });

    const args = [
        path.resolve('./scripts/promote.py'),
        '--sourceEnv', sourceEnv,
        '--targetEnv', targetEnv,
        '--sourceId', sourceId,
        '--targetId', targetId,
        '--clone', 'false'
    ];
    
    executeCloneOrUpdateScript(args, 'Update', sourceId, sourceEnv, targetEnv, res);
});

module.exports = router;

