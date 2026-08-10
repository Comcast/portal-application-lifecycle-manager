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

const options = {
  definition:{
    openapi: '3.0.0',
    info: {
      title: 'REST APIs for Portal Application Lifecycle Manager',
      version: '1.0.0',
      description: "All Portal Application Lifecycle Manager REST APIs"
    },
    components: {
      securitySchemes: {
        bearer_auth: {
          type: 'http',
          scheme: 'bearer'
        }
      }
    },
    security: [
      {
        bearer_auth: []
      }
    ]
  },
  apis: [ './routes/*/*.js', './routes/*.js' ]
};
  
module.exports = options;
  