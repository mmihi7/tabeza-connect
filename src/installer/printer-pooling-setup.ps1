param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("Install", "Uninstall", "Check", "ListPrinters", "CreateFolders")]
    [string]$Action,
    
    [string]$PhysicalPrinterName = "",
    [string]$CaptureFilePath = "C:\TabezaPrints\order.prn",
    [switch]$Silent
)

$ErrorActionPreference = "Stop"
$PORT_NAME = "C:\TabezaPrints\order.prn"
$POOLED_PRINTER_NAME = "Tabeza POS Printer"
$TABEZA_PRINTS_DIR = "C:\TabezaPrints"

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp][$Level] $Message"
    Write-Host $logMessage
    
    $logDir = "$TABEZA_PRINTS_DIR\logs"
    if (-not (Test-Path $logDir)) {
        New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    }
    Add-Content -Path "$logDir\printer-setup.log" -Value $logMessage
}

function Initialize-TabezaPrintsFolder {
    Write-Log "Initializing TabezaPrints folder structure..."
    
    $foldersCreated = 0
    $foldersExisting = 0
    $filesCreated = 0
    
    $directories = @(
        $TABEZA_PRINTS_DIR,
        "$TABEZA_PRINTS_DIR\processed",
        "$TABEZA_PRINTS_DIR\failed",
        "$TABEZA_PRINTS_DIR\logs",
        "$TABEZA_PRINTS_DIR\queue",
        "$TABEZA_PRINTS_DIR\queue\pending",
        "$TABEZA_PRINTS_DIR\queue\uploaded",
        "$TABEZA_PRINTS_DIR\templates"
    )
    
    foreach ($dir in $directories) {
        if (-not (Test-Path $dir)) {
            try {
                New-Item -ItemType Directory -Path $dir -Force | Out-Null
                Write-Log "Created: $dir"
                $foldersCreated++
            }
            catch {
                Write-Log "Failed to create: $dir - $_" -Level "ERROR"
            }
        }
        else {
            $foldersExisting++
        }
    }
    
    $captureFile = "$TABEZA_PRINTS_DIR\order.prn"
    if (-not (Test-Path $captureFile)) {
        try {
            New-Item -ItemType File -Path $captureFile -Force | Out-Null
            Write-Log "Created: $captureFile"
            $filesCreated++
        }
        catch {
            Write-Log "Failed to create: $captureFile - $_" -Level "ERROR"
        }
    }
    
    $configFile = "$TABEZA_PRINTS_DIR\config.json"
    if (-not (Test-Path $configFile)) {
        try {
            $defaultConfig = @{
                barId = ""
                apiUrl = "https://tabeza.co.ke"
                watchFolder = $TABEZA_PRINTS_DIR
                httpPort = 8765
            }
            $defaultConfig | ConvertTo-Json -Depth 10 | Set-Content -Path $configFile -Encoding UTF8
            Write-Log "Created: $configFile"
            $filesCreated++
        }
        catch {
            Write-Log "Failed to create: $configFile - $_" -Level "ERROR"
        }
    }
    
    try {
        $acl = Get-Acl -Path $TABEZA_PRINTS_DIR
        $permission = "Everyone", "FullControl", "ContainerInherit,ObjectInherit", "None", "Allow"
        $accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule $permission
        $acl.SetAccessRule($accessRule)
        Set-Acl -Path $TABEZA_PRINTS_DIR -AclObject $acl
        Write-Log "Set permissions on $TABEZA_PRINTS_DIR"
    }
    catch {
        Write-Log "Could not set permissions: $_" -Level "WARN"
    }
    
    return @{
        Success = $true
        DirectoriesCreated = $foldersCreated
        DirectoriesExisting = $foldersExisting
        FilesCreated = $filesCreated
        Path = $TABEZA_PRINTS_DIR
    }
}

function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-ReceiptPrinters {
    $printers = Get-Printer | Where-Object { 
        $_.Name -notmatch "Microsoft.*PDF|XPS|OneNote|Fax|Tabeza|AnyDesk|TeamViewer|Remote|Virtual" -and
        $_.PortName -ne "FILE:" -and
        $_.PortName -notmatch "^AD_|^TS\d+:" -and
        ![string]::IsNullOrWhiteSpace($_.PortName)
    } | Sort-Object Name
    
    return $printers
}

function Get-PrinterPort {
    param([string]$PrinterName)
    
    $printer = Get-Printer -Name $PrinterName -ErrorAction SilentlyContinue
    if ($printer) {
        return $printer.PortName
    }
    return $null
}

function New-CapturePort {
    Write-Log "Creating capture port: $PORT_NAME"
    
    Initialize-TabezaPrintsFolder | Out-Null
    
    $existingPort = Get-PrinterPort -Name $PORT_NAME -ErrorAction SilentlyContinue
    if ($existingPort) {
        Write-Log "Port $PORT_NAME already exists" -Level "WARN"
        return $true
    }
    
    try {
        # Stop the Print Spooler
        Stop-Service -Name Spooler -Force
        Write-Log "Print Spooler stopped"
        
        # Create Local Port via registry
        # CRITICAL: Port name MUST be the file path itself
        $localPortRegPath = "HKLM:\SYSTEM\CurrentControlSet\Control\Print\Monitors\Local Port\Ports"
        
        if (-not (Test-Path $localPortRegPath)) {
            New-Item -Path $localPortRegPath -Force | Out-Null
        }
        
        # Create port: Name = file path, Value = empty string
        New-ItemProperty -Path $localPortRegPath -Name $PORT_NAME -Value "" -PropertyType String -Force | Out-Null
        Write-Log "Created local port in registry: $PORT_NAME"
        
        # Start the spooler
        Start-Service -Name Spooler
        Start-Sleep -Seconds 3
        Write-Log "Print spooler restarted"
        
        # Verify port was created
        $verifyPort = Get-PrinterPort -Name $PORT_NAME -ErrorAction SilentlyContinue
        if ($verifyPort) {
            Write-Log "Port verified: $PORT_NAME"
            Write-Log "Port type: $($verifyPort.Description)"
        }
        else {
            Write-Log "Warning: Port created but not visible in Get-PrinterPort" -Level "WARN"
        }
        
        return $true
    }
    catch {
        Write-Log "Failed to create port: $_" -Level "ERROR"
        
        # Ensure spooler is running even if we failed
        Start-Service -Name Spooler -ErrorAction SilentlyContinue
        
        return $false
    }
}

function Remove-CapturePort {
    Write-Log "Removing capture port: $PORT_NAME"
    
    try {
        $regPath = "HKLM:\SYSTEM\CurrentControlSet\Control\Print\Monitors\Local Port\Ports"
        Remove-ItemProperty -Path $regPath -Name $PORT_NAME -ErrorAction SilentlyContinue
        Restart-Service -Name Spooler -Force
        Start-Sleep -Seconds 3
        Write-Log "Port $PORT_NAME removed"
        return $true
    }
    catch {
        Write-Log "Failed to remove port: $_" -Level "ERROR"
        return $false
    }
}

function New-PooledPrinter {
    param(
        [string]$SourcePrinterName,
        [string]$PhysicalPortName
    )
    
    Write-Log "Creating pooled printer: $POOLED_PRINTER_NAME"
    
    $existing = Get-Printer -Name $POOLED_PRINTER_NAME -ErrorAction SilentlyContinue
    if ($existing) {
        Write-Log "Printer $POOLED_PRINTER_NAME already exists, removing..."
        Remove-Printer -Name $POOLED_PRINTER_NAME -Confirm:$false
        Start-Sleep -Seconds 1
    }
    
    $sourcePrinter = Get-Printer -Name $SourcePrinterName -ErrorAction SilentlyContinue
    if (-not $sourcePrinter) {
        Write-Log "Source printer not found: $SourcePrinterName" -Level "ERROR"
        return $false
    }
    
    $driverName = $sourcePrinter.DriverName
    
    Write-Log "Using driver: $driverName"
    Write-Log "Physical port: $PhysicalPortName"
    Write-Log "Capture port: $PORT_NAME"
    
    try {
        $printerParams = @{
            Name = $POOLED_PRINTER_NAME
            DriverName = $driverName
            PortName = $PhysicalPortName
            Comment = "Tabeza POS Pooled Printer - Sends to both printer and capture file"
            Location = "Created by Tabeza Connect"
            Shared = $false
        }
        
        Add-Printer @printerParams
        Write-Log "Created printer with single port"
        
        # Enable printer pooling via registry (most reliable method)
        try {
            $printerRegPath = "HKLM:\SYSTEM\CurrentControlSet\Control\Print\Printers\$POOLED_PRINTER_NAME"
            
            # Set multiple ports in registry (comma-separated)
            Set-ItemProperty -Path $printerRegPath -Name "Port" -Value "$PhysicalPortName,$PORT_NAME" -Type String
            Write-Log "Set printer ports in registry: $PhysicalPortName,$PORT_NAME"
            
            # Restart spooler to apply changes
            Restart-Service -Name Spooler -Force
            Start-Sleep -Seconds 3
            Write-Log "Print spooler restarted to apply pooling"
            
            Write-Log "Enabled printer pooling on ports: $PhysicalPortName, $PORT_NAME"
        }
        catch {
            Write-Log "Failed to enable pooling via registry: $_" -Level "ERROR"
            throw
        }
        
        Start-Sleep -Seconds 2
        
        $verify = Get-Printer -Name $POOLED_PRINTER_NAME
        Write-Log "Printer created successfully"
        Write-Log "Name: $($verify.Name)"
        Write-Log "Driver: $($verify.DriverName)"
        Write-Log "Ports: $($verify.PortName -join ', ')"
        
        return $true
    }
    catch {
        Write-Log "Failed to create pooled printer: $_" -Level "ERROR"
        Write-Log $_.ScriptStackTrace -Level "ERROR"
        return $false
    }
}

function Remove-PooledPrinter {
    Write-Log "Removing pooled printer: $POOLED_PRINTER_NAME"
    
    try {
        $printer = Get-Printer -Name $POOLED_PRINTER_NAME -ErrorAction SilentlyContinue
        if ($printer) {
            Remove-Printer -Name $POOLED_PRINTER_NAME -Confirm:$false
            Write-Log "Printer removed"
        }
        else {
            Write-Log "Printer not found (already removed)"
        }
        return $true
    }
    catch {
        Write-Log "Failed to remove printer: $_" -Level "ERROR"
        return $false
    }
}

function Test-PoolingSetup {
    Write-Log "Checking printer pooling configuration..."
    
    $results = @{
        PortExists = $false
        PrinterExists = $false
        PoolingEnabled = $false
        PhysicalPort = ""
        CaptureFile = ""
        FolderStructureOK = $false
        Status = "Unknown"
    }
    
    $folderCheck = Test-TabezaPrintsFolder
    $results.FolderStructureOK = $folderCheck.HasAllFolders
    
    $port = Get-PrinterPort -Name $PORT_NAME -ErrorAction SilentlyContinue
    if ($port) {
        $results.PortExists = $true
        $results.CaptureFile = $CaptureFilePath
    }
    
    $printer = Get-Printer -Name $POOLED_PRINTER_NAME -ErrorAction SilentlyContinue
    if ($printer) {
        $results.PrinterExists = $true
        
        $ports = @($printer.PortName)
        if ($ports.Count -gt 1 -or $ports[0] -is [array]) {
            $results.PoolingEnabled = $true
            $results.PhysicalPort = ($ports | Where-Object { $_ -ne $PORT_NAME }) -join ', '
        }
    }
    
    if ($results.FolderStructureOK -and $results.PortExists -and $results.PrinterExists -and $results.PoolingEnabled) {
        $results.Status = "FullyConfigured"
    }
    elseif ($results.FolderStructureOK) {
        if ($results.PortExists -or $results.PrinterExists) {
            $results.Status = "Partial"
        }
        else {
            $results.Status = "FoldersOnly"
        }
    }
    else {
        $results.Status = "NotConfigured"
    }
    
    return $results
}

function Test-TabezaPrintsFolder {
    $result = @{
        Exists = $false
        HasCaptureFile = $false
        HasConfig = $false
        HasAllFolders = $false
        MissingItems = @()
    }
    
    $requiredItems = @(
        $TABEZA_PRINTS_DIR,
        "$TABEZA_PRINTS_DIR\order.prn",
        "$TABEZA_PRINTS_DIR\config.json",
        "$TABEZA_PRINTS_DIR\processed",
        "$TABEZA_PRINTS_DIR\failed",
        "$TABEZA_PRINTS_DIR\logs",
        "$TABEZA_PRINTS_DIR\queue",
        "$TABEZA_PRINTS_DIR\queue\pending",
        "$TABEZA_PRINTS_DIR\queue\uploaded",
        "$TABEZA_PRINTS_DIR\templates"
    )
    
    $missingCount = 0
    foreach ($item in $requiredItems) {
        if (-not (Test-Path $item)) {
            $result.MissingItems += $item
            $missingCount++
        }
    }
    
    $result.Exists = Test-Path $TABEZA_PRINTS_DIR
    $result.HasCaptureFile = Test-Path "$TABEZA_PRINTS_DIR\order.prn"
    $result.HasConfig = Test-Path "$TABEZA_PRINTS_DIR\config.json"
    $result.HasAllFolders = ($missingCount -eq 0)
    
    return $result
}

function Show-PrinterSelection {
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    
    $printers = Get-ReceiptPrinters
    
    if ($printers.Count -eq 0) {
        [System.Windows.Forms.MessageBox]::Show(
            "No receipt printers found. Please connect your receipt printer and try again.",
            "Tabeza Connect - No Printers Found",
            "OK",
            "Warning"
        )
        return $null
    }
    
    $form = New-Object System.Windows.Forms.Form
    $form.Text = "Tabeza Connect - Select Printer"
    $form.Size = New-Object System.Drawing.Size(500, 350)
    $form.StartPosition = "CenterScreen"
    $form.FormBorderStyle = "FixedDialog"
    $form.MaximizeBox = $false
    $form.MinimizeBox = $false
    $form.TopMost = $true
    
    $label = New-Object System.Windows.Forms.Label
    $label.Location = New-Object System.Drawing.Point(20, 20)
    $label.Size = New-Object System.Drawing.Size(460, 60)
    $label.Text = "Select your receipt printer to configure printer pooling. This will create a 'Tabeza POS Printer' that sends print jobs to both your physical printer and Tabeza Connect."
    $label.AutoSize = $false
    $form.Controls.Add($label)
    
    $listBox = New-Object System.Windows.Forms.ListBox
    $listBox.Location = New-Object System.Drawing.Point(20, 90)
    $listBox.Size = New-Object System.Drawing.Size(440, 150)
    
    foreach ($printer in $printers) {
        $listBox.Items.Add($printer.Name) | Out-Null
    }
    
    if ($listBox.Items.Count -gt 0) {
        $listBox.SelectedIndex = 0
    }
    
    $form.Controls.Add($listBox)
    
    $portLabel = New-Object System.Windows.Forms.Label
    $portLabel.Location = New-Object System.Drawing.Point(20, 250)
    $portLabel.Size = New-Object System.Drawing.Size(460, 30)
    $form.Controls.Add($portLabel)
    
    $listBox.Add_SelectedIndexChanged({
        $selected = $listBox.SelectedItem
        if ($selected) {
            $port = Get-PrinterPort -PrinterName $selected
            $portLabel.Text = "Port: $port"
        }
    })
    
    if ($listBox.Items.Count -gt 0) {
        $listBox.SelectedIndex = 0
    }
    
    $okButton = New-Object System.Windows.Forms.Button
    $okButton.Location = New-Object System.Drawing.Point(280, 280)
    $okButton.Size = New-Object System.Drawing.Size(90, 30)
    $okButton.Text = "OK"
    $okButton.DialogResult = "OK"
    $form.Controls.Add($okButton)
    
    $cancelButton = New-Object System.Windows.Forms.Button
    $cancelButton.Location = New-Object System.Drawing.Point(380, 280)
    $cancelButton.Size = New-Object System.Drawing.Size(90, 30)
    $cancelButton.Text = "Cancel"
    $cancelButton.DialogResult = "Cancel"
    $form.Controls.Add($cancelButton)
    
    $form.AcceptButton = $okButton
    $form.CancelButton = $cancelButton
    
    $result = $form.ShowDialog()
    
    if ($result -eq "OK" -and $listBox.SelectedItem) {
        return $listBox.SelectedItem
    }
    
    return $null
}

switch ($Action) {
    "CreateFolders" {
        Write-Log "Action: CreateFolders"
        
        $result = Initialize-TabezaPrintsFolder
        
        Write-Host "Folder Structure Status:"
        Write-Host "Location: $($result.Path)"
        Write-Host "Directories Created: $($result.DirectoriesCreated)"
        Write-Host "Directories Existing: $($result.DirectoriesExisting)"
        Write-Host "Files Created: $($result.FilesCreated)"
        
        $result | ConvertTo-Json -Compress
        exit 0
    }
    
    "ListPrinters" {
        # Don't use Write-Log here - it outputs to stdout and breaks JSON parsing
        $printers = Get-ReceiptPrinters
        
        if ($printers.Count -eq 0) {
            Write-Output "[]"
            exit 0
        }
        
        # Output ONLY JSON to stdout
        $printers | Select-Object Name, PortName, DriverName | ConvertTo-Json -Compress
        exit 0
    }
    
    "Install" {
        if (-not (Test-Administrator)) {
            Write-Log "This script requires Administrator privileges" -Level "ERROR"
            exit 1
        }
        
        Write-Log "Action: Install"
        
        Write-Log "Step 1: Ensuring folder structure..."
        Initialize-TabezaPrintsFolder | Out-Null
        
        Write-Log "Step 2: Selecting printer..."
        if ([string]::IsNullOrEmpty($PhysicalPrinterName)) {
            if ($Silent) {
                $printers = Get-ReceiptPrinters
                if ($printers.Count -eq 0) {
                    Write-Log "No receipt printers found for auto-configuration" -Level "ERROR"
                    exit 1
                }
                $PhysicalPrinterName = $printers[0].Name
                Write-Log "Auto-selected printer: $PhysicalPrinterName"
            }
            else {
                $PhysicalPrinterName = Show-PrinterSelection
                if ([string]::IsNullOrEmpty($PhysicalPrinterName)) {
                    Write-Log "No printer selected, installation cancelled"
                    exit 0
                }
            }
        }
        
        $physicalPort = Get-PrinterPort -PrinterName $PhysicalPrinterName
        if (-not $physicalPort) {
            Write-Log "Could not determine port for printer: $PhysicalPrinterName" -Level "ERROR"
            exit 1
        }
        
        Write-Log "Configuration:"
        Write-Log "Source Printer: $PhysicalPrinterName"
        Write-Log "Physical Port: $physicalPort"
        Write-Log "Capture Port (file path): $PORT_NAME"
        
        Write-Log "Step 3: Creating capture port..."
        if (-not (New-CapturePort)) {
            Write-Log "Failed to create capture port" -Level "ERROR"
            exit 1
        }
        
        Write-Log "Step 4: Creating pooled printer..."
        if (-not (New-PooledPrinter -SourcePrinterName $PhysicalPrinterName -PhysicalPortName $physicalPort)) {
            Write-Log "Failed to create pooled printer" -Level "ERROR"
            exit 1
        }
        
        Write-Log "Printer pooling configured successfully!"
        Write-Log "Next steps:"
        Write-Log "1. Configure your POS software to print to: $POOLED_PRINTER_NAME"
        Write-Log "2. Tabeza Connect will automatically capture receipts from: $CaptureFilePath"
        
        exit 0
    }
    
    "Uninstall" {
        if (-not (Test-Administrator)) {
            Write-Log "This script requires Administrator privileges" -Level "ERROR"
            exit 1
        }
        
        Write-Log "Action: Uninstall"
        
        Remove-PooledPrinter
        Remove-CapturePort
        
        Write-Log "Printer pooling removed successfully"
        Write-Log "Note: C:\TabezaPrints\ folder preserved (contains logs and data)"
        exit 0
    }
    
    "Check" {
        Write-Log "Checking system status..."
        
        $status = Test-PoolingSetup
        
        $status | ConvertTo-Json -Compress
        exit 0
    }
}
