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

const hosts = {
    DEV: "https://palm-dev.example.com",
    STG: "https://palm-stg.example.com",
    PROD: "https://palm.example.com",
    LOCAL: "http://localhost:3001",
    default: "http://localhost:3001"
}

const host = hosts[import.meta.env.VITE_PALM_ENV] || hosts.default;

export const env = import.meta.env.VITE_PALM_ENV || 'default';

export const config = {
    "GetConfig":  host + "/getConfig",
    "UpdateConfig": host + "/updateConfig",
    "LogPromotionAction": host + "/logPromotionAction",
    "CloneContent": host + "/cloneContent",
    "UpdateContent": host + "/updateContent"
}

export const portalList = {
    'Production': {
        'url': 'https://enterprise.example.com/arcgis/sharing/rest',
        'clientid': 'YOUR_PROD_CLIENT_ID',
        'canPublish': true
    },
    'Staging': {
        'url': 'https://enterprise-staging.example.com/arcgis/sharing/rest',
        'clientid': 'YOUR_STAGING_CLIENT_ID',
        'canPublish': true
    },
    'Development': {
        'url': 'https://enterprise-dev.example.com/arcgis/sharing/rest',
        'clientid': 'YOUR_DEV_CLIENT_ID',
        'canPublish': true
    }
};
    
export const searchFields = { 'Item Id': 'id', 'Title': 'title' };
export const searchTypes = { 'apps': 'Applications', 'maps': 'Web Maps' };

export const excludeOwners = ['esri_apps', 'esri_nav', 'esri_webstyles'];
