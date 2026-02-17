# Simplify Printer Setup UI - Requirements

## Feature Name
simplify-printer-setup-ui

## Overview
Eliminate redundant printer configuration steps in the Staff app Settings page. The current implementation has duplicate UI sections and requires manual configuration after installation. This should be automatic and simple.

## Problem Statement
Currently, the printer setup flow is confusing and redundant:
- Multiple sections: "Printer Setup" tab AND "Configure Printer Service" button
- Manual "Auto-Configure" button required after installation
- Unclear status indicators
- Too many steps for a simple task

**Expected Flow:**
1. Install TabezaConnect → Registry gets Bar ID
2. Service starts → Reads Bar ID from registry
3. Service auto-sends heartbeat → Supabase registers driver
4. Staff app shows "🟢 Printer Online"

**Current Flow (Broken):**
1. Install TabezaConnect
2. Open Staff app Settings
3. Navigate to printer section
4. Click "Auto-Configure Printer Service"
5. Wait for confirmation
6. Check status manually

## User Stories

### 1. As a venue owner, I want the printer to connect automatically after installation
**Acceptance Criteria:**
- 1.1 After installing TabezaConnect, the service automatically reads Bar ID from Windows Registry
- 1.2 The service starts sending heartbeats to Supabase without manual intervention
- 1.3 The Staff app detects the printer service within 30 seconds
- 1.4 No "Auto-Configure" button click is required

### 2. As a venue owner, I want to see printer status at a glance
**Acceptance Criteria:**
- 2.1 Settings page shows a single "Printer" section (not multiple tabs/sections)
- 2.2 Status indicator shows: 🟢 Online, 🟡 Connecting, or 🔴 Offline
- 2.3 Last heartbeat timestamp is displayed when online
- 2.4 Driver ID and version are shown when online

### 3. As a venue owner, I want simple troubleshooting when printer is offline
**Acceptance Criteria:**
- 3.1 If printer is offline, show clear next steps:
  - "Download TabezaConnect" link (if never installed)
  - "Start the service" instruction (if installed but not running)
  - "Check connection" button (if service running but not connecting)
- 3.2 No technical jargon or confusing error messages
- 3.3 One-click troubleshooting diagnostics available

### 4. As a developer, I want the printer registration to happen automatically via heartbeat
**Acceptance Criteria:**
- 4.1 TabezaConnect service sends heartbeat every 30 seconds
- 4.2 Heartbeat API upserts to `printer_drivers` table in Supabase
- 4.3 Bar ID is included in heartbeat payload
- 4.4 Driver status is updated on each heartbeat
- 4.5 Stale drivers (>5 min) are marked offline automatically

### 5. As a venue owner, I want to manually reconnect if needed
**Acceptance Criteria:**
- 5.1 A "Reconnect" button is available when status is offline
- 5.2 Clicking "Reconnect" triggers a manual heartbeat
- 5.3 Success/failure feedback is immediate
- 5.4 No page refresh required

## Constraints

### Technical Constraints
- Must work with existing `printer_drivers` table schema
- Must maintain backward compatibility with existing installations
- Must respect venue mode (Basic requires printer, Venue optional)
- Must work behind firewalls (outbound HTTPS only)

### Business Constraints
- Only show printer section if venue mode requires it (Basic or Venue+POS)
- Don't show printer section for Venue+Tabeza mode
- Must be simple enough for non-technical users

### Security Constraints
- Bar ID must never be exposed in client-side code
- Heartbeat must validate Bar ID exists in database
- Service must use secure HTTPS connections

## Out of Scope
- Printer driver installation automation (remains manual download)
- POS system configuration (separate concern)
- Receipt parsing logic (already handled by cloud)
- Multi-printer support (future enhancement)

## Success Metrics
- Reduce printer setup steps from 5+ to 1 (install)
- Reduce support tickets related to printer configuration by 80%
- 95% of installations should show "Online" status within 2 minutes
- Zero manual "Auto-Configure" button clicks required

## Dependencies
- TabezaConnect service must be installed and running
- Windows Registry must contain Bar ID (set by installer)
- Supabase `printer_drivers` table must exist
- Heartbeat API endpoint must be functional

## Assumptions
- Users have administrator access to install TabezaConnect
- Users are running Windows OS
- Internet connection is available for heartbeat
- Bar ID is valid and exists in Supabase
