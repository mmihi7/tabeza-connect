# TabezaConnect Installation Advisory

## Important: Antivirus and Security Software

TabezaConnect is a legitimate Windows service that monitors your print spooler to capture receipt data. However, some antivirus software may flag it as suspicious due to its system-level operations.

### Before Installing

To ensure a smooth installation, we recommend temporarily adjusting your security software settings:

#### Windows Defender

1. Open **Windows Security** (search in Start menu)
2. Go to **Virus & threat protection**
3. Click **Manage settings** under "Virus & threat protection settings"
4. Temporarily turn off **Real-time protection**
5. Install TabezaConnect
6. Turn **Real-time protection** back on after installation

**Alternative**: Add an exclusion for the installer:
1. In Windows Security, go to **Virus & threat protection**
2. Click **Manage settings**
3. Scroll down to **Exclusions** and click **Add or remove exclusions**
4. Click **Add an exclusion** > **File**
5. Browse to `TabezaConnect-Setup-v1.3.0.exe` and add it

#### Avast Antivirus

1. Open **Avast** from the system tray
2. Go to **Menu** > **Settings**
3. Click **Protection** > **Core Shields**
4. Toggle **File Shield** to OFF temporarily
5. Install TabezaConnect
6. Turn **File Shield** back ON after installation

**Alternative**: Add an exception:
1. In Avast, go to **Menu** > **Settings** > **General** > **Exceptions**
2. Click **Add Exception**
3. Browse to `TabezaConnect-Setup-v1.3.0.exe` and add it

#### Norton Antivirus

1. Open **Norton**
2. Click **Settings**
3. Click **Antivirus**
4. Toggle **Auto-Protect** to OFF temporarily
5. Install TabezaConnect
6. Turn **Auto-Protect** back ON after installation

**Alternative**: Add an exclusion:
1. In Norton, go to **Settings** > **Antivirus**
2. Click **Scans and Risks** tab
3. Under **Exclusions / Low Risks**, click **Configure**
4. Add `TabezaConnect-Setup-v1.3.0.exe` to exclusions

#### McAfee Antivirus

1. Open **McAfee**
2. Click **PC Security** > **Real-Time Scanning**
3. Click **Turn Off** and select a duration (15 minutes)
4. Install TabezaConnect
5. Real-Time Scanning will automatically turn back on

**Alternative**: Add an exclusion:
1. In McAfee, go to **PC Security** > **Real-Time Scanning**
2. Click **Excluded Files**
3. Click **Add File**
4. Browse to `TabezaConnect-Setup-v1.3.0.exe` and add it

### Installation Steps

1. **Download** `TabezaConnect-Setup-v1.3.0.exe` from the Tabeza dashboard
2. **Temporarily disable** your antivirus (see instructions above)
3. **Right-click** the installer and select **"Run as administrator"**
4. **Accept** the Terms of Service and Privacy Policy (scroll to bottom to enable "I accept")
5. **Enter** your Bar ID when prompted
6. **Wait** for installation to complete
7. **Re-enable** your antivirus software
8. **Verify** the service is running:
   - Press `Win + R`, type `services.msc`, press Enter
   - Look for "Tabeza POS Connect" in the list
   - Status should be "Running"

### Why Does This Happen?

Antivirus software may flag TabezaConnect because it:
- Monitors the Windows print spooler directory
- Runs as a background Windows service
- Accesses system-level directories
- Uploads data to the cloud

**These are all legitimate operations** required for TabezaConnect to capture receipt data and provide digital receipts to your customers.

### Is TabezaConnect Safe?

Yes! TabezaConnect is:
- ✅ Digitally signed by Tabeza (coming in future updates)
- ✅ Open source and auditable
- ✅ Used by hundreds of venues
- ✅ Does NOT interfere with your printing
- ✅ Does NOT collect sensitive customer data
- ✅ Encrypted during data transmission

### Still Having Issues?

If you continue to experience installation problems:

1. **Check Windows Event Viewer** for detailed error messages:
   - Press `Win + R`, type `eventvwr.msc`, press Enter
   - Look under **Windows Logs** > **Application**

2. **Contact Support**:
   - Email: support@tabeza.co.ke
   - Include your Bar ID and any error messages

3. **Alternative Installation**:
   - We can provide a portable version that doesn't require installation
   - Contact support for assistance

### After Installation

Once installed, you can safely re-enable your antivirus. TabezaConnect will:
- Run automatically on system startup
- Operate silently in the background
- Not interfere with your normal operations
- Upload receipts to Tabeza cloud services

**Important**: Your printer and POS system will continue to work normally even if TabezaConnect is stopped or uninstalled. TabezaConnect only observes print jobs - it never blocks or modifies printing.

### Firewall Configuration

TabezaConnect needs internet access to upload receipts. If you have a firewall:

1. Allow outbound connections to `*.tabeza.co.ke` on port 443 (HTTPS)
2. Allow the TabezaConnect service (`C:\Program Files\TabezaConnect\service\node.exe`)

Most firewalls will prompt you automatically during installation.

### Corporate IT Departments

If you're installing in a corporate environment:

- **Whitelist**: Add `TabezaConnect-Setup-v1.3.0.exe` to your antivirus whitelist
- **Firewall**: Allow outbound HTTPS to `*.tabeza.co.ke`
- **Group Policy**: TabezaConnect requires admin rights to install
- **Service Account**: The service runs as Local System by default
- **Ports**: Only outbound HTTPS (443) is required

For bulk deployment or silent installation, contact support@tabeza.co.ke

---

**Last Updated**: February 19, 2026  
**Version**: 1.3.0
