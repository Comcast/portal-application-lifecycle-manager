 # Copyright 2026 Comcast Cable Communications Management, LLC
 # Licensed under the Apache License, Version 2.0 (the "License");
 # You may not use this file except in compliance with the License.
 # You may obtain a copy of the License at
 #
 # http://www.apache.org/licenses/LICENSE-2.0
 #
 # Unless required by applicable law or agreed to in writing, software
 # distributed under the License is distributed on an "AS IS" BASIS,
 # WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 # See the License for the specific language governing permissions and
 # limitations under the License.
 #
 # SPDX-License-Identifier: Apache-2.0
 
#!/bin/bash
# This script installs dependencies and builds the app, for use by GitHub Actions. It is widely reusable by front-end apps.

set -euo pipefail

MAX_ATTEMPTS=5
DELAY=5

echo "Installing dependencies..."

for ((i=1; i<=MAX_ATTEMPTS; i++)); do
  echo "Attempt $i of $MAX_ATTEMPTS..."
  if npm i; then
    echo "Dependencies installed successfully."
    break
  elif [[ $i -lt MAX_ATTEMPTS ]]; then
    echo "npm i failed. Retrying in $DELAY seconds..."
    sleep "$DELAY"
    DELAY=$((DELAY * 2))
  else
    echo "npm i failed after $MAX_ATTEMPTS attempts."
    exit 1
  fi
done