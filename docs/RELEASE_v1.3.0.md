# Release Notes: TabezaConnect v1.3.0

## 📋 Overview

Version 1.3.0 brings critical improvements to installation reliability and compliance, ensuring venues can deploy the POS integration service smoothly.

---

## ✨ What's New

### Enhanced Installation Reliability
Improved Windows compatibility with better handling of administrator privileges and security software interactions.

### Terms & Conditions Compliance
Added required acceptance of Terms of Service and Privacy Policy during installation, with scroll-to-accept functionality.

### Consistent Branding
Updated all user-facing elements to display "TabezaConnect" for professional consistency.

### Improved Configuration
Enhanced Bar ID input with validation to prevent common setup errors.

---

## 🔧 Installation

1. **Download** the installer: `TabezaConnect-Setup-v1.3.0.exe`
2. **Right-click** and select **"Run as administrator"**
3. **Review** the Terms of Service and Privacy Policy (scroll to bottom)
4. **Accept** the agreement to continue
5. **Enter** your Bar ID when prompted
6. **Complete** the installation wizard

---

## ⚙️ System Requirements

- **Operating System**: Windows 10 or Windows 11 (64-bit)
- **Privileges**: Administrator rights required
- **Disk Space**: 100MB free space
- **Network**: Internet connection for receipt upload

---

## ⚠️ Important Notes

### Antivirus Software
Some security software may flag the installer due to system-level operations. This is a false positive. For smooth installation:

- Temporarily disable real-time protection during install
- Or add the installer to your antivirus exclusions
- See installation advisory for detailed instructions

### First-Time Setup
After installation:
1. Verify the service is running in Windows Services (`services.msc`)
2. Check that your Bar ID is correctly configured
3. Test with a sample receipt print from your POS

---

## 🐛 Bug Fixes

- Fixed "Error 5: Access is denied" during installation
- Resolved issues with temporary directory permissions
- Corrected service display name inconsistencies

---

## 📚 Documentation

- **Installation Advisory**: See `TABEZACONNECT_INSTALLATION_ADVISORY.md` for antivirus guidance
- **Terms & Privacy**: Full document available at installation and in `src/installer/TERMS_AND_PRIVACY.txt`
- **Support**: Contact support@tabeza.co.ke for assistance

---

## 🔄 Upgrading from v1.2.0

1. Uninstall the previous version via Windows Settings
2. Download and install v1.3.0 following the steps above
3. Re-enter your Bar ID during setup
4. Service will automatically start after installation

---

## 🆘 Troubleshooting

**Installation blocked by antivirus?**  
See the installation advisory document for step-by-step instructions for major antivirus software.

**Service won't start?**  
Check Windows Event Viewer (Application logs) for detailed error messages.

**Bar ID validation fails?**  
Ensure your Bar ID is at least 8 characters and contains no spaces.

**Still having issues?**  
Email support@tabeza.co.ke with your Bar ID and error details.

---

## 🔐 Security

- Service runs with Local System privileges (required for print monitoring)
- Data transmission encrypted via HTTPS
- No sensitive customer data collected
- Print operations remain unaffected by the service

---

## 📞 Support

**Email**: support@tabeza.co.ke  
**Dashboard**: https://tabeza.co.ke  
**Hours**: Monday-Friday, 8 AM - 6 PM EAT

---

## 🙏 Thank You

Thank you for using TabezaConnect. We're committed to making your venue operations smoother and more efficient.

---

**Release Date**: February 2026  
**Version**: 1.3.0  
**Build**: Stable
