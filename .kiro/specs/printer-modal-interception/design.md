# Printer Modal Interception - Design Document

## 1. System Architecture

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     POS System                              │
│                  (Any POS Software)                         │
└────────────────┬────────────────────────────────────────────┘
                 │ Print Command
                 ↓
┌─────────────────────────────────────────────────────────────┐
│              Windows Print Spooler                          │
│         (Built-in Windows Component)                        │
└────────────────┬────────────────────────────────────────────┘
                 │ Print Job
                 ↓
┌─────────────────────────────────────────────────────────────┐
│          Tabeza Printer Port Monitor                        │
│              (Custom C# Component)                          │
│  • Intercepts print jobs                                    │
│  • Captures raw data                                        │
│  • Triggers modal                                           │
└────────────────┬────────────────────────────────────────────┘
                 │ Print Data + Event
         ┌───────┴───────┐
         │               │
         ↓               ↓
┌────────────────┐  ┌────────────────────────────────────────┐
│ Modal App      │  │ Background Service                     │
│ (WPF C#)       │  │ (Windows Service C#)                   │
│                │  │                                        │
│ • Shows UI     │  │ • Manages port monitor                 │
│ • Fetches tabs │  │ • Communicates with cloud              │
│ • User input   │  │ • Handles offline queue                │
└────────┬───────┘  └────────┬───────────────────────────────┘
         │                   │
         └───────┬───────────┘
                 │
         ┌───────┴───────┐
         │               │
         ↓               ↓
┌────────────────┐  ┌────────────────────────────────────────┐
│ Cloud API      │  │ Physical Receipt Printer               │
│ (Tabeza)       │  │ (Existing Hardware)                    │
└────────────────┘  └────────────────────────────────────────┘
```

### 1.2 Component Breakdown

**Component 1: Printer Port Monitor (C# DLL)**
- Implements Windows Print Spooler API
- Intercepts print jobs sent to "TABEZA Virtual Printer"
- Captures raw ESC/POS data
- Communicates with Background Service via Named Pipes

**Component 2: Modal Application (WPF C#)**
- Always-on-top window
- Fetches open tabs from cloud API
- Displays receipt preview
- Handles user input (tab selection, physical print, cancel)
- Sends commands to Background Service

**Component 3: Background Service (Windows Service C#)**
- Manages port monitor lifecycle
- Communicates with cloud API
- Handles offline queue
- Routes print jobs to physical printer or cloud
- Runs on system startup
- System tray icon

**Component 4: Installer (WiX MSI)**
- Installs all components
- Creates virtual printer
- Registers port monitor
- Configures Windows Service
- Sets up auto-start

## 2. Detailed Component Design

### 2.1 Printer Port Monitor

**Technology:** C# using Windows Print Spooler API

**Key Classes:**

```csharp
// TabezaPortMonitor.cs
public class TabezaPortMonitor : IMonitor2
{
    // Intercepts print jobs
    public void StartDocPort(string portName, int printerId, 
                            int jobId, int level, byte[] docInfo)
    {
        // Capture print job metadata
        // Notify Background Service
    }
    
    public void WritePort(string portName, byte[] buffer, 
                         int numberOfBytesToWrite, 
                         out int numberOfBytesWritten)
    {
        // Capture print data chunks
        // Accumulate in buffer
    }
    
    public void EndDocPort(string portName)
    {
        // Print job complete
        // Send full data to Background Service
        // Wait for user decision (modal)
    }
}
```

**Communication Protocol:**
- Uses Named Pipes to communicate with Background Service
- Sends: Print job ID, raw data, timestamp
- Receives: Action (deliver_to_tab, print_physical, cancel)

**Installation:**
- Registered in Windows Registry: `HKLM\SYSTEM\CurrentControlSet\Control\Print\Monitors`
- DLL placed in: `C:\Windows\System32\`
- Requires admin privileges

### 2.2 Modal Application

**Technology:** WPF (Windows Presentation Foundation) C#

**Main Window Design:**

```xml
<!-- TabSelectionModal.xaml -->
<Window x:Class="Tabeza.PrinterModal.TabSelectionModal"
        Title="Tabeza - Select Customer Tab"
        Width="500" Height="600"
        Topmost="True"
        WindowStartupLocation="CenterScreen"
        ResizeMode="NoResize">
    
    <Grid>
        <!-- Receipt Preview Section -->
        <StackPanel Grid.Row="0" Background="#F5F5F5" Padding="20">
            <TextBlock Text="Receipt Preview" FontSize="18" FontWeight="Bold"/>
            <TextBlock x:Name="TotalAmount" FontSize="24" Margin="0,10,0,0"/>
            <TextBlock x:Name="ItemsList" FontSize="14" Margin="0,10,0,0"/>
            <TextBlock x:Name="Timestamp" FontSize="12" Foreground="Gray"/>
        </StackPanel>
        
        <!-- Tab Selection Section -->
        <StackPanel Grid.Row="1" Padding="20">
            <TextBlock Text="Select Customer Tab" FontSize="16" FontWeight="Bold"/>
            <ListBox x:Name="TabsList" Height="250" Margin="0,10,0,0">
                <!-- Dynamically populated with open tabs -->
            </ListBox>
        </StackPanel>
        
        <!-- Action Buttons -->
        <StackPanel Grid.Row="2" Orientation="Horizontal" 
                   HorizontalAlignment="Center" Margin="20">
            <Button Content="Deliver to Tab" Width="150" Height="40" 
                   Click="DeliverToTab_Click" IsDefault="True"/>
            <Button Content="Print Physically" Width="150" Height="40" 
                   Click="PrintPhysically_Click" Margin="10,0,0,0"/>
            <Button Content="Cancel" Width="100" Height="40" 
                   Click="Cancel_Click" Margin="10,0,0,0"/>
        </StackPanel>
    </Grid>
</Window>
```

**Code-Behind:**

```csharp
// TabSelectionModal.xaml.cs
public partial class TabSelectionModal : Window
{
    private PrintJob _currentPrintJob;
    private BackgroundServiceClient _serviceClient;
    
    public TabSelectionModal(PrintJob printJob)
    {
        InitializeComponent();
        _currentPrintJob = printJob;
        _serviceClient = new BackgroundServiceClient();
        
        LoadReceiptPreview();
        LoadOpenTabs();
        SetupKeyboardShortcuts();
    }
    
    private async void LoadOpenTabs()
    {
        try
        {
            var tabs = await _serviceClient.GetOpenTabsAsync();
            TabsList.ItemsSource = tabs;
        }
        catch (Exception ex)
        {
            // Show offline message
            ShowOfflineMode();
        }
    }
    
    private async void DeliverToTab_Click(object sender, RoutedEventArgs e)
    {
        var selectedTab = TabsList.SelectedItem as Tab;
        if (selectedTab == null)
        {
            MessageBox.Show("Please select a tab");
            return;
        }
        
        await _serviceClient.DeliverReceiptAsync(
            _currentPrintJob.Id, 
            selectedTab.Id
        );
        
        this.DialogResult = true;
        this.Close();
    }
    
    private void SetupKeyboardShortcuts()
    {
        // 1-9 keys select tabs
        // P key prints physically
        // Esc key cancels
    }
}
```

**Key Features:**
- Always-on-top (Topmost="True")
- Auto-focus on first tab
- Keyboard navigation
- Touch-friendly buttons (40px height)
- Timeout after 60 seconds (auto-cancel)

### 2.3 Background Service

**Technology:** Windows Service (C#)

**Main Service Class:**

```csharp
// TabezaPrinterService.cs
public class TabezaPrinterService : ServiceBase
{
    private NamedPipeServer _pipeServer;
    private CloudApiClient _cloudClient;
    private OfflineQueue _offlineQueue;
    private NotifyIcon _trayIcon;
    
    protected override void OnStart(string[] args)
    {
        // Start named pipe server for port monitor
        _pipeServer = new NamedPipeServer("TabezaPrinterPipe");
        _pipeServer.OnPrintJobReceived += HandlePrintJob;
        _pipeServer.Start();
        
        // Initialize cloud client
        _cloudClient = new CloudApiClient(GetBarId());
        
        // Load offline queue
        _offlineQueue = new OfflineQueue();
        
        // Create system tray icon
        CreateTrayIcon();
        
        // Start offline queue processor
        StartOfflineQueueProcessor();
    }
    
    private async void HandlePrintJob(PrintJob printJob)
    {
        // Show modal
        var modal = new TabSelectionModal(printJob);
        var result = modal.ShowDialog();
        
        if (result == true)
        {
            // User selected action
            await ProcessUserAction(modal.SelectedAction, printJob);
        }
        else
        {
            // User cancelled or timeout
            await HandleCancellation(printJob);
        }
    }
    
    private async Task ProcessUserAction(
        UserAction action, 
        PrintJob printJob)
    {
        switch (action.Type)
        {
            case ActionType.DeliverToTab:
                await DeliverToTab(printJob, action.TabId);
                break;
                
            case ActionType.PrintPhysically:
                await PrintPhysically(printJob);
                break;
                
            case ActionType.Cancel:
                // Discard print job
                break;
        }
    }
    
    private async Task DeliverToTab(PrintJob printJob, string tabId)
    {
        try
        {
            await _cloudClient.DeliverReceiptAsync(printJob, tabId);
        }
        catch (Exception ex)
        {
            // Queue for offline delivery
            _offlineQueue.Enqueue(printJob, tabId);
        }
    }
}
```

**Named Pipe Communication:**

```csharp
// NamedPipeServer.cs
public class NamedPipeServer
{
    private NamedPipeServerStream _pipeServer;
    
    public event Action<PrintJob> OnPrintJobReceived;
    
    public void Start()
    {
        _pipeServer = new NamedPipeServerStream(
            "TabezaPrinterPipe",
            PipeDirection.InOut,
            1,
            PipeTransmissionMode.Byte,
            PipeOptions.Asynchronous
        );
        
        _pipeServer.BeginWaitForConnection(OnClientConnected, null);
    }
    
    private void OnClientConnected(IAsyncResult result)
    {
        _pipeServer.EndWaitForConnection(result);
        
        // Read print job data
        var printJob = ReadPrintJob();
        
        // Notify handler
        OnPrintJobReceived?.Invoke(printJob);
        
        // Wait for next connection
        _pipeServer.Disconnect();
        _pipeServer.BeginWaitForConnection(OnClientConnected, null);
    }
}
```

**System Tray Icon:**

```csharp
// TrayIcon.cs
private void CreateTrayIcon()
{
    _trayIcon = new NotifyIcon
    {
        Icon = new Icon("tabeza-icon.ico"),
        Text = "Tabeza Printer Service",
        Visible = true
    };
    
    var contextMenu = new ContextMenuStrip();
    contextMenu.Items.Add("Status", null, ShowStatus);
    contextMenu.Items.Add("Settings", null, ShowSettings);
    contextMenu.Items.Add("Exit", null, ExitService);
    
    _trayIcon.ContextMenuStrip = contextMenu;
}
```

### 2.4 Cloud API Integration

**New Endpoints:**

```typescript
// GET /api/printer/open-tabs?barId=xxx
// Returns list of open tabs for modal
interface OpenTabsResponse {
  tabs: Array<{
    id: string;
    tab_number: number;
    table_number?: string;
    opened_at: string;
    current_total: number;
  }>;
}

// POST /api/printer/deliver-receipt
// Delivers receipt to selected tab
interface DeliverReceiptRequest {
  printJobId: string;
  tabId: string;
  receiptData: {
    items: Array<{ name: string; price: number; quantity: number }>;
    total: number;
    timestamp: string;
  };
}

interface DeliverReceiptResponse {
  success: boolean;
  tabOrderId: string;
  message: string;
}

// POST /api/printer/queue-offline
// Queues receipt for later delivery
interface QueueOfflineRequest {
  printJobId: string;
  tabId: string;
  receiptData: any;
  queuedAt: string;
}
```

**Implementation:**

```typescript
// apps/staff/app/api/printer/open-tabs/route.ts
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const barId = searchParams.get('barId');
  
  const { data: tabs } = await supabase
    .from('tabs')
    .select(`
      id,
      tab_number,
      opened_at,
      tab_orders(total)
    `)
    .eq('bar_id', barId)
    .eq('status', 'open')
    .order('opened_at', { ascending: false });
  
  // Calculate current totals
  const tabsWithTotals = tabs.map(tab => ({
    id: tab.id,
    tab_number: tab.tab_number,
    opened_at: tab.opened_at,
    current_total: tab.tab_orders
      .filter(o => o.status === 'confirmed')
      .reduce((sum, o) => sum + o.total, 0)
  }));
  
  return NextResponse.json({ tabs: tabsWithTotals });
}
```

### 2.5 Offline Queue

**Design:**

```csharp
// OfflineQueue.cs
public class OfflineQueue
{
    private readonly string _queueFile = 
        Path.Combine(
            Environment.GetFolderPath(
                Environment.SpecialFolder.ApplicationData
            ),
            "Tabeza",
            "offline_queue.json"
        );
    
    public void Enqueue(PrintJob printJob, string tabId)
    {
        var queueItem = new QueueItem
        {
            Id = Guid.NewGuid().ToString(),
            PrintJobId = printJob.Id,
            TabId = tabId,
            ReceiptData = printJob.ParsedData,
            QueuedAt = DateTime.UtcNow,
            Attempts = 0
        };
        
        var queue = LoadQueue();
        queue.Add(queueItem);
        SaveQueue(queue);
    }
    
    public async Task ProcessQueue(CloudApiClient cloudClient)
    {
        var queue = LoadQueue();
        var processed = new List<string>();
        
        foreach (var item in queue)
        {
            try
            {
                await cloudClient.DeliverReceiptAsync(
                    item.PrintJobId,
                    item.TabId,
                    item.ReceiptData
                );
                
                processed.Add(item.Id);
            }
            catch (Exception ex)
            {
                item.Attempts++;
                
                // Give up after 10 attempts
                if (item.Attempts >= 10)
                {
                    processed.Add(item.Id);
                }
            }
        }
        
        // Remove processed items
        queue.RemoveAll(i => processed.Contains(i.Id));
        SaveQueue(queue);
    }
}
```

## 3. Data Models

### 3.1 Print Job

```csharp
public class PrintJob
{
    public string Id { get; set; }
    public string BarId { get; set; }
    public byte[] RawData { get; set; }
    public DateTime ReceivedAt { get; set; }
    public ParsedReceipt ParsedData { get; set; }
}

public class ParsedReceipt
{
    public List<ReceiptItem> Items { get; set; }
    public decimal Total { get; set; }
    public string RawText { get; set; }
    public DateTime Timestamp { get; set; }
}

public class ReceiptItem
{
    public string Name { get; set; }
    public decimal Price { get; set; }
    public int Quantity { get; set; }
}
```

### 3.2 Tab

```csharp
public class Tab
{
    public string Id { get; set; }
    public int TabNumber { get; set; }
    public string TableNumber { get; set; }
    public DateTime OpenedAt { get; set; }
    public decimal CurrentTotal { get; set; }
}
```

### 3.3 User Action

```csharp
public enum ActionType
{
    DeliverToTab,
    PrintPhysically,
    Cancel
}

public class UserAction
{
    public ActionType Type { get; set; }
    public string TabId { get; set; } // Only for DeliverToTab
}
```

## 4. User Interface Design

### 4.1 Modal Window States

**State 1: Loading**
```
┌─────────────────────────────────────────┐
│  📄 Loading Receipt...                  │
├─────────────────────────────────────────┤
│                                         │
│  [Loading spinner]                      │
│                                         │
│  Fetching open tabs...                  │
│                                         │
└─────────────────────────────────────────┘
```

**State 2: Normal (Online)**
```
┌─────────────────────────────────────────┐
│  📄 New Receipt - Select Tab            │
├─────────────────────────────────────────┤
│  Total: KES 928.00                      │
│  Items: Beer, Wings, Soda               │
│  Time: 19:30                            │
├─────────────────────────────────────────┤
│  Open Tabs:                             │
│  ┌─────────────────────────────────┐   │
│  │ [1] Tab #5 - Table 3            │   │
│  │     Opened: 19:15 | KES 0.00    │   │
│  ├─────────────────────────────────┤   │
│  │ [2] Tab #7 - Table 5            │   │
│  │     Opened: 19:20 | KES 450.00  │   │
│  └─────────────────────────────────┘   │
├─────────────────────────────────────────┤
│  [Deliver to Tab] [Print] [Cancel]     │
└─────────────────────────────────────────┘
```

**State 3: Offline**
```
┌─────────────────────────────────────────┐
│  ⚠️  Offline Mode                        │
├─────────────────────────────────────────┤
│  Total: KES 928.00                      │
│  Items: Beer, Wings, Soda               │
├─────────────────────────────────────────┤
│  ⚠️  Cannot connect to cloud            │
│  Digital delivery unavailable           │
│                                         │
│  You can still print physically         │
├─────────────────────────────────────────┤
│  [Print Physically] [Cancel]            │
└─────────────────────────────────────────┘
```

**State 4: No Open Tabs**
```
┌─────────────────────────────────────────┐
│  📄 New Receipt                         │
├─────────────────────────────────────────┤
│  Total: KES 928.00                      │
│  Items: Beer, Wings, Soda               │
├─────────────────────────────────────────┤
│  ℹ️  No open tabs available             │
│                                         │
│  Print physically or cancel             │
├─────────────────────────────────────────┤
│  [Print Physically] [Cancel]            │
└─────────────────────────────────────────┘
```

### 4.2 Keyboard Shortcuts

| Key | Action |
|-----|--------|
| 1-9 | Select tab by number |
| Enter | Confirm selection (deliver to tab) |
| P | Print physically |
| Esc | Cancel |
| ↑/↓ | Navigate tab list |

### 4.3 Visual Design

**Colors:**
- Primary: #FF6B35 (Orange - Tabeza brand)
- Success: #4CAF50 (Green)
- Warning: #FFC107 (Yellow)
- Error: #F44336 (Red)
- Background: #F5F5F5 (Light gray)
- Text: #333333 (Dark gray)

**Typography:**
- Title: Segoe UI, 18pt, Bold
- Amount: Segoe UI, 24pt, Bold
- Body: Segoe UI, 14pt, Regular
- Small: Segoe UI, 12pt, Regular

**Spacing:**
- Padding: 20px
- Button height: 40px
- Button spacing: 10px

## 5. Installation & Deployment

### 5.1 Installer Components

**WiX Toolset MSI Installer:**

```xml
<!-- Product.wxs -->
<Wix xmlns="http://schemas.microsoft.com/wix/2006/wi">
  <Product Id="*" 
           Name="Tabeza Printer Service" 
           Version="1.0.0"
           Manufacturer="Tabeza"
           UpgradeCode="YOUR-GUID-HERE">
    
    <Package InstallerVersion="200" Compressed="yes" />
    
    <!-- Install printer driver -->
    <CustomAction Id="InstallPrinterDriver" 
                  Execute="deferred" 
                  Impersonate="no"
                  Return="check">
      <![CDATA[
        rundll32 printui.dll,PrintUIEntry /if /b "TABEZA Virtual Printer" 
        /f "[INSTALLDIR]TabezaPrinter.inf" /r "TABEZA:" /m "Generic / Text Only"
      ]]>
    </CustomAction>
    
    <!-- Register port monitor -->
    <CustomAction Id="RegisterPortMonitor"
                  Execute="deferred"
                  Impersonate="no"
                  Return="check">
      <![CDATA[
        regsvr32 /s "[INSTALLDIR]TabezaPortMonitor.dll"
      ]]>
    </CustomAction>
    
    <!-- Install Windows Service -->
    <ServiceInstall Id="TabezaPrinterService"
                   Name="TabezaPrinterService"
                   DisplayName="Tabeza Printer Service"
                   Description="Manages Tabeza printer integration"
                   Type="ownProcess"
                   Start="auto"
                   ErrorControl="normal" />
    
  </Product>
</Wix>
```

### 5.2 Installation Steps

1. **Check Prerequisites**
   - Windows 10 or later
   - .NET Framework 4.8 or .NET 6+
   - Admin privileges

2. **Install Printer Driver**
   - Copy driver files to System32
   - Register with Windows Print Spooler
   - Create virtual printer "TABEZA Virtual Printer"

3. **Install Port Monitor**
   - Copy DLL to System32
   - Register in Windows Registry
   - Configure port "TABEZA:"

4. **Install Modal Application**
   - Copy executable to Program Files
   - Create desktop shortcut (optional)

5. **Install Background Service**
   - Copy service executable
   - Register Windows Service
   - Configure auto-start
   - Start service

6. **Configure Bar ID**
   - Prompt user for Bar ID
   - Save to registry or config file
   - Validate with cloud API

7. **Create System Tray Icon**
   - Add to startup folder
   - Show success notification

### 5.3 Uninstallation

1. Stop Windows Service
2. Unregister port monitor
3. Delete virtual printer
4. Remove printer driver
5. Delete files
6. Clean registry

## 6. Error Handling

### 6.1 Error Scenarios

**Scenario 1: Cloud API Unreachable**
- Show offline mode in modal
- Queue receipt for later delivery
- Allow physical print only

**Scenario 2: No Open Tabs**
- Show "No open tabs" message
- Offer physical print or cancel

**Scenario 3: Modal Timeout (60 seconds)**
- Auto-cancel print job
- Log timeout event
- Notify user via system tray

**Scenario 4: Port Monitor Crash**
- Background Service detects crash
- Restart port monitor
- Log error for debugging

**Scenario 5: Physical Printer Offline**
- Show error message
- Offer to queue for later
- Allow cancel

### 6.2 Logging

**Log Levels:**
- DEBUG: Detailed flow information
- INFO: Normal operations
- WARN: Recoverable errors
- ERROR: Unrecoverable errors

**Log Location:**
- `C:\ProgramData\Tabeza\Logs\printer-service.log`

**Log Format:**
```
[2024-01-15 19:30:45] [INFO] Print job received: job-123456
[2024-01-15 19:30:46] [INFO] Modal displayed
[2024-01-15 19:30:50] [INFO] User selected Tab #5
[2024-01-15 19:30:51] [INFO] Receipt delivered successfully
```

## 7. Performance Requirements

### 7.1 Response Times

| Operation | Target | Maximum |
|-----------|--------|---------|
| Modal appears after print | < 500ms | 1000ms |
| Load open tabs | < 200ms | 500ms |
| Deliver receipt to cloud | < 2s | 5s |
| Print physically | < 3s | 10s |

### 7.2 Resource Usage

- Memory: < 50MB (idle), < 100MB (active)
- CPU: < 5% (idle), < 20% (active)
- Disk: < 100MB total installation
- Network: < 1MB per receipt delivery

## 8. Security Considerations

### 8.1 Data Protection

- Bar ID stored encrypted in registry
- API credentials encrypted using Windows DPAPI
- Print data encrypted in offline queue
- HTTPS only for cloud communication

### 8.2 Access Control

- Service runs as LocalSystem (required for printer access)
- Modal runs as current user
- Named pipe secured with ACLs
- Registry keys protected

## 9. Testing Strategy

### 9.1 Unit Tests

- Port monitor interception
- Receipt parsing
- Offline queue operations
- Cloud API client

### 9.2 Integration Tests

- End-to-end print flow
- Modal display and interaction
- Physical printer routing
- Offline mode

### 9.3 Manual Testing

- Test with real POS systems
- Test on different Windows versions
- Test with different printers
- Test network failures

## 10. Deployment Plan

### 10.1 Phase 1: Development (Weeks 1-2)

- Build port monitor
- Build modal application
- Build background service
- Basic integration

### 10.2 Phase 2: Testing (Week 3)

- Unit tests
- Integration tests
- Manual testing with POS
- Bug fixes

### 10.3 Phase 3: Installer (Week 4)

- Create MSI installer
- Test installation/uninstallation
- Create documentation
- Package for distribution

### 10.4 Phase 4: Pilot (Week 5)

- Deploy to 1-2 test venues
- Monitor for issues
- Gather feedback
- Iterate

### 10.5 Phase 5: Production (Week 6)

- Final bug fixes
- Create support documentation
- Release to all venues
- Monitor and support

## 11. Future Enhancements

### 11.1 Automatic Tab Matching

- Parse table numbers from receipts
- Match to tabs automatically
- Show confidence score
- Allow manual override

### 11.2 Receipt Templates

- Customize receipt display
- Add venue branding
- Support multiple languages

### 11.3 Analytics

- Track delivery times
- Monitor success rates
- Identify bottlenecks
- Generate reports

### 11.4 Mobile Modal

- iOS/Android app for modal
- Bluetooth connection to service
- Touch-optimized UI
- Offline support

## 12. Success Metrics

### 12.1 Technical Metrics

- Modal response time: < 500ms (95th percentile)
- Delivery success rate: > 99%
- Service uptime: > 99.9%
- Crash rate: < 0.1%

### 12.2 Business Metrics

- Time to deliver receipt: < 5 seconds (vs 30+ seconds)
- Staff satisfaction: > 4.5/5
- Error rate: < 1%
- Adoption rate: > 90% of venues

## 13. Correctness Properties

### 13.1 Core Properties

**Property 1: Print Job Preservation**
- **Statement:** Every print job sent to TABEZA printer is either delivered to a tab, printed physically, or explicitly cancelled
- **Test:** No print jobs are lost or silently dropped

**Property 2: Modal Always Appears**
- **Statement:** When a print job is intercepted, the modal appears within 1 second
- **Test:** 100% of print jobs trigger modal display

**Property 3: User Action Honored**
- **Statement:** The system always executes the user's selected action (deliver, print, cancel)
- **Test:** No action is ignored or misinterpreted

**Property 4: Offline Queue Integrity**
- **Statement:** Receipts queued offline are delivered when connection returns
- **Test:** No queued receipts are lost across service restarts

**Property 5: Physical Print Fallback**
- **Statement:** Physical print always works, even if cloud is down
- **Test:** 100% success rate for physical print option

### 13.2 Property-Based Tests

```csharp
// Property: Every print job results in exactly one outcome
[Property]
public Property PrintJobHasExactlyOneOutcome()
{
    return Prop.ForAll(
        Arb.Generate<PrintJob>(),
        printJob =>
        {
            var outcomes = new List<Outcome>();
            
            // Simulate print job processing
            var result = ProcessPrintJob(printJob);
            
            // Count outcomes
            if (result.DeliveredToTab) outcomes.Add(Outcome.Delivered);
            if (result.PrintedPhysically) outcomes.Add(Outcome.Physical);
            if (result.Cancelled) outcomes.Add(Outcome.Cancelled);
            
            // Must have exactly one outcome
            return outcomes.Count == 1;
        }
    );
}

// Property: Modal timeout never exceeds 60 seconds
[Property]
public Property ModalTimeoutIsEnforced()
{
    return Prop.ForAll(
        Arb.Generate<PrintJob>(),
        printJob =>
        {
            var startTime = DateTime.Now;
            
            // Show modal (simulated)
            var result = ShowModalWithTimeout(printJob, TimeSpan.FromSeconds(60));
            
            var elapsed = DateTime.Now - startTime;
            
            // Must complete within 61 seconds (1 second buffer)
            return elapsed.TotalSeconds <= 61;
        }
    );
}
```

## 14. Appendix

### 14.1 Windows Print Spooler API Reference

- [Print Spooler API](https://docs.microsoft.com/en-us/windows/win32/printdocs/print-spooler-api)
- [Port Monitors](https://docs.microsoft.com/en-us/windows-hardware/drivers/print/port-monitors)

### 14.2 WPF Resources

- [WPF Documentation](https://docs.microsoft.com/en-us/dotnet/desktop/wpf/)
- [Always-on-Top Windows](https://docs.microsoft.com/en-us/dotnet/api/system.windows.window.topmost)

### 14.3 Windows Service Resources

- [Windows Services](https://docs.microsoft.com/en-us/dotnet/framework/windows-services/)
- [Named Pipes](https://docs.microsoft.com/en-us/dotnet/standard/io/pipe-operations)

### 14.4 WiX Toolset Resources

- [WiX Toolset](https://wixtoolset.org/)
- [Creating MSI Installers](https://wixtoolset.org/documentation/manual/v3/)
