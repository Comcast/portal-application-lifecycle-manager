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

const logger = require('../common/logger');

/**
 * Validates ArcGIS OAuth token against the portal it was issued from
 * This proves the user is authenticated, but we'll use service credentials for operations
 * 
 * @param {string} token - The OAuth token to validate
 * @param {string} portalUrl - The ArcGIS portal URL
 * @returns {Promise<Object|null>} User info if valid, null if invalid
 */
async function validateArcGISToken(token, portalUrl) {
    try {
        // Call portal's community/self endpoint to validate token and get user info
        const userResponse = await fetch(
            `${portalUrl}/sharing/rest/community/self?f=json&token=${token}`,
            { timeout: 5000 }
        );
        
        if (!userResponse.ok) {
            return null;
        }
        
        const userData = await userResponse.json();
        
        // Check for ArcGIS error response
        if (userData.error) {
            return null;
        }
        
        // Successful validation - return user info
        return {
            portal: portalUrl,
            username: userData.username,
            fullName: userData.fullName,
            email: userData.email,
            role: userData.role,
            isValid: true
        };
    } catch (error) {
        logger.error('Token validation error:', { error: error.message });
        return null;
    }
}

/**
 * Middleware to authenticate requests using ArcGIS OAuth tokens
 * The user's token is only used for authentication - not for the actual operations
 * Python scripts will use ARCGIS_USERNAME/ARCGIS_PASSWORD from environment variables
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function authenticateArcGISToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    
    if (!authHeader) {
        return res.status(401).json({
            error: 'Authentication required',
            message: 'Missing Authorization header'
        });
    }
    
    // Extract token (support "Bearer <token>" format)
    const token = authHeader.replace(/^Bearer\s+/i, '');
    
    if (!token) {
        return res.status(401).json({
            error: 'Authentication required',
            message: 'Invalid Authorization format. Use: Authorization: Bearer <token>'
        });
    }
    
    // Get portal URL from request
    // For clone/update operations, it's in the body as sourceEnv
    // For config operations, use header or default
    const portalUrl = req.body?.sourceEnv || 
                      req.headers['x-arcgis-portal'] ||
                      process.env.DEFAULT_PORTAL_URL;
    
    if (!portalUrl) {
        return res.status(400).json({
            error: 'Bad request',
            message: 'Portal URL required (provide sourceEnv in body or X-ArcGIS-Portal header)'
        });
    }
    
    // Remove /sharing/rest suffix if present to get clean portal URL
    const cleanPortalUrl = portalUrl.replace(/\/sharing\/rest\/?$/, '');
    
    // Validate token against the portal
    const validation = await validateArcGISToken(token, cleanPortalUrl);
    
    if (!validation) {
        return res.status(403).json({
            error: 'Access denied',
            message: 'Invalid or expired ArcGIS token'
        });
    }
    
    // Attach user info to request for audit logging
    // Note: This is NOT the account that will perform the operations
    // The Python script will use ARCGIS_USERNAME/ARCGIS_PASSWORD from environment variables
    req.arcgisUser = {
        username: validation.username,
        fullName: validation.fullName,
        email: validation.email,
        role: validation.role,
        portal: cleanPortalUrl,
        authenticatedWith: 'oauth',  // Marker to show this was OAuth auth
        timestamp: new Date().toISOString()
    };
    
    next();
}

module.exports = { authenticateArcGISToken };
