# TABEZA Agent System MSI Installer Specification

## Overview

This document specifies the MSI installer approach for the TABEZA Agent System, which will be a Windows-based on-premises component that handles print capture, receipt processing, and data synchronization with the cloud system.

## Installer Requirements

### System Requirements
- Windows 10 or Windows Server 2016 (minimum)
- .NET Framework 4.8 or .NET 6+ Runtime
- Administrative privileges for installation
- Network connectivity for cloud synchronization
- Minimum 2GB RAM, 1GB disk space

### Installation Components

#### 1. Windows Service
- **Service Name**: `TabezaAgent`
- **Display Name**: `TABEZA Receipt Processing Agent`
- **Description**: `Captures and processes receipt data for TABEZA cloud synchronization`
- **Start Type**: Automatic
- **Recovery**: Restart service on failure

#### 2. Application Files
```
C:\Program Files\TABEZA\Agent\
├── TabezaAgent.exe              # Main service executable
├── TabezaAgent.exe.config       # Service configuration
├── appsettings.json            # Application settings
├── node_modules\               # Node.js dependencies (if using Node.js)
├── lib\                        # Shared libraries
│   ├── @tabeza-receipt-schema\ # NPM package
│   ├── @tabeza-escpos-parser\  # NPM package
│   └── @tabeza-validation\     # NPM package
└── data\                       # Local data directory
    ├── sqlite\                 # SQLite database files
    ├── logs\                   # Application logs
    └── queue\                  # Sync queue storage
```

#### 3. Configuration Files
- **Registry Settings**: Service configuration and licensing
- **Environment Variables**: Cloud API endpoints, authentication
- **Local Database**: SQLite schema initialization
- **Logging Configuration**: Windows Event Log integration

### Installation Process

#### 1. Pre-Installation Checks
- Verify Windows version compatibility
- Check for existing TABEZA Agent installation
- Validate administrative privileges
- Test network connectivity to cloud endpoints

#### 2. File Installation
- Extract application files to Program Files directory
- Set appropriate file permissions (read/execute for service account)
- Create data directories with write permissions
- Install any required runtime dependencies

#### 3. Service Registration
- Register Windows Service with Service Control Manager
- Configure service account (Local System or custom)
- Set service dependencies (if any)
- Configure service recovery options

#### 4. Database Initialization
- Create SQLite database files
- Run initial schema migration
- Set up database file permissions
- Create backup and maintenance schedules

#### 5. Configuration Setup
- Generate unique agent identifier
- Configure cloud API endpoints
- Set up authentication credentials (if provided)
- Initialize logging configuration

#### 6. Post-Installation Validation
- Start the TABEZA Agent service
- Verify service is running and responsive
- Test cloud connectivity and authentication
- Validate print spooler integration
- Create desktop shortcuts and Start Menu entries

### NPM Package Integration

#### Package Consumption Strategy
The agent will consume shared packages via npm, following this approach:

1. **Production Installation**:
   ```bash
   npm install @tabeza/receipt-schema@latest
   npm install @tabeza/escpos-parser@latest
   npm install @tabeza/validation@latest
   ```

2. **Version Compatibility Checking**:
   - Agent validates schema version on startup
   - Automatic update prompts for compatible versions
   - Graceful degradation for minor version mismatches

3. **Local Development Linking**:
   ```bash
   # For development environments
   npm link @tabeza/receipt-schema
   npm link @tabeza/escpos-parser
   npm link @tabeza/validation
   ```

### Uninstallation Process

#### 1. Service Shutdown
- Stop TABEZA Agent service gracefully
- Wait for pending operations to complete
- Unregister service from Service Control Manager

#### 2. Data Preservation
- Prompt user to backup local data
- Preserve configuration files (optional)
- Export sync queue for manual recovery

#### 3. File Cleanup
- Remove application files from Program Files
- Clean up registry entries
- Remove Start Menu shortcuts
- Preserve user data directories (optional)

## Build Process

### MSI Creation Tools
- **WiX Toolset 4.0+**: Primary MSI creation framework
- **Visual Studio**: Development environment
- **GitHub Actions**: Automated build pipeline

### Build Pipeline
```yaml
# Example GitHub Actions workflow for agent builds
name: Build Agent MSI
on:
  push:
    paths: ['agent/**', 'packages/**']
    
jobs:
  build-msi:
    runs-on: windows-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        
      - name: Setup .NET
        uses: actions/setup-dotnet@v3
        with:
          dotnet-version: '6.0'
          
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm install --production
        
      - name: Build application
        run: dotnet build --configuration Release
        
      - name: Create MSI
        run: |
          wix build -arch x64 -o TabezaAgent.msi
          
      - name: Sign MSI
        run: |
          signtool sign /f certificate.pfx /p ${{ secrets.CERT_PASSWORD }} TabezaAgent.msi
          
      - name: Upload artifact
        uses: actions/upload-artifact@v3
        with:
          name: TabezaAgent-MSI
          path: TabezaAgent.msi
```

### Version Management
- **Semantic Versioning**: Major.Minor.Patch format
- **Build Numbers**: Automatic increment for each build
- **Compatibility Matrix**: Document supported schema versions

## Distribution Strategy

### Release Channels
- **Stable**: Production-ready releases
- **Beta**: Pre-release testing versions
- **Development**: Internal testing builds

### Download Locations
- **Official Website**: Primary download location
- **GitHub Releases**: Open source distribution
- **Partner Portals**: Reseller distribution

### Update Mechanism
- **Automatic Updates**: Optional background updates
- **Manual Updates**: User-initiated update checks
- **Forced Updates**: Critical security updates

## Security Considerations

### Code Signing
- All MSI files must be digitally signed
- Use trusted certificate authority
- Implement timestamp signing for long-term validity

### Installation Security
- Require administrative privileges
- Validate installer integrity before execution
- Implement rollback mechanism for failed installations

### Runtime Security
- Service runs with minimal required privileges
- Encrypt sensitive configuration data
- Implement secure communication with cloud APIs
- Regular security updates and patches

## Testing Strategy

### Installation Testing
- Test on multiple Windows versions
- Validate upgrade scenarios from previous versions
- Test uninstallation and cleanup processes
- Verify service registration and startup

### Functionality Testing
- Print spooler integration testing
- Cloud synchronization testing
- Database operations testing
- Error handling and recovery testing

### Performance Testing
- Service startup time
- Memory and CPU usage monitoring
- Large volume receipt processing
- Network connectivity resilience

## Support and Maintenance

### Logging and Diagnostics
- Windows Event Log integration
- Detailed application logging
- Performance counters
- Remote diagnostic capabilities

### Troubleshooting Tools
- Built-in diagnostic utilities
- Configuration validation tools
- Network connectivity testing
- Database integrity checking

### Documentation
- Installation guide for administrators
- Troubleshooting documentation
- API reference for integration
- Version compatibility matrix