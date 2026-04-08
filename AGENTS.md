# Tabeza Connect – Agents Guide

## Overview
Tabeza Connect is a Windows agent that bridges POS systems to the Tabeza digital receipt platform. Using REDMON port monitoring, it intercepts print jobs without interfering with existing printing, processes raw ESC/POS data via capture.exe, and forwards receipts to physical printers via the Windows Print API. Parsed receipt data is uploaded as structured JSON to the cloud. Designed as a set‑and‑forget service, it runs as a Windows Service with automatic startup, offline‑first queuing, and zero ongoing operator attention.

## Architecture Highlights
- **Capture**: REDMON port monitor writes raw ESC/POS data to `C:\TabezaPrints\raw\*.prn`
- **Processing**: SpoolWatcher detects new files, strips control bytes, parses with regex template (`template.json`)
- **Queue**: Parsed receipts are stored as JSON files in `queue\pending\`; an independent upload worker sends them to the cloud with exponential backoff retry
- **Physical Printing**: WindowsPrinterConnection uses the Windows Print API to forward jobs to configured thermal printers
- **Management UI**: Express server on `localhost:8765` provides dashboard, template generator, and configuration
- **System Tray**: Lightweight tray icon shows status and offers quick access to UI and logs

## Development Environment Setup
### Prerequisites
- Node.js 18+
- Windows 10/11 (development can be done on any OS but testing requires Windows)
- Git

### Installation
1. Clone the repository.
2. Run `npm install` to install dependencies.
3. Run `npm run rebuild` to rebuild native modules for Electron.

### Configuration
- Copy `config.template.json` to `C:\TabezaPrints\config.json` (created automatically by installer)
- Set `barId` and `apiUrl` as needed for testing.

## Building the Project
- **Development**: `npm start` launches the Electron app with DevTools.
- **Build Installer**: `npm run build:installer` creates the Inno Setup installer (bundles REDMON port monitor and Windows Print API components).
- **Portable Executable**: `npm run build:portable` builds a standalone `.exe`.
- **All Targets**: `npm run build:all` produces both installer and portable versions.

## Testing
- **Unit Tests**: `npm test` runs Jest tests in the `__tests__` directory.
- **Manual Testing**: Use the provided PowerShell scripts (`test-*.ps1`) to verify printer discovery, REDMON configuration, and print forwarding.
- **Integration Testing**: Deploy the built installer on a clean Windows VM and follow the production readiness checklist in `GUIDE.md`.

## Code Conventions & Best Practices
- **JavaScript/Node.js**: Follow the existing code style (ES6 modules, async/await, error‑first callbacks).
- **Error Handling**: Always wrap external calls (file I/O, network) in try/catch and log errors with context.
- **Logging**: Use the configured logger (`service.log`); include timestamps and severity levels. All logs are stored in `C:\TabezaPrints\logs\`. The system tray icon provides a “View Logs” option for customer‑friendly access.
- **Windows‑specific Code**: When interacting with printers or ports, rely on the Windows Print API or REDMON; avoid direct USB communication.
- **Configuration**: Never hardcode paths; use `TABEZA_WATCH_FOLDER` environment variable or the config file.
- **Security**: The HTTP API must bind to `127.0.0.1` only; no external network exposure.

## Making Changes
### Modifying Core Logic
1. Identify the relevant module (`src/service/` for background service, `src/ui/` for management UI).
2. Make changes incrementally and ensure existing tests pass.
3. Update the `ARCHITECTURE.md` document if the change affects the system design.

### Updating the Installer
- The installer script is `src/installer/TabezaConnect.iss` (Inno Setup).
- PowerShell helper scripts are in `src/installer/scripts/`.
- After any installer change, run a full build and test installation on a clean VM.

### Handling Windows‑specific Components
- REDMON configuration is managed by `printer-pooling-setup.ps1`.
- Windows Service registration uses `register-service-pkg.ps1`.
- Always verify that changes do not break the service’s ability to run under the `LocalService` account.

## Deployment
1. Build the installer with `npm run build:installer`.
2. Distribute `dist/TabezaConnect‑Setup‑<version>.exe`.
3. The installer will:
   - Create `C:\TabezaPrints\` folder structure (including a single `logs` folder)
   - Install and configure REDMON port monitoring
   - Register the Windows Service
   - Start the service and open the management UI for template setup

**Service‑instance protection**: The Windows Service ensures only one instance runs at a time; duplicate instances are prevented by the service manager.

**Seamless upgrades**: The installer is designed for seamless upgrades—it stops the existing service, updates files, and restarts the service while preserving the queue and configuration.

## Troubleshooting Common Issues
- **Printer not detected**: Run `test‑printer‑discovery.ps1` to verify Windows Print API visibility.
- **REDMON not capturing**: Check `C:\TabezaPrints\raw\` for new `.prn` files; use `redmon‑diagnostic.ps1`.
- **Service fails to start**: Examine `C:\TabezaPrints\logs\service.log` for errors.
- **Upload queue stalled**: Verify internet connectivity and cloud API endpoint; check `queue\pending\` for stuck files.
- **Configuration errors**: Ensure `config.json` is valid JSON and contains required `barId`.

## Contributing Guidelines
- **Commit Messages**: Follow conventional commit format (`feat:`, `fix:`, `docs:`, `chore:`).
- **Branching**: Create a feature branch from `main`; submit a pull request for review.
- **Code Review**: All changes must be reviewed by at least one other team member.
- **Documentation**: Update relevant `.md` files (especially `ARCHITECTURE.md`, `GUIDE.md`, and this guide) when adding or modifying features.

## Resources
- [Architecture Reference](ARCHITECTURE.md) – detailed system design and data flows
- [Production Readiness Guide](GUIDE.md) – deployment checklist and monitoring
- [README](README.md) – user‑focused installation and usage
- [Third‑Party Licenses](README.md#third‑party‑software) – clawPDF AGPL‑3.0 compliance

---

*This guide is intended for developers and AI agents working on the Tabeza Connect codebase. Keep it updated as the project evolves.*