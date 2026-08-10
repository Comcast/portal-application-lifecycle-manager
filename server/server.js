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

const express = require('express');
const bodyParser = require('body-parser');
const swaggerUi = require('swagger-ui-express');
const swaggerJSDoc = require('swagger-jsdoc');
const swaggerSpecOption = require('./swagger-config');
const logger = require('./common/logger')
const Router = require('./routes')
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { version } = require('./package.json');

const swaggerSpec = swaggerJSDoc(swaggerSpecOption);

const appPort = process.env.PORT || 3001;

const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    limit: 100, // each IP can make up to 100 requests per `windowsMs` (1 minute)
    standardHeaders: true, // add the `RateLimit-*` headers to the response
    legacyHeaders: false, // remove the `X-RateLimit-*` headers from the response
});

/**
 * Global error handling middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request object  
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const errorHandler = (err, req, res, next) => {
    // Log the error with context
    logger.error('Unhandled error:', {
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });

    // Don't expose stack traces in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    // Handle specific error types
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({
            error: 'Invalid JSON in request body',
            message: 'Please check your request format'
        });
    }

    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
            error: 'File too large',
            message: 'Request body exceeds maximum size limit'
        });
    }

    // Default error response
    const statusCode = err.statusCode || err.status || 500;
    const errorResponse = {
        error: statusCode === 500 ? 'Internal Server Error' : err.message,
        timestamp: new Date().toISOString(),
        path: req.url
    };

    // Include stack trace only in development
    if (isDevelopment && statusCode === 500) {
        errorResponse.stack = err.stack;
    }

    res.status(statusCode).json(errorResponse);
};

/**
 * 404 Not Found handler
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const notFoundHandler = (req, res) => {
    logger.warning(`404 Not Found: ${req.method} ${req.url}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });
    
    res.status(404).json({
        error: 'Not Found',
        message: `Cannot ${req.method} ${req.url}`,
        timestamp: new Date().toISOString()
    });
};

/**
 * Creates and starts the server.
 * @returns {Object} The express app instance.
 */
const server = () => {
    const app = express();
    
    // Apply rate limiting first
    app.use(limiter);
    
    // Security headers
    app.use((req, res, next) => {
        // Use a more permissive CSP for Swagger UI at /api-docs, while
        // keeping the original stricter CSP for the rest of the app.
        if (req.path === '/api-docs' || req.path.startsWith('/api-docs/')) {
            return helmet({
                contentSecurityPolicy: {
                    directives: {
                        defaultSrc: ["'self'"],
                        styleSrc: ["'self'", "'unsafe-inline'"], // for Swagger UI
                        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"] // allow inline/eval for Swagger UI
                    }
                }
            })(req, res, next);
        }
        // Original stricter CSP for all non-Swagger routes
        return helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'"],
                    scriptSrc: ["'self'"]
                }
            }
        })(req, res, next);
    });
    
    // CORS - Restrict to specific frontend origin(s)
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
        ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
        : ['http://localhost:5173', 'http://localhost:3000', 'https://localhost:3000']; // Development defaults (http and https)
    
    app.use(cors({
        origin: (origin, callback) => {
            // Allow requests with no origin (like mobile apps, Postman, or server-to-server)
            if (!origin) return callback(null, true);
            
            if (allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                logger.warning('CORS request blocked from unauthorized origin', { origin });
                callback(new Error('Not allowed by CORS'));
            }
        },
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-ArcGIS-Portal'],
        credentials: false // Using Bearer tokens, not cookies
    }));
    
    // Body parsing middleware with size limits
    app.use(bodyParser.json({ limit: '10mb' }));
    app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
    app.use(bodyParser.text({ type: 'text/*', limit: '10mb' }));
    
    // API documentation
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
    
    // Health check endpoint
    app.get('/health', (req, res) => {
        res.status(200).json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            version: version
        });
    });
    
    // Main routes
    app.use('/', Router);
    
    // 404 handler (must be after all routes)
    app.use(notFoundHandler);
    
    // Global error handler (must be last)
    app.use(errorHandler);

    return app.listen(appPort, () => {
        logger.info(`Portal Application Lifecycle Manager Server listening on port ${appPort}`, {
            environment: process.env.NODE_ENV || 'development',
            version: version
        });
    }); 
};
  
server();