# Tabeza Connect Installer

This directory contains the Windows installer infrastructure for Tabeza Connect.

## Structure

```
installer/
├── scripts/              # PowerShell configuration scripts
│   ├── configure-printer.ps1
│   ├── configure-clawpdf.ps1
│   ├── install-clawpdf.ps1
│   ├── verify-clawpdf-bundle.ps1
│   ├── register-service.ps1
│   ├── create-folders.ps1
│   └── detect-printers.ps1
├── resources/           # Bundled resources
│   └── clawpdf/        # ClawPDF MSI installer (MANUAL DOWNLOAD REQUIRED)
│       ├── README.md
│       ├── LICENSE.txt
│       └── clawPDF-0.9.3-setup.msi  # Download from GitHub releases
├── inno-setup/          # Inno Setup installer configuration
│   ├── tabeza-setup.iss
│   └── license.txt
├── nodejs-bundle/       # Bundled Node.js runtime (downloaded during build)
└── assets/              # Icons and resources
```

## Prerequisites

### Required Manual Download

**⚠️ IMPORTANT:** Before building the installer, you must manually download the clawPDF MSI installer.

1. Download `clawPDF-0.9.3-setup.msi` from:
   https://github.com/clawsoftware/clawPDF/releases/download/v0.9.3/clawPDF-0.9.3-setup.msi

2. Place it in: `src/installer/resources/clawpdf/`

3. Verify the bundle:
   ```powershell
   .\src\installer\scripts\verify-clawpdf-bundle.ps1
   ```

**See [ClawPDF Bundling Guide](../../docs/installer/CLAWPDF-BUNDLING-GUIDE.md) for detailed instructions.**

## Build Process

1. **Download clawPDF MSI** (manual step - see above)
2. Download portable Node.js v18.19.0
3. Bundle printer service code
4. Bundle clawPDF MSI installer
5. Create Inno Setup installer
6. Sign with EV certificate (production only)

## Requirements

- Inno Setup 6.x
- Node.js 18.x (for building)
- ClawPDF 0.9.3 MSI (manual download)
- EV Code Signing Certificate (production)

## Usage

```bash
# Build installer
npm run build:installer

# Build and sign (requires certificate)
npm run build:installer:signed
```
