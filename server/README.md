# Portal Application Lifecycle Manager Server

**Table of Contents**
- [Background](#background)
- [Install](#install)
- [Configuration](#configuration)
- [Usage](#usage)
- [Security](#security)
- [API](#api)
- [Contribute](#contribute)
- [License](#license)

## Background

Portal Application Lifecycle Manager Server is the Node.js backend component for the Portal Application Lifecycle Manager application. It provides RESTful API endpoints that enable the Portal Application Lifecycle Manager React client to manage configuration files, clone content between ArcGIS Enterprise environments, and log promotion activities.

**Why does Portal Application Lifecycle Manager Server exist?**

The React client needs a backend service to:
- Securely store and manage environment configuration files
- Handle server-side operations that cannot be performed client-side
- Provide a centralized point for logging and auditing promotion activities
- Transform and validate configuration data before storage

**Key Features:**

1. **Configuration Management** - Read and update environment-specific configuration files that define expected differences between Development, Staging, and Production environments
2. **Content Operations** - Clone and update ArcGIS applications and web maps between environments
3. **Audit Logging** - Track all promotion activities for compliance and troubleshooting

**What makes Portal Application Lifecycle Manager Server different?**

Unlike generic REST APIs, Portal Application Lifecycle Manager Server understands ArcGIS content structure and can intelligently transform configuration values when promoting content between environments (e.g., replacing development URLs with production URLs).

**Who is this for?**

This server is designed for GIS administrators and DevOps teams who deploy and maintain the Portal Application Lifecycle Manager application in their enterprise environment.

## Install

If you've never used git or Node.js before, please take a moment to familiarize yourself with these technologies. To install this project, you'll need to have git and Node.js (v18 or higher) installed on your server environment.

### Prerequisites

- Node.js (v18 or higher)
- npm (v9 or higher)
- Git
- Python (v3.9 or higher) with Anaconda or Miniconda
- Write access to the server filesystem for configuration storage

### Installation Steps

1. Clone the monorepo:
```bash
git clone https://github.com/Comcast/portal-application-lifecycle-manager.git
cd portal-application-lifecycle-manager/server
```

2. Install Node.js dependencies:
```bash
npm install
```

3. Install ESRI ArcGIS Python API:

The Portal Application Lifecycle Manager Server uses the ESRI ArcGIS Python API for advanced GIS operations. Follow these steps to install it:

**Option A: Using Anaconda (Recommended)**

```bash
# Create a new conda environment (optional but recommended)
conda create -n palm-env python=3.9

# Activate the environment
conda activate palm-env

# Install ArcGIS Python API
conda install -c esri arcgis
```

**Option B: Using pip**

```bash
# Ensure you have Python 3.9+ installed
python --version

# Install ArcGIS Python API
pip install arcgis
```

**Installation Resources:**
- [ArcGIS Python API Documentation](https://developers.arcgis.com/python/latest/)
- [Installation Guide](https://developers.arcgis.com/python/latest/guide/install-and-set-up/anaconda/)

**Verify ArcGIS API Installation:**
```bash
python -c "import arcgis; print(arcgis.__version__)"
```

4. Install Python testing dependencies:
```bash
pip install -r requirements.txt
```

5. Verify installation:
```bash
npm test
```

## Configuration

### Environment-Specific Configuration

The server stores environment configuration in `config/env-config.json`. This file defines expected differences between environments.

#### Configuration File Structure

```json
{
  "serviceUrl1": {
    "type": "url",
    "key": "serviceUrl1",
    "description": "Main feature service endpoint",
    "Production": "https://prod-server.com/arcgis/rest/services/MyService",
    "Staging": "https://stg-server.com/arcgis/rest/services/MyService",
    "Development": "https://dev-server.com/arcgis/rest/services/MyService"
  },
  "widgetConfig1": {
    "type": "widget",
    "key": "widgetConfig1",
    "description": "Widget-specific configuration",
    "Production": "prod-value",
    "Staging": "stg-value",
    "Development": "dev-value"
  }
}
```

#### Configuration Types

- **url**: Service endpoints, portal URLs, or any URL-based configuration
- **widget**: Widget-specific settings or custom application parameters

### Server Configuration

Create a backup of the default configuration:
```bash
cp config/env-config.json config/env-config-backup.json
```

Update `config/env-config.json` with your environment-specific values before first use.

### Port Configuration

By default, the server runs on port 3001. To change this, set the `PORT` environment variable:

```bash
PORT=8080 node server.js
```

### CORS Configuration

By default, the server allows cross-origin requests from `http://localhost:5173`, `http://localhost:3000`, and `https://localhost:3000` (development defaults). For production deployments, set the `ALLOWED_ORIGINS` environment variable to a comma-separated list of allowed frontend URLs:

```bash
ALLOWED_ORIGINS=https://palm.example.com,https://palm-staging.example.com node server.js
```

This restricts cross-origin requests to only the specified origins, preventing unauthorized websites from making API calls to your server.

### SSL Certificate Configuration

If your ArcGIS Enterprise environments use self-signed certificates or internal Certificate Authorities (CA), configure the Python scripts to trust your custom CA bundle instead of disabling SSL verification:

```bash
# Set the custom CA bundle path for the ArcGIS Python API
export REQUESTS_CA_BUNDLE=/path/to/enterprise-ca.pem
export SSL_CERT_FILE=/path/to/enterprise-ca.pem

# Then start the server
node server.js
```

**Important**: Never disable SSL certificate verification (`verify=False` or suppressing `InsecureRequestWarning`). If you see SSL warnings in the logs, it indicates a potential security issue that should be investigated and resolved by configuring the proper CA bundle.

To obtain your enterprise CA certificate:
1. Export it from your ArcGIS Enterprise Portal admin interface
2. Contact your IT/security team for the organization's root CA certificate
3. Combine multiple certificates into a single bundle file if needed

## Usage

### Starting the Server

Start the server in development mode:
```bash
node server.js
```

Start the server in production mode:
```bash
NODE_ENV=production node server.js
```

The server will start on port 3001 (or the port specified in the PORT environment variable) and be accessible at `http://localhost:3001`.

### Running Tests

Run the test suite:
```bash
npm test
```

Run tests with coverage:
```bash
npm run test:coverage
```

### API Health Check

Verify the server is running:
```bash
curl http://localhost:3001/health
```

### Logging

Server logs are stored in the `logs/` directory. Log files are rotated daily and retained for 14 days by default.

## Security

### Authentication

Portal Application Lifecycle Manager Server uses ArcGIS OAuth 2.0 for authentication. All API endpoints (except `/`, `/health`, and `/api-docs`) require a valid ArcGIS OAuth token sent in the `Authorization` header:

```bash
Authorization: Bearer <your-arcgis-oauth-token>
```

The server validates tokens against the ArcGIS portal specified in the `X-ArcGIS-Portal` header. Authenticated users are identified and logged for audit purposes, while backend operations use a service account (configured via `ARCGIS_USERNAME` and `ARCGIS_PASSWORD` environment variables) to ensure consistent permissions and audit trails.

### CORS Protection

The server restricts cross-origin requests to authorized frontend origins only. Configure allowed origins using the `ALLOWED_ORIGINS` environment variable to prevent unauthorized websites from accessing your API.

### Best Practices

- **Network Security**: Deploy Portal Application Lifecycle Manager Server in a secure network segment, accessible only to authorized Portal Application Lifecycle Manager clients
- **File Permissions**: Ensure the `config/` and `logs/` directories have appropriate file system permissions
- **HTTPS**: Use a reverse proxy (nginx, Apache) to provide HTTPS encryption for API endpoints
- **Environment Variables**: Securely store `ARCGIS_USERNAME` and `ARCGIS_PASSWORD` credentials (use secrets management in production)
- **CORS**: Set `ALLOWED_ORIGINS` to restrict access to trusted client origins only
- **Backup**: Regularly backup `config/env-config.json` before making changes
- **Audit Logs**: Monitor `logs/` directory for promotion activities and potential security events

### Security Considerations

- Configuration files may contain sensitive environment information - protect accordingly
- The server has write access to configuration files - restrict access to authorized personnel only
- All promotion activities are logged for audit purposes

## API

Portal Application Lifecycle Manager Server provides the following RESTful API endpoints:

### Configuration Endpoints

#### GET /getConfig
Retrieve the current environment configuration.

**Response:**
```json
{
  "configKey1": {
    "type": "url",
    "key": "configKey1",
    "Production": "value1",
    "Staging": "value2",
    "Development": "value3"
  }
}
```

**Status Codes:**
- 200: Success
- 500: Server error

---

#### POST /updateConfig
Update the environment configuration file.

**Request Body:**
```json
{
  "configKey1": {
    "type": "url",
    "key": "configKey1",
    "description": "Configuration description",
    "Production": "new-value1",
    "Staging": "new-value2",
    "Development": "new-value3"
  }
}
```

**Response:**

`Config file updated successfully`

**Status Codes:**
- 200: Success
- 400: Invalid request body
- 500: Server error

---

### Content Management Endpoints

#### POST /cloneContent
Clone ArcGIS content from source to target environment.

**Request Body:**
```json
{
  "sourceEnv": "Development",
  "targetEnv": "Staging",
  "itemId": "1234567890abcdef"
}
```

**Response:**
```json
{
  "result": "Successfully cloned item 1234567890abcdef",
  "timestamp": "2026-08-10T12:00:00.000Z"
}
```

**Status Codes:**
- 200: Success
- 400: Invalid parameters
- 401: Authentication failed
- 500: Server error

---

#### POST /updateContent
Update existing ArcGIS content in target environment.

**Request Body:**
```json
{
  "sourceEnv": "Staging",
  "targetEnv": "Production",
  "sourceId": "1234567890abcdef",
  "targetId": "fedcba0987654321"
}
```

**Response:**
```json
{
  "result": "Successfully updated item fedcba0987654321",
  "timestamp": "2026-08-10T12:00:00.000Z"
}
```

**Status Codes:**
- 200: Success
- 400: Invalid parameters
- 401: Authentication failed
- 404: Item not found
- 500: Server error

---

#### POST /logPromotionAction
Log a promotion activity for audit purposes.

**Request Body:**
```json
{
  "username": "admin@example.com",
  "id": "1234567890abcdef",
  "title": "My ArcGIS App",
  "sourceEnv": "Staging",
  "targetEnv": "Production",
  "success": true
}
```

**Response:**
```json
{
  "message": "Promotion success logged",
  "timestamp": "2026-08-10T12:00:00.000Z"
}
```

**Status Codes:**
- 200: Success
- 400: Invalid log data
- 500: Server error

---

### Error Response Format

Most JSON error responses follow this format:
```json
{
  "error": "Error message describing what went wrong",
  "timestamp": "2026-08-10T12:00:00.000Z"
}
```

Some endpoints (such as configuration file reads/writes) return plain text error messages instead of JSON.

## Contribute

We welcome contributions to Portal Application Lifecycle Manager Server! Here's how you can help:

1. **Report Issues**: Use GitHub Issues to report bugs or request features
2. **Submit Pull Requests**: Fork the repository, make your changes, and submit a PR
3. **Improve Documentation**: Help us improve this README or add code comments
4. **Add Tests**: Improve test coverage for better reliability
5. **Security**: Report security vulnerabilities privately to the maintainers

Please refer to `CONTRIBUTING.md` for detailed guidelines on how to contribute to this project.

## License

This project is licensed under the terms of the Apache 2.0 open source license. Please refer to [LICENSE](LICENSE) for the full terms.
