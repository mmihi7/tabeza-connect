# Template Cache Manager

## Overview

The Template Cache Manager is a robust module that handles template downloads, caching, validation, and automatic updates for the Tabeza Connect receipt parsing system. It implements an offline-first architecture with daily update checks and automatic fallback to cached templates when the cloud API is unavailable.

## Features

- **Template Download**: Downloads templates from cloud API with retry logic
- **Local Caching**: Caches templates locally for offline operation
- **Template Validation**: Validates template structure and regex patterns
- **Daily Update Checks**: Automatically checks for template updates at 3:00 AM
- **Offline Fallback**: Uses cached template when cloud API is unavailable
- **Version Tracking**: Tracks template versions and update history
- **Event Emission**: Emits events for monitoring and integration
- **Statistics**: Tracks download, validation, and cache performance

## Installation

```javascript
const TemplateCacheManager = require('./lib/template-cache-manager');
```

## Basic Usage

### Initialize the Manager

```javascript
const manager = new TemplateCacheManager({
  templatePath: 'C:\\ProgramData\\Tabeza\\template.json',
  apiUrl: 'https://tabeza.co.ke',
  barId: 'venue-bar-id',
});

// Initialize (loads cache and schedules updates)
await manager.initialize();
```

### Load Template

```javascript
// Load template (uses cache if available, downloads if needed)
const template = await manager.loadTemplate();

console.log('Template version:', template.version);
console.log('POS system:', template.posSystem);
console.log('Patterns:', template.patterns);
```

### Check Template Status

```javascript
// Check if template exists
const hasTemplate = manager.hasTemplate();

// Get template information
const info = manager.getTemplateInfo();
console.log('Template info:', info);
// {
//   exists: true,
//   version: '1.2',
//   posSystem: 'AccelPOS',
//   lastUpdate: '2026-03-08T00:00:00.000Z',
//   lastCheck: '2026-03-08T10:00:00.000Z',
//   patternsCount: 3,
//   confidenceThreshold: 0.85
// }
```

### Manual Update

```javascript
// Manually trigger template update
const result = await manager.updateTemplate();

if (result.success && result.updated) {
  console.log('Template updated:', result.oldVersion, '->', result.newVersion);
} else if (result.success && !result.updated) {
  console.log('Template is up to date:', result.version);
} else {
  console.log('Update failed:', result.error);
  console.log('Using cached template:', result.usingCache);
}
```

### Get Statistics

```javascript
const stats = manager.getStats();
console.log('Statistics:', stats);
// {
//   downloadsAttempted: 5,
//   downloadsSucceeded: 4,
//   downloadsFailed: 1,
//   validationsPassed: 4,
//   validationsFailed: 0,
//   cacheHits: 120,
//   cacheMisses: 5,
//   downloadSuccessRate: 80,
//   validationSuccessRate: 100,
//   hasTemplate: true,
//   templateInfo: { ... }
// }
```

## Configuration Options

```javascript
const manager = new TemplateCacheManager({
  // Path to template cache file
  templatePath: 'C:\\ProgramData\\Tabeza\\template.json',
  
  // Cloud API base URL
  apiUrl: 'https://tabeza.co.ke',
  
  // Venue Bar ID (required for downloads)
  barId: 'venue-bar-id',
});
```

## Events

The manager emits events for monitoring and integration:

```javascript
// Initialization complete
manager.on('initialized', (event) => {
  console.log('Initialized:', event.hasCachedTemplate);
});

// Template downloaded successfully
manager.on('template-downloaded', (event) => {
  console.log('Downloaded:', event.version, event.posSystem);
});

// Template updated
manager.on('template-updated', (event) => {
  console.log('Updated:', event.oldVersion, '->', event.newVersion);
});

// Download failed
manager.on('download-failed', (event) => {
  console.log('Download failed:', event.error, 'after', event.attempts, 'attempts');
});

// Update failed
manager.on('update-failed', (event) => {
  console.log('Update failed:', event.error);
});

// Manager stopped
manager.on('stopped', () => {
  console.log('Manager stopped');
});

// Error occurred
manager.on('error', (event) => {
  console.log('Error:', event.type, event.error);
});
```

## Template Structure

Templates must follow this structure:

```json
{
  "version": "1.2",
  "posSystem": "AccelPOS",
  "patterns": {
    "item_line": "^(.+?)\\s+(\\d+)\\s+([0-9,]+\\.\\d{2})$",
    "total_line": "^TOTAL\\s+([0-9,]+\\.\\d{2})$",
    "receipt_number": "^Receipt\\s*#?:\\s*(\\S+)$"
  },
  "confidence_threshold": 0.85,
  "lastUpdated": "2026-03-08T00:00:00.000Z"
}
```

### Required Fields

- `version` (string): Template version number
- `patterns` (object): Regex patterns for parsing
  - `item_line` (string): Pattern for item lines
  - `total_line` (string): Pattern for total line
  - `receipt_number` (string): Pattern for receipt number

### Optional Fields

- `posSystem` (string): POS system name
- `confidence_threshold` (number): Confidence threshold (0.0-1.0)
- `lastUpdated` (string): ISO 8601 timestamp

## Validation

The manager validates templates to ensure:

1. Template is a valid JSON object
2. `version` field exists and is a string
3. `patterns` object exists
4. Required patterns exist (`item_line`, `total_line`, `receipt_number`)
5. All regex patterns are valid and can be compiled
6. `confidence_threshold` (if present) is between 0.0 and 1.0

Invalid templates are rejected and not cached.

## Offline Operation

The manager implements an offline-first strategy:

1. **Cache First**: Always tries to use cached template
2. **Download on Miss**: Downloads if no cache exists
3. **Fallback on Failure**: Uses cached template if download fails
4. **Automatic Retry**: Retries failed downloads with exponential backoff
5. **Scheduled Updates**: Checks for updates daily at 3:00 AM

### Offline Behavior

```javascript
// When offline, manager uses cached template
const template = await manager.loadTemplate();
// Returns cached template immediately

// Update attempts fail gracefully
const result = await manager.updateTemplate();
// { success: false, error: '...', usingCache: true }

// Manager continues to work with cached template
const info = manager.getTemplateInfo();
// { exists: true, version: '1.2', ... }
```

## Update Scheduling

The manager automatically schedules daily update checks:

- **Check Time**: 3:00 AM local time
- **Frequency**: Once per day
- **Automatic**: Runs in background without user intervention
- **Resilient**: Continues on failure, retries next day

### Manual Control

```javascript
// Stop automatic updates
manager.stop();

// Manually trigger update
await manager.updateTemplate();

// Re-initialize to restart scheduling
await manager.initialize();
```

## Error Handling

The manager handles errors gracefully:

```javascript
try {
  const template = await manager.loadTemplate();
} catch (error) {
  // Only throws if no cache and download fails
  console.error('No template available:', error.message);
}

// Update failures don't throw
const result = await manager.updateTemplate();
if (!result.success) {
  console.log('Update failed, using cache:', result.usingCache);
}
```

## Performance

- **Cache Hits**: < 1ms (in-memory)
- **Cache Misses**: < 50ms (disk read)
- **Downloads**: < 5s (with retries)
- **Validation**: < 10ms
- **Memory**: < 1MB

## Integration Example

```javascript
const TemplateCacheManager = require('./lib/template-cache-manager');

class ReceiptParser {
  constructor(options) {
    this.templateManager = new TemplateCacheManager({
      templatePath: options.templatePath,
      apiUrl: options.apiUrl,
      barId: options.barId,
    });
    
    // Listen for template updates
    this.templateManager.on('template-updated', (event) => {
      console.log('Template updated, reloading parser...');
      this.reloadTemplate();
    });
  }
  
  async initialize() {
    await this.templateManager.initialize();
    await this.reloadTemplate();
  }
  
  async reloadTemplate() {
    this.template = await this.templateManager.loadTemplate();
    console.log('Parser loaded template:', this.template.version);
  }
  
  async parse(text) {
    // Use this.template for parsing
    // ...
  }
}
```

## Testing

Run unit tests:

```bash
npm test -- template-cache-manager.test.js
```

Test coverage includes:
- Initialization
- Template loading
- Template downloading
- Template validation
- Caching behavior
- Offline fallback
- Update scheduling
- Error handling
- Statistics tracking

## Troubleshooting

### Template Not Loading

```javascript
// Check if template exists
const hasTemplate = manager.hasTemplate();
console.log('Has template:', hasTemplate);

// Check template info
const info = manager.getTemplateInfo();
console.log('Template info:', info);

// Check statistics
const stats = manager.getStats();
console.log('Download stats:', {
  attempted: stats.downloadsAttempted,
  succeeded: stats.downloadsSucceeded,
  failed: stats.downloadsFailed,
});
```

### Download Failures

```javascript
// Listen for download failures
manager.on('download-failed', (event) => {
  console.error('Download failed:', event.error);
  console.log('Attempts:', event.attempts);
});

// Check if Bar ID is set
console.log('Bar ID:', manager.barId);

// Manually retry
const result = await manager.downloadTemplate();
console.log('Download result:', result);
```

### Validation Failures

```javascript
// Check validation statistics
const stats = manager.getStats();
console.log('Validation stats:', {
  passed: stats.validationsPassed,
  failed: stats.validationsFailed,
  rate: stats.validationSuccessRate,
});

// Manually validate template
try {
  manager._validateTemplate(template);
  console.log('Template is valid');
} catch (error) {
  console.error('Validation failed:', error.message);
}
```

## API Reference

### Constructor

```javascript
new TemplateCacheManager(options)
```

### Methods

- `initialize()` - Initialize manager and load cache
- `loadTemplate()` - Load template (cache or download)
- `downloadTemplate(retryCount)` - Download template from API
- `updateTemplate()` - Check for and download updates
- `getTemplateInfo()` - Get template metadata
- `getCachedTemplate()` - Get cached template object
- `hasTemplate()` - Check if template exists
- `getStats()` - Get manager statistics
- `setBarId(barId)` - Set venue Bar ID
- `stop()` - Stop manager and clean up

### Events

- `initialized` - Manager initialized
- `template-downloaded` - Template downloaded
- `template-updated` - Template updated
- `download-failed` - Download failed
- `update-failed` - Update failed
- `stopped` - Manager stopped
- `error` - Error occurred

## Requirements

- Node.js >= 18.0.0
- File system access (for caching)
- HTTPS access (for downloads)

## License

Part of Tabeza Connect - Proprietary

## Support

For issues or questions, contact the Tabeza development team.
