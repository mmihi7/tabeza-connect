# Bugfix Requirements Document: Remove Bridge Mode

## Introduction

The tabeza-connect service currently supports three capture modes: spooler (active pause-copy), pooling (printer pool monitoring), and bridge (legacy folder-based). The user has explicitly requested to remove all aspects of bridge mode as it is no longer needed. The service should only support pooling mode going forward.

This bugfix removes all bridge-related code, imports, configuration, batch files, and UI elements from the tabeza-connect service to simplify the codebase and eliminate unused functionality.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the service starts THEN the system imports bridge-related modules (PrintBridge, final-bridge) even though bridge mode is not used

1.2 WHEN examining the src/service directory THEN the system contains multiple bridge implementation files (printBridge.js, final-bridge.js, universal-bridge.js, printBridge-*.js variants)

1.3 WHEN examining batch files THEN the system contains bridge-specific scripts (start-bridge.bat, test-bridge.bat, deploy-bridge.bat, restore-bridge-mode.bat, etc.)

1.4 WHEN the tray app displays status THEN the system shows bridge status information even though bridge mode is not active

1.5 WHEN examining API endpoints THEN the system exposes bridge status endpoints that are no longer needed

1.6 WHEN the service initializes THEN the system includes bridge initialization logic in the startup sequence

### Expected Behavior (Correct)

2.1 WHEN the service starts THEN the system SHALL only import modules required for pooling mode (no bridge imports)

2.2 WHEN examining the src/service directory THEN the system SHALL contain no bridge implementation files

2.3 WHEN examining batch files THEN the system SHALL contain no bridge-specific scripts

2.4 WHEN the tray app displays status THEN the system SHALL only show pooling mode status information

2.5 WHEN examining API endpoints THEN the system SHALL not expose any bridge-related endpoints

2.6 WHEN the service initializes THEN the system SHALL only initialize pooling mode components

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the service operates in pooling mode THEN the system SHALL CONTINUE TO monitor printer pools and capture print jobs correctly

3.2 WHEN the service processes captured print jobs THEN the system SHALL CONTINUE TO parse, queue, and upload receipts to the cloud

3.3 WHEN the service sends heartbeats THEN the system SHALL CONTINUE TO report status and maintain cloud connectivity

3.4 WHEN the tray app displays status THEN the system SHALL CONTINUE TO show accurate service status, printer status, and connection information

3.5 WHEN configuration is loaded THEN the system SHALL CONTINUE TO read and validate config.json correctly

3.6 WHEN the service handles API requests THEN the system SHALL CONTINUE TO respond to valid endpoints (status, health, test-receipt, etc.)

3.7 WHEN the service shuts down THEN the system SHALL CONTINUE TO cleanup resources and stop monitoring gracefully
