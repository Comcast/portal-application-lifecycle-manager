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
 * @jest-environment node
 */

const request = require('supertest');
const express = require('express');
const path = require('node:path');

// Mock dependencies BEFORE requiring the router
jest.mock('../../common/logger', () => ({
    info: jest.fn(),
    warning: jest.fn(),
    error: jest.fn()
}));

const fs = require('node:fs');
const { execFile } = require('node:child_process');
const logger = require('../../common/logger');

// Spy on fs methods
jest.spyOn(fs, 'readFile');
jest.spyOn(fs, 'writeFile');
jest.spyOn(fs, 'existsSync');

// Mock child_process
jest.mock('node:child_process');

// Now require after mocks are set up
const router = require('../../routes/index');

// Create Express app for testing
const app = express();
app.use(express.json({ limit: '10mb' }));
app.use('/', router);

describe('Routes - GET /', () => {
    test('should return welcome message', async () => {
        const response = await request(app).get('/');
        
        expect(response.status).toBe(200);
        expect(response.text).toBe('<h1>Welcome to Portal Application Lifecycle Manager</h1>');
    });
});

describe('Routes - GET /getConfig', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        fs.readFile.mockReset();
        fs.writeFile.mockReset();
        fs.existsSync.mockReset();
    });

    test('should return config file successfully', async () => {
        const mockConfig = {
            "GIS Tools Portal": {
                type: "url",
                description: "GIS Tools Portal",
                Production: "gistools.example.com"
            }
        };

        fs.readFile.mockImplementation((path, encoding, callback) => {
            callback(null, JSON.stringify(mockConfig));
        });

        const response = await request(app).get('/getConfig');

        expect(response.status).toBe(200);
        expect(response.body).toEqual(mockConfig);
    });

    test('should handle file read error', async () => {
        const mockError = new Error('File not found');
        mockError.code = 'ENOENT';

        fs.readFile.mockImplementation((path, encoding, callback) => {
            callback(mockError, null);
        });

        const response = await request(app).get('/getConfig');

        expect(response.status).toBe(500);
        expect(response.text).toBe('Failed to read config file');
        expect(logger.error).toHaveBeenCalled();
    });

    test('should handle invalid JSON in config file', async () => {
        fs.readFile.mockImplementation((path, encoding, callback) => {
            callback(null, 'invalid json {');
        });

        const response = await request(app).get('/getConfig');

        expect(response.status).toBe(500);
        expect(response.text).toBe('Config file contains invalid JSON');
        expect(logger.error).toHaveBeenCalled();
    });
});

describe('Routes - POST /updateConfig', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        fs.writeFile.mockReset();
    });

    test('should update config successfully', async () => {
        const validConfig = {
            "GIS Tools Portal": {
                type: "url",
                description: "GIS Tools Portal",
                Production: "gistools.example.com"
            }
        };

        fs.writeFile.mockImplementation((path, data, options, callback) => {
            callback(null);
        });

        const response = await request(app)
            .post('/updateConfig')
            .send(validConfig);

        expect(response.status).toBe(200);
        expect(response.text).toBe('Config file updated successfully');
        expect(logger.info).toHaveBeenCalled();
    });

    test('should reject invalid config data type', async () => {
        const response = await request(app)
            .post('/updateConfig')
            .send([]);

        expect(response.status).toBe(400);
        expect(response.text).toBe('Config data must be a valid object');
    });

    test('should reject config exceeding size limit', async () => {
        const largeConfig = {};
        // Create a config larger than MAX_CONFIG_SIZE (1MB)
        for (let i = 0; i < 10000; i++) {
            largeConfig[`key${i}`] = 'x'.repeat(150);
        }

        const response = await request(app)
            .post('/updateConfig')
            .send(largeConfig);

        expect(response.status).toBe(400);
        expect(response.text).toBe('Config file exceeds maximum size limit');
    });

    test('should reject config with unsafe keys', async () => {
        const unsafeConfig = {
            "valid key": "value",
            "../../../etc/passwd": "malicious"
        };

        const response = await request(app)
            .post('/updateConfig')
            .send(unsafeConfig);

        expect(response.status).toBe(400);
        expect(response.text).toContain('Config contains invalid key names');
    });

    test('should handle file write error', async () => {
        const validConfig = {
            "GIS tools": {
                type: "url"
            }
        };

        fs.writeFile.mockImplementation((path, data, options, callback) => {
            callback(new Error('Permission denied'));
        });

        const response = await request(app)
            .post('/updateConfig')
            .send(validConfig);

        expect(response.status).toBe(500);
        expect(response.text).toBe('Failed to update config file');
    });
});

describe('Routes - POST /logPromotionAction', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    const validPayload = {
        username: 'testuser',
        id: '1234567890abcdef',
        title: 'Test Item',
        sourceEnv: 'https://enterprise-dev.example.com',
        targetEnv: 'https://enterprise-staging.example.com',
        success: true
    };

    test('should log successful promotion', async () => {
        const response = await request(app)
            .post('/logPromotionAction')
            .send(validPayload);

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Promotion success logged');
        expect(logger.info).toHaveBeenCalled();
    });

    test('should log failed promotion', async () => {
        const errorPayload = {
            ...validPayload,
            success: undefined,
            error: 'Item not found'
        };

        const response = await request(app)
            .post('/logPromotionAction')
            .send(errorPayload);

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Promotion error logged successfully');
        expect(logger.error).toHaveBeenCalled();
    });

    test('should reject missing required fields', async () => {
        const invalidPayload = {
            username: 'testuser',
            id: '1234567890abcdef'
        };

        const response = await request(app)
            .post('/logPromotionAction')
            .send(invalidPayload);

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Missing required parameters');
    });

    test('should reject invalid username length', async () => {
        const invalidPayload = {
            ...validPayload,
            username: 'a'.repeat(101)
        };

        const response = await request(app)
            .post('/logPromotionAction')
            .send(invalidPayload);

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Username exceeds maximum length');
    });

    test('should reject invalid item ID format', async () => {
        const invalidPayload = {
            ...validPayload,
            id: 'invalid-id-with-dashes'
        };

        const response = await request(app)
            .post('/logPromotionAction')
            .send(invalidPayload);

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('ID must be 16-32 alphanumeric characters');
    });

    test('should reject invalid URLs', async () => {
        const invalidPayload = {
            ...validPayload,
            sourceEnv: 'not-a-valid-url'
        };

        const response = await request(app)
            .post('/logPromotionAction')
            .send(invalidPayload);

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Environment URLs must be valid HTTPS URLs');
    });

    test('should reject when neither success nor error is provided', async () => {
        const invalidPayload = {
            username: 'testuser',
            id: '1234567890abcdef',
            title: 'Test Item',
            sourceEnv: 'https://enterprise-dev.example.com',
            targetEnv: 'https://enterprise-staging.example.com'
        };

        const response = await request(app)
            .post('/logPromotionAction')
            .send(invalidPayload);

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Either success or error status must be provided');
    });
});

describe('Routes - POST /cloneContent', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        fs.existsSync.mockReset();
        fs.existsSync.mockReturnValue(true);
        execFile.mockReset();
    });

    const validPayload = {
        sourceEnv: 'https://enterprise-dev.example.com',
        targetEnv: 'https://enterprise-staging.example.com',
        itemId: '1234567890abcdef'
    };

    test('should clone content successfully', async () => {
        execFile.mockImplementation((cmd, args, options, callback) => {
            callback(null, 'Successfully cloned item', '');
        });

        const response = await request(app)
            .post('/cloneContent')
            .send(validPayload);

        expect(response.status).toBe(200);
        expect(response.body.result).toContain('Successfully cloned item');
        expect(logger.info).toHaveBeenCalledWith(
            expect.stringContaining('Cloning item'),
            expect.any(Object)
        );
    });

    test('should reject missing required parameters', async () => {
        const response = await request(app)
            .post('/cloneContent')
            .send({ sourceEnv: 'https://test.com' });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Missing required parameters');
    });

    test('should reject invalid source URL', async () => {
        const invalidPayload = {
            ...validPayload,
            sourceEnv: 'not-a-url'
        };

        const response = await request(app)
            .post('/cloneContent')
            .send(invalidPayload);

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('sourceEnv must be a valid HTTPS URL');
    });

    test('should reject invalid target URL', async () => {
        const invalidPayload = {
            ...validPayload,
            targetEnv: 'ftp://invalid-protocol.com'
        };

        const response = await request(app)
            .post('/cloneContent')
            .send(invalidPayload);

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('targetEnv must be a valid HTTPS URL');
    });

    test('should reject invalid itemId format', async () => {
        const invalidPayload = {
            ...validPayload,
            itemId: 'invalid@id'
        };

        const response = await request(app)
            .post('/cloneContent')
            .send(invalidPayload);

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('sourceId must be 16-32 alphanumeric characters');
    });

    test('should reject same environment cloning', async () => {
        const sameEnvPayload = {
            sourceEnv: 'https://enterprise-staging.example.com',
            targetEnv: 'https://enterprise-staging.example.com',
            itemId: '1234567890abcdef'
        };

        const response = await request(app)
            .post('/cloneContent')
            .send(sameEnvPayload);

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Source and target environments must be different');
    });

    test('should handle script not found', async () => {
        fs.existsSync.mockReturnValue(false);

        const response = await request(app)
            .post('/cloneContent')
            .send(validPayload);

        expect(response.status).toBe(500);
        expect(response.body.error).toContain('script not available');
    });

    test('should handle script execution timeout', async () => {
        execFile.mockImplementation((cmd, args, options, callback) => {
            const error = new Error('Timeout');
            error.code = 'ETIMEDOUT';
            callback(error, '', '');
        });

        const response = await request(app)
            .post('/cloneContent')
            .send(validPayload);

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Operation timed out');
    });

    test('should handle script execution error', async () => {
        execFile.mockImplementation((cmd, args, options, callback) => {
            callback(new Error('Script failed'), '', 'Error output');
        });

        const response = await request(app)
            .post('/cloneContent')
            .send(validPayload);

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Script execution failed');
    });
});

describe('Routes - POST /updateContent', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        fs.existsSync.mockReset();
        fs.existsSync.mockReturnValue(true);
        execFile.mockReset();
    });

    const validPayload = {
        sourceEnv: 'https://enterprise-dev.example.com',
        targetEnv: 'https://enterprise-staging.example.com',
        sourceId: '1234567890abcdef',
        targetId: 'fedcba0987654321'
    };

    test('should update content successfully', async () => {
        execFile.mockImplementation((cmd, args, options, callback) => {
            callback(null, 'Successfully updated item', '');
        });

        const response = await request(app)
            .post('/updateContent')
            .send(validPayload);

        expect(response.status).toBe(200);
        expect(response.body.result).toContain('Successfully updated item');
        expect(logger.info).toHaveBeenCalledWith(
            expect.stringContaining('Updating content'),
            expect.any(Object)
        );
    });

    test('should reject missing required parameters', async () => {
        const response = await request(app)
            .post('/updateContent')
            .send({ sourceEnv: 'https://test.com', targetEnv: 'https://test2.com' });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Missing required parameters');
    });

    test('should reject invalid source URL', async () => {
        const invalidPayload = {
            ...validPayload,
            sourceEnv: 'javascript:alert(1)'
        };

        const response = await request(app)
            .post('/updateContent')
            .send(invalidPayload);

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('sourceEnv must be a valid HTTPS URL');
    });

    test('should reject invalid target URL', async () => {
        const invalidPayload = {
            ...validPayload,
            targetEnv: 'file:///etc/passwd'
        };

        const response = await request(app)
            .post('/updateContent')
            .send(invalidPayload);

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('targetEnv must be a valid HTTPS URL');
    });

    test('should reject invalid sourceId format', async () => {
        const invalidPayload = {
            ...validPayload,
            sourceId: 'too_short'
        };

        const response = await request(app)
            .post('/updateContent')
            .send(invalidPayload);

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('sourceId must be 16-32 alphanumeric characters');
    });

    test('should reject invalid targetId format', async () => {
        const invalidPayload = {
            ...validPayload,
            targetId: 'x'.repeat(50)
        };

        const response = await request(app)
            .post('/updateContent')
            .send(invalidPayload);

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('targetId must be 16-32 alphanumeric characters');
    });

    test('should reject updating item to itself', async () => {
        const sameItemPayload = {
            sourceEnv: 'https://enterprise-staging.example.com',
            targetEnv: 'https://enterprise-staging.example.com',
            sourceId: '1234567890abcdef',
            targetId: '1234567890abcdef'
        };

        const response = await request(app)
            .post('/updateContent')
            .send(sameItemPayload);

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Cannot update an item to itself');
    });

    test('should handle script not found', async () => {
        fs.existsSync.mockReturnValue(false);

        const response = await request(app)
            .post('/updateContent')
            .send(validPayload);

        expect(response.status).toBe(500);
        expect(response.body.error).toContain('script not available');
    });

    test('should handle script execution timeout', async () => {
        execFile.mockImplementation((cmd, args, options, callback) => {
            const error = new Error('Timeout');
            error.code = 'ETIMEDOUT';
            callback(error, '', '');
        });

        const response = await request(app)
            .post('/updateContent')
            .send(validPayload);

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Operation timed out');
    });

    test('should handle script execution error with stderr', async () => {
        execFile.mockImplementation((cmd, args, options, callback) => {
            callback(new Error('Script failed'), '', 'Python error traceback');
        });

        const response = await request(app)
            .post('/updateContent')
            .send(validPayload);

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Script execution failed');
        expect(logger.warning).toHaveBeenCalledWith(
            expect.stringContaining('promote.py stderr')
        );
    });

    test('should allow updating from one environment to another with different IDs', async () => {
        execFile.mockImplementation((cmd, args, options, callback) => {
            callback(null, 'Update successful', '');
        });

        const differentEnvPayload = {
            sourceEnv: 'https://enterprise-dev.example.com',
            targetEnv: 'https://enterprise-staging.example.com',
            sourceId: '1234567890abcdef',
            targetId: '1234567890abcdef'  // Same ID but different environments
        };

        const response = await request(app)
            .post('/updateContent')
            .send(differentEnvPayload);

        expect(response.status).toBe(200);
        expect(response.body.result).toBe('Update successful');
    });
});

describe('Security Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should reject localhost URLs in production', async () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';

        const localhostPayload = {
            username: 'testuser',
            id: '1234567890abcdef',
            title: 'Test Item',
            sourceEnv: 'https://localhost:3000',
            targetEnv: 'https://enterprise-staging.example.com',
            success: true
        };

        const response = await request(app)
            .post('/logPromotionAction')
            .send(localhostPayload);

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Environment URLs must be valid HTTPS URLs');

        process.env.NODE_ENV = originalEnv;
    });

    test('should reject private IP addresses in production', async () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';

        const privateIpPayload = {
            username: 'testuser',
            id: '1234567890abcdef',
            title: 'Test Item',
            sourceEnv: 'https://192.168.1.1',
            targetEnv: 'https://enterprise-staging.example.com',
            success: true
        };

        const response = await request(app)
            .post('/logPromotionAction')
            .send(privateIpPayload);

        expect(response.status).toBe(400);
        
        process.env.NODE_ENV = originalEnv;
    });

    test('should sanitize long titles to prevent log injection', async () => {
        const longTitlePayload = {
            username: 'testuser',
            id: '1234567890abcdef',
            title: 'x'.repeat(500),
            sourceEnv: 'https://enterprise-dev.example.com',
            targetEnv: 'https://enterprise-staging.example.com',
            success: true
        };

        const response = await request(app)
            .post('/logPromotionAction')
            .send(longTitlePayload);

        expect(response.status).toBe(200);
        expect(logger.info).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                title: expect.stringMatching(/^x{200}$/)
            })
        );
    });

    test('should reject XSS attempts in item IDs', async () => {
        const xssPayload = {
            sourceEnv: 'https://enterprise-dev.example.com',
            targetEnv: 'https://enterprise-staging.example.com',
            itemId: '<script>alert("xss")</script>'
        };

        fs.existsSync.mockReturnValue(true);

        const response = await request(app)
            .post('/cloneContent')
            .send(xssPayload);

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('sourceId must be 16-32 alphanumeric characters');
    });
});
