# Tabeza Connect Installer

This directory contains the Windows installer infrastructure for Tabeza Connect.

## Structure

```
installer/
├── scripts/              # PowerShell configuration scripts
│   ├── configure-printer.ps1
│   ├── register-service.ps1
│   ├── create-folders.ps1
│   └── detect-printers.ps1
├── inno-setup/          # Inno Setup installer configuration
│   ├── tabeza-setup.iss
│   └── license.txt
├── nodejs-bundle/       # Bundled Node.js runtime (downloaded during build)
└── assets/              # Icons and resources
```

## Build Process

1. Download portable Node.js v18.19.0
2. Bundle printer service code
3. Create Inno Setup installer
4. Sign with EV certificate (production only)

## Requirements

- Inno Setup 6.x
- Node.js 18.x (for building)
- EV Code Signing Certificate (production)

## Usage

```bash
# Build installer
npm run build:installer

# Build and sign (requires certificate)
npm run build:installer:signed
```
