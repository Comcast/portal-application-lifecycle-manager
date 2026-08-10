# Portal Application Lifecycle Manager

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

Portal Application Lifecycle Manager is a React web application designed to ensure consistency of ArcGIS applications across multiple environments (Development, Staging, and Production). Managing enterprise geospatial applications across different environments presents unique challenges - applications must maintain functionality while adapting to environment-specific configurations such as different service URLs, portal endpoints, and authentication settings.

Portal Application Lifecycle Manager addresses this challenge by providing tools to:

1. **Compare** - Enable users to compare ArcGIS application information across multiple environments by id, title, or other configurable fields. Identify differences at the application, web map, and service levels.

2. **Configure** - Allow users to edit configuration files that define expected differences between environments. This ensures that only unexpected differences are flagged, reducing noise and focusing attention on actual issues.

3. **Promote** - Enable users with sufficient privileges to promote applications from one environment to another, ensuring consistency and reducing manual deployment errors.

**Who is this for?**

Portal Application Lifecycle Manager is designed for GIS administrators, DevOps teams, and developers who manage ArcGIS Enterprise applications across multiple environments and need to maintain consistency while accounting for legitimate environment-specific differences.

**What makes Portal Application Lifecycle Manager different?**

Unlike manual comparison or generic deployment tools, Portal Application Lifecycle Manager understands the structure of ArcGIS applications and can intelligently compare web maps, services, and configuration values while accounting for expected environment differences.

## Install

If you've never used git before, please take a moment to familiarize yourself with what it is and how it works. To install this project, you'll need to have git, Node.js (v18 or higher), and npm installed on your local development environment.

### Prerequisites

- Node.js (v18 or higher)
- npm (v9 or higher)
- Git
- Access to ArcGIS Enterprise portals

### Installation Steps

1. Clone the monorepo:
```bash
git clone https://github.com/Comcast/portal-application-lifecycle-manager.git
cd portal-application-lifecycle-manager/client
```

2. Install dependencies:
```bash
npm install
```

3. Install the companion server component:
```bash
cd ../server
npm install
```

## Configuration

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```bash
VITE_PALM_ENV=LOCAL  # Options: LOCAL, DEV, STG, PROD
```

### Portal Configuration

Update the portal configuration in `src/config.js`:

```javascript
export const portalList = {
    'Production': {
        'url': 'https://your-production-portal.com/arcgis/sharing/rest',
        'clientid': 'your-client-id',
        'canPublish': true
    },
    'Staging': {
        'url': 'https://your-staging-portal.com/arcgis/sharing/rest',
        'clientid': 'your-client-id',
        'canPublish': true
    },
    'Development': {
        'url': 'https://your-dev-portal.com/arcgis/sharing/rest',
        'clientid': 'your-client-id',
        'canPublish': true
    }
};
```

### Server Configuration

Configure the server endpoints in `server/config/env-config.json` with your environment-specific settings.

## Usage

### Starting the Application

1. Start the server (from the `server` directory):
```bash
node server.js
```

2. Start the React application (from the `client` directory):
```bash
npm run dev
```

The application will open in your browser at `http://localhost:5173`.

### Comparing Applications

1. Select the search type (Applications or Web Maps)
2. Choose environments to compare (up to three)
3. Search by Item ID or Title
4. Click "Compare" to see differences highlighted in the grid

### Editing Configuration

1. Navigate to the "Edit Config" tab
2. Load the current configuration
3. Add, edit, or remove configuration entries
4. Save changes to update environment-specific expected values

### Promoting Content

1. Select source and target environments
2. Choose the application to promote
3. Select associated web maps (if applicable)
4. Click "Promote" to copy content to the target environment

## Security

### Authentication

Portal Application Lifecycle Manager uses OAuth2 authentication with ArcGIS Enterprise portals. Users must authenticate with each portal they wish to access. Authentication tokens are stored in browser sessionStorage and managed by the ArcGIS REST JS SDK.

### Permissions

- **Read access**: All authenticated users can compare applications
- **Write access**: Users with `canPublish` privileges can promote applications and edit configurations
- **Portal permissions**: Users must have appropriate permissions in both source and target portals to promote content

### Best Practices

- Always test promotions in lower environments before promoting to production
- Review comparison results thoroughly before promoting
- Maintain up-to-date configuration files to minimize false-positive differences

## API

Portal Application Lifecycle Manager communicates with a Node.js backend server that provides the following endpoints:

### Configuration Endpoints

- `GET /getConfig` - Retrieve current configuration
- `POST /updateConfig` - Update configuration settings

### Content Management Endpoints

- `POST /cloneContent` - Clone content between environments
- `POST /updateContent` - Update existing content
- `POST /logPromotionAction` - Log promotion activities

All API endpoints require valid portal authentication tokens. See the `server/README.md` documentation for detailed API information.

## Contribute

We welcome contributions to Portal Application Lifecycle Manager! Here's how you can help:

1. **Report Issues**: Use GitHub Issues to report bugs or request features
2. **Submit Pull Requests**: Fork the repository, make your changes, and submit a PR
3. **Improve Documentation**: Help us improve this README or add code comments
4. **Share Feedback**: Let us know how you're using Portal Application Lifecycle Manager and what improvements you'd like to see

Please refer to `CONTRIBUTING.md` for detailed guidelines on how to contribute to this project.

## License

This project is licensed under the terms of the Apache 2.0 open source license. Please refer to [LICENSE](LICENSE) for the full terms.
