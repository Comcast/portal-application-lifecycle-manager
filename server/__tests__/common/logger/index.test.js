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

const path = require('node:path');
const fs = require('node:fs');

describe('Logger Module', () => {
    let originalEnv;
    let originalCwd;
    let mockFiles = [];
    let mockConsole = [];
    
    beforeEach(() => {
        originalEnv = process.env.NODE_ENV;
        originalCwd = process.cwd;
        mockFiles = [];
        mockConsole = [];
        
        // Clear module cache
        jest.clearAllMocks();
        jest.resetModules();
        
        // Mock process.cwd()
        process.cwd = jest.fn(() => '/test/path');
        
        // Mock fs functions
        jest.spyOn(fs, 'existsSync').mockReturnValue(true);
        jest.spyOn(fs, 'mkdirSync').mockImplementation();
    });
    
    afterEach(() => {
        process.env.NODE_ENV = originalEnv;
        process.cwd = originalCwd;
        
        // Restore fs mocks
        fs.existsSync.mockRestore();
        fs.mkdirSync.mockRestore();
    });
    
    describe('Directory Creation', () => {
        it('should create logs directory if it does not exist', () => {
            fs.existsSync.mockReturnValue(false);
            
            require('../../../common/logger');
            
            expect(fs.mkdirSync).toHaveBeenCalledWith(
                path.join('/test/path', 'logs'),
                { recursive: true }
            );
        });
        
        it('should not create logs directory if it already exists', () => {
            fs.existsSync.mockReturnValue(true);
            
            require('../../../common/logger');
            
            expect(fs.mkdirSync).not.toHaveBeenCalled();
        });
    });
    
    describe('Logger Export', () => {
        it('should export a logger instance', () => {
            const logger = require('../../../common/logger');
            
            expect(logger).toBeDefined();
            expect(typeof logger.info).toBe('function');
            expect(typeof logger.error).toBe('function');
            expect(typeof logger.warning).toBe('function');
            expect(typeof logger.debug).toBe('function');
            expect(typeof logger.critical).toBe('function');
        });
        
        it('should have Winston logger properties', () => {
            const logger = require('../../../common/logger');
            
            expect(logger).toHaveProperty('level');
            expect(logger).toHaveProperty('levels');
            expect(logger).toHaveProperty('transports');
        });
    });
    
    describe('Logger Configuration', () => {
        it('should have custom log levels', () => {
            const logger = require('../../../common/logger');
            
            expect(logger.levels).toBeDefined();
            expect(logger.levels.critical).toBe(0);
            expect(logger.levels.error).toBe(1);
            expect(logger.levels.warning).toBe(2);
            expect(logger.levels.info).toBe(3);
            expect(logger.levels.debug).toBe(4);
        });
        
        it('should have default metadata structure', () => {
            const logger = require('../../../common/logger');
            
            expect(logger.defaultMeta).toBeDefined();
            expect(logger.defaultMeta).toHaveProperty('username');
            expect(logger.defaultMeta).toHaveProperty('id');
            expect(logger.defaultMeta).toHaveProperty('title');
            expect(logger.defaultMeta).toHaveProperty('sourceEnv');
            expect(logger.defaultMeta).toHaveProperty('targetEnv');
        });
        
        it('should configure transports', () => {
            const logger = require('../../../common/logger');
            
            expect(logger.transports).toBeDefined();
            expect(Array.isArray(logger.transports)).toBe(true);
            expect(logger.transports.length).toBeGreaterThan(0);
        });
    });
    
    describe('Log Level By Environment', () => {
        it('should use "error" level for production environment', () => {
            process.env.NODE_ENV = 'production';
            
            const logger = require('../../../common/logger');
            
            expect(logger.level).toBe('error');
        });
        
        it('should use "warning" level for staging environment', () => {
            process.env.NODE_ENV = 'staging';
            
            const logger = require('../../../common/logger');
            
            expect(logger.level).toBe('warning');
        });
        
        it('should use "debug" level for development environment', () => {
            process.env.NODE_ENV = 'development';
            
            const logger = require('../../../common/logger');
            
            expect(logger.level).toBe('debug');
        });
        
        it('should use "info" level for unknown environment', () => {
            process.env.NODE_ENV = 'testing';
            
            const logger = require('../../../common/logger');
            
            expect(logger.level).toBe('info');
        });
        
        it('should use "info" level when NODE_ENV is not set', () => {
            delete process.env.NODE_ENV;
            
            const logger = require('../../../common/logger');
            
            expect(logger.level).toBe('info');
        });
    });
    
    describe('Console Transport By Environment', () => {
        it('should have console transport in development environment', () => {
            process.env.NODE_ENV = 'development';
            
            const logger = require('../../../common/logger');
            
            const hasConsoleTransport = logger.transports.some(
                t => t.constructor.name === 'Console'
            );
            expect(hasConsoleTransport).toBe(true);
        });
        
        it('should have console transport in test environment', () => {
            process.env.NODE_ENV = 'test';
            
            const logger = require('../../../common/logger');
            
            const hasConsoleTransport = logger.transports.some(
                t => t.constructor.name === 'Console'
            );
            expect(hasConsoleTransport).toBe(true);
        });
        
        it('should not have console transport in production environment', () => {
            process.env.NODE_ENV = 'production';
            
            const logger = require('../../../common/logger');
            
            const hasConsoleTransport = logger.transports.some(
                t => t.constructor.name === 'Console'
            );
            expect(hasConsoleTransport).toBe(false);
        });
        
        it('should not have console transport in staging environment', () => {
            process.env.NODE_ENV = 'staging';
            
            const logger = require('../../../common/logger');
            
            const hasConsoleTransport = logger.transports.some(
                t => t.constructor.name === 'Console'
            );
            expect(hasConsoleTransport).toBe(false);
        });
    });
    
    describe('File Transports', () => {
        it('should have File transports configured', () => {
            const logger = require('../../../common/logger');
            
            const fileTransports = logger.transports.filter(
                t => t.constructor.name === 'File'
            );
            
            expect(fileTransports.length).toBeGreaterThanOrEqual(2);
        });
        
        it('should have combined.log file transport', () => {
            const logger = require('../../../common/logger');
            
            const combinedTransport = logger.transports.find(
                t => t.constructor.name === 'File' && t.filename && t.filename.includes('combined.log')
            );
            
            expect(combinedTransport).toBeDefined();
        });
        
        it('should have error.log file transport', () => {
            const logger = require('../../../common/logger');
            
            const errorTransport = logger.transports.find(
                t => t.constructor.name === 'File' && t.filename && t.filename.includes('error.log')
            );
            
            expect(errorTransport).toBeDefined();
        });
    });
    
    describe('Logging Methods', () => {
        it('should have all custom log level methods', () => {
            const logger = require('../../../common/logger');
            
            expect(typeof logger.critical).toBe('function');
            expect(typeof logger.error).toBe('function');
            expect(typeof logger.warning).toBe('function');
            expect(typeof logger.info).toBe('function');
            expect(typeof logger.debug).toBe('function');
        });
        
        it('should log without throwing errors', () => {
            const logger = require('../../../common/logger');
            
            expect(() => {
                logger.info('Test message');
            }).not.toThrow();
        });
        
        it('should log with metadata without throwing errors', () => {
            const logger = require('../../../common/logger');
            
            expect(() => {
                logger.info('Test message', { username: 'testuser', id: 'item123' });
            }).not.toThrow();
        });
        
        it('should log errors with stack traces without throwing', () => {
            const logger = require('../../../common/logger');
            const testError = new Error('Test error');
            
            expect(() => {
                logger.error('Error occurred', { error: testError });
            }).not.toThrow();
        });
    });
});
