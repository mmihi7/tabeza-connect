# Printer Driver Heartbeat System - Tasks

## 1. Database Setup

- [x] 1.1 Create migration file `059_create_printer_drivers_table.sql`
- [x] 1.2 Define printer_drivers table schema with all columns
- [x] 1.3 Add indexes for performance optimization
- [x] 1.4 Add check constraint for status enum
- [x] 1.5 Enable Row Level Security on printer_drivers table
- [x] 1.6 Create RLS policy for bar staff to view their drivers
- [x] 1.7 Create RLS policy for system to insert/update drivers
- [x] 1.8 Test migration locally

## 2. API Endpoints Implementation

- [x] 2.1 Replace stub in `apps/staff/app/api/printer/driver-status/route.ts`
  - [x] 2.1.1 Add Supabase client initialization
  - [x] 2.1.2 Query printer_drivers for active drivers (last_heartbeat < 2 min)
  - [x] 2.1.3 Return proper response format with driver details
  - [x] 2.1.4 Handle edge cases (no drivers, database errors)
  - [x] 2.1.5 Add error logging

- [x] 2.2 Create `apps/staff/app/api/printer/heartbeat/route.ts`
  - [x] 2.2.1 Validate required fields (barId, driverId, version)
  - [x] 2.2.2 Verify bar_id exists in database
  - [x] 2.2.3 Upsert driver record (insert if new, update if exists)
  - [x] 2.2.4 Update last_heartbeat timestamp
  - [x] 2.2.5 Return success response
  - [x] 2.2.6 Add error handling and logging

## 3. Printer Service Updates

- [x] 3.1 Add heartbeat configuration constants to `packages/printer-service/index.js`
- [x] 3.2 Implement `sendHeartbeat()` function
  - [x] 3.2.1 Build heartbeat payload
  - [x] 3.2.2 Send POST request to `/api/printer/heartbeat`
  - [x] 3.2.3 Add retry logic with exponential backoff
  - [x] 3.2.4 Track failure count and log errors
  - [x] 3.2.5 Reset failure count on success

- [x] 3.3 Implement `startHeartbeat()` function
  - [x] 3.3.1 Send initial heartbeat immediately
  - [x] 3.3.2 Set up interval for 30-second heartbeats

- [x] 3.4 Implement `stopHeartbeat()` function
- [x] 3.5 Integrate heartbeat into service lifecycle
  - [x] 3.5.1 Call `startHeartbeat()` in `start()` function
  - [x] 3.5.2 Call `stopHeartbeat()` in SIGINT handler

- [x] 3.6 Persist driver_id across restarts
  - [x] 3.6.1 Check if driver_id exists in config.json
  - [x] 3.6.2 Generate and save new driver_id if not exists
  - [x] 3.6.3 Reuse existing driver_id if exists

## 4. UI Component Updates

- [x] 4.1 Update `PrinterStatusIndicator.tsx` component
  - [x] 4.1.1 Replace stub status check with real API call
  - [x] 4.1.2 Add Supabase realtime subscription to printer_drivers
  - [x] 4.1.3 Update status state when heartbeat received
  - [x] 4.1.4 Calculate and display "last seen" time
  - [x] 4.1.5 Handle connection errors gracefully

- [x] 4.2 Test component with printer connected and disconnected

## 5. Testing

- [x] 5.1 Test GET /api/printer/driver-status with no drivers
- [x] 5.2 Test GET /api/printer/driver-status with active driver
- [x] 5.3 Test GET /api/printer/driver-status with offline driver
- [x] 5.4 Test POST /api/printer/heartbeat with valid data
- [x] 5.5 Test POST /api/printer/heartbeat with invalid bar_id
- [x] 5.6 Test POST /api/printer/heartbeat with missing fields
- [x] 5.7 Test full heartbeat flow (service → API → database)
- [x] 5.8 Test driver registration on first heartbeat
- [x] 5.9 Test driver update on subsequent heartbeats
- [x] 5.10 Test offline detection after 2 minutes
- [x] 5.11 Test real-time subscription updates
- [x] 5.12 Test service restart preserves driver_id

## 6. Documentation

- [x] 6.1 Update printer service README with heartbeat feature
- [x] 6.2 Document troubleshooting for heartbeat failures
- [x] 6.3 Update staff app documentation for printer status
- [x] 6.4 Create deployment guide

## 7. Deployment

- [x] 7.1 Deploy database migration to production
- [-] 7.2 Deploy API endpoints to Vercel
- [~] 7.3 Release printer service update
- [~] 7.4 Monitor deployment and error logs
- [~] 7.5 Verify heartbeat success rate

## 8. Post-Deployment

- [~] 8.1 Send notification to venue owners about new feature
- [~] 8.2 Set up alerts for heartbeat failures
- [~] 8.3 Monitor database query performance
- [~] 8.4 Collect user feedback
