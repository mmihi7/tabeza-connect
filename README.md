# Tabeza Connect

> Windows installer for seamless POS integration with Tabeza cloud

Tabeza Connect bridges your existing POS system with Tabeza's digital receipt platform, enabling automatic receipt capture and cloud synchronization without modifying your POS workflow.

## Features

- ✅ **Zero POS Modification**: Works with any POS that can print
- ✅ **Dual-Printer Architecture**: Physical printer continues working independently
- ✅ **Automatic Receipt Capture**: Monitors virtual printer output
- ✅ **Offline-First**: Queues receipts when internet is unavailable
- ✅ **Self-Healing**: Automatically recovers from common failures
- ✅ **2-Minute Installation**: Customer-friendly setup wizard

## System Requirements

- Windows 10 or later
- Administrator privileges (for installation only)
- 100 MB free disk space
- Internet connectivity (for cloud sync)

## Quick Start

### For End Users

1. Download `TabezaConnect-Setup.zip` from [Releases](https://github.com/billoapp/TabezaConnect/releases)
2. Extract to a temporary location
3. Right-click `install.bat` and select "Run as administrator"
4. Follow the installation wizard
5. Configure your POS to print to "Tabeza Receipt Printer"

See [Installation Guide](docs/INSTALLATION.md) for detailed instructions.

### For Developers

```bash
# Clone repository
git clone https://github.com/billoapp/TabezaConnect.git
cd TabezaConnect

# Install dependencies
npm install
cd src/service && npm install && cd ../..

# Build installer
npm run build

# Output: dist/TabezaConnect-Setup-v1.0.0.zip
```

## Architecture

Tabeza Connect consists of three components:

1. **Printer Service**: Node.js service that monitors watch folder
2. **Virtual Printer**: Generic/Text Only printer with Local Port
3. **Installer**: Automated setup with bundled Node.js runtime

See [Architecture Documentation](docs/ARCHITECTURE.md) for details.

## Documentation

- [Installation Guide](docs/INSTALLATION.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Architecture Overview](docs/ARCHITECTURE.md)

## Support

- Email: support@tabeza.co.ke
- Website: https://tabeza.co.ke
- Issues: https://github.com/billoapp/TabezaConnect/issues

## License

MIT License - see [LICENSE](LICENSE) for details

## Related Projects

- [Tabeza Platform](https://github.com/billoapp/tabeza) - Main Tabeza application
- [Tabeza Docs](https://docs.tabeza.co.ke) - Complete documentation

---

Made with ❤️ by the Tabeza team
