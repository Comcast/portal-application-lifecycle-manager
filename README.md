# Portal Application Lifecycle Manager

Portal Application Lifecycle Manager is an application lifecycle platform for ArcGIS Enterprise content. It helps teams keep web applications and web maps consistent across Development, Staging, and Production environments while still supporting expected environment-specific differences such as portal URLs, service endpoints, and configuration values.

The project solves a common operational problem: teams often need to compare and promote content between environments, but manual checks are slow, error-prone, and difficult to audit. This repository provides a structured workflow that combines visual comparison, controlled configuration, and promotion automation.

At a high level, users authenticate to target portals, select content to inspect or promote, and run environment-aware operations through the client application. The client calls server APIs that handle configuration storage, promotion-related operations, and activity logging. Together, the two components provide safer and more repeatable releases for GIS applications.

Portal Application Lifecycle Manager is organized as a monorepo with two primary projects:

- `client`: React frontend for comparing, configuring, and promoting ArcGIS content across environments
- `server`: Node.js backend API and automation layer used by the client

## How the Platform Works

1. Discover and compare

Users search by item identifiers or names and compare content across selected environments. Differences are surfaced so teams can separate expected variation from unexpected drift.

2. Define expected differences

Teams maintain environment-specific rules and values that describe legitimate differences between environments. This reduces noise and improves decision confidence.

3. Promote with controls

Authorized users promote applications and related dependencies from source to target environments using server-backed operations.

4. Track and audit actions

Promotion and update actions are logged by server services to support traceability, troubleshooting, and operational governance.

## Architecture Overview

- Client responsibilities:
  - Authentication flow and user experience
  - Comparison views and interactive configuration editing
  - Promotion requests and status display

- Server responsibilities:
  - Configuration read/write endpoints
  - Promotion and content operation orchestration
  - Validation, logging, and backend integration points

- Shared objective:
  - Deliver consistent ArcGIS application behavior across environments while minimizing manual deployment risk

## Components

### Client (`client/`)

The client is a React application that enables users to:

- Compare ArcGIS applications and web maps between environments
- Edit environment-specific configuration expectations
- Promote content between environments (with appropriate permissions)

See detailed client documentation in `client/README.md`.

### Server (`server/`)

The server is a Node.js API service that:

- Manages configuration data
- Executes content operations and promotion workflows
- Logs promotion actions for auditing

See detailed server documentation in `server/README.md`.


## Contribute

We welcome contributions to Portal Application Lifecycle Manager! Here's how you can help:

1. **Report Issues**: Use GitHub Issues to report bugs or request features
2. **Submit Pull Requests**: Fork the repository, make your changes, and submit a PR
3. **Improve Documentation**: Help us improve this README or add code comments
4. **Add Tests**: Improve test coverage for better reliability
5. **Security**: Report security vulnerabilities privately to the maintainers

Please refer to `CONTRIBUTING.md` for detailed guidelines on how to contribute to this project.

## License

This project is licensed under the terms of the Apache 2.0 open source license. Please refer to [LICENSE](LICENSE) for the full terms.
