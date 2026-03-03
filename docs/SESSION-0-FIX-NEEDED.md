# Session 0 Isolation Fix - Next Steps

## Current Status
Your `final-bridge.js` v4.2 uses **WritePrinter via WinAPI** (Strategy 3 only).

This works in normal user sessions but **fails in Session 0** (Windows Service running as SYSTEM) because:
- Service is in Session 0 (isolated)
- Printer drivers/USB context is in Session 1 (user desktop)
- WritePrinter succeeds but bytes never reach hardware → "local comm error"

## The Real Fix: 3-Strategy Dispatcher

### Strategy 1: TCP Direct (Port 9100)
**When**: Printer port is an IP address or TCP port  
**How**: Raw socket connection, write ESC/POS bytes directly  
**Why it works**: Session 0 has no restrictions on TCP sockets

```javascript
async function tryTcpDirect(printerPort, data) {
    // Parse IP:port from printer port name
    const match = printerPort.match(/(\d+\.\d+\.\d+\.\d+):?(\d+)?/);
    if (!match) return null;
    
    const host = match[1];
    const port = parseInt(match[2] || '9100');
    
    return new Promise((resolve, reject) => {
        const net = require('net');
        const socket = net.connect(port, host, () => {
            socket.write(data, (err) => {
                socket.end();
                if (err) reject(err);
                else resolve();
            });
        });
        socket.on('error', reject);
        socket.setTimeout(10000, () => {
            socket.destroy();
            reject(new Error('TCP timeout'));
        });
    });
}
```

### Strategy 2: Direct Port File Write
**When**: Printer port is COM3, USB001, LPT1, etc.  
**How**: Open port as FileStream, write bytes directly to driver  
**Why it works**: Bypasses spooler session boundary, goes device-driver → hardware

```javascript
async function tryDirectPortWrite(printerPort, data) {
    // Normalize port name
    const portPath = printerPort.startsWith('\\\\.\\') 
        ? printerPort 
        : `\\\\.\\${printerPort}`;
    
    return new Promise((resolve, reject) => {
        fs.open(portPath, 'w', (err, fd) => {
            if (err) return reject(err);
            
            fs.write(fd, data, 0, data.length, (writeErr) => {
                fs.close(fd, () => {});
                if (writeErr) reject(writeErr);
                else resolve();
            });
        });
    });
}
```

### Strategy 3: Spooler Fallback (Current Implementation)
**When**: Strategies 1 & 2 fail  
**How**: WritePrinter via WinAPI (your current code)  
**Why it's last**: Only works if service runs as a real user account (not SYSTEM)

## Implementation Plan

### Step 1: Get Printer Port Name
Before forwarding, query the printer port:

```javascript
function getPrinterPort(printerName) {
    try {
        const cmd = `powershell -NoProfile -Command "(Get-Printer -Name '${printerName}').PortName"`;
        const port = execSync(cmd, { timeout: 5000, encoding: 'utf8' }).trim();
        return port;
    } catch (err) {
        console.warn('Could not get printer port:', err.message);
        return null;
    }
}
```

### Step 2: Dispatcher Logic
```javascript
async forwardToPhysicalPrinter(data) {
    const printerName = this.config.bridge.printerName;
    const printerPort = getPrinterPort(printerName);
    
    console.log(`🖨️  Printer: "${printerName}" | Port: "${printerPort}"`);
    
    // Strategy 1: TCP direct
    if (printerPort && printerPort.match(/\d+\.\d+\.\d+\.\d+/)) {
        try {
            await tryTcpDirect(printerPort, data);
            console.log('✅ Printed via TCP direct');
            return;
        } catch (err) {
            console.warn('⚠️  TCP direct failed:', err.message);
        }
    }
    
    // Strategy 2: Direct port write
    if (printerPort && /^(COM|USB|LPT)\d+/i.test(printerPort)) {
        try {
            await tryDirectPortWrite(printerPort, data);
            console.log('✅ Printed via direct port write');
            return;
        } catch (err) {
            console.warn('⚠️  Direct port write failed:', err.message);
        }
    }
    
    // Strategy 3: Spooler fallback (your current WritePrinter code)
    console.log('⚠️  Falling back to spooler (WritePrinter)...');
    await this.forwardViaWritePrinter(data);
}
```

## Alternative Quick Fix

If you don't want to implement all 3 strategies now, the **simplest fix** is:

**Change the service login from SYSTEM to a real user account:**

1. Open `services.msc`
2. Find "TabezaConnect" service
3. Right-click → Properties → Log On tab
4. Change from "Local System account" to "This account"
5. Enter a local admin user account
6. Restart service

This puts the service in Session 1 where WritePrinter works normally.

## Recommendation

For v1.6.3:
- Build with current code (WritePrinter only)
- Document the service account workaround
- Plan v1.7.0 with full 3-strategy implementation

For production robustness:
- Implement all 3 strategies
- Most POS printers use TCP or direct port anyway
- Spooler becomes the fallback, not the primary method
