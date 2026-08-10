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

const winston = require('winston')
const path = require('node:path')
const fs = require('node:fs')

const { format, createLogger ,transports, addColors } = winston;
const { timestamp, combine, printf, colorize, simple, json, errors } = format

const customConfig = {
	levels: {
		critical: 0,
		error: 1,
		warning: 2,
		info: 3,
		debug: 4
	},
	colors: {
		critical: 'magenta',
		error: 'red',
		warning: 'yellow',
		info: 'green',
		debug: 'blue'
	}
};

/**
 * Formats the log data into a JSON string.
 *
 * @param {Object} logData - The log data object.
 * @returns {string} - The formatted log data as a JSON string.
 */
const logFormat = printf(logData => {
	const output = { 'log.level': logData.level, ...logData };
	delete output.level;
	return JSON.stringify(output);
});

/**
 */
const consoleFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
    // Helper function to safely convert any value to string
    const safeStringify = (value) => {
        if (value == null) return '';
        if (typeof value === 'string') return value;
        if (typeof value === 'object') {
            try {
                return JSON.stringify(value);
            } catch (e) {
                // Log circular reference errors for debugging
                if (e.message.includes('circular')) {
                    return '[Circular Reference]';
                }
                return '[Object - Stringify Failed]';
            }
        }
        return String(value);
    };
    
    const safeTimestamp = safeStringify(timestamp);
    const safeLevel = safeStringify(level);
    const safeMessage = safeStringify(message);
    
    let log = `${safeTimestamp} ${safeLevel}: ${safeMessage}`;
    
    // Add stack trace if present
    if (stack) {
        log += `\n${safeStringify(stack)}`;
    }
    
    // Add additional metadata
    const metaKeys = Object.keys(meta).filter(key => !['level', 'timestamp', 'message'].includes(key));
    if (metaKeys.length > 0) {
        const metaStr = metaKeys.map(key => {
            return `${key}=${safeStringify(meta[key])}`;
        }).join(' ');
        log += ` [${metaStr}]`;
    }
    
    return log;
});

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

addColors(customConfig.colors);

/**
 * Creates a logger instance with specified configuration.
 * @type {Object}
 */
const getLogLevel = () => {
	const levelMap = {
		'production': 'error',
		'staging': 'warning',
		'development': 'debug'
	};
	return levelMap[process.env.NODE_ENV] || 'info';
};

const logger = createLogger({
	levels: customConfig.levels,
	level: getLogLevel(),
	defaultMeta: {
		username: '',
		id: '',
		title: '',
		sourceEnv: '',
		targetEnv: ''
	},
	format: combine(
		timestamp(),
		errors({ stack: true }),
		json()
	),
	transports: [
		new transports.File({ 
			filename: path.join(logsDir, 'combined.log'), 
			level: 'debug',
			format: logFormat
		}),
		new transports.File({ 
			filename: path.join(logsDir, 'error.log'), 
			level: 'error',
			format: logFormat
		})
	],
});

// Add console logging for non-production environments
if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'staging') {
	logger.add(
		new transports.Console({
			format: combine(
                colorize(),
                timestamp(),
                errors({ stack: true }),
                consoleFormat
            ),
			level: 'debug'
		})
	);
}

module.exports = logger