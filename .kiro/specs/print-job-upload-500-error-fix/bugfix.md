# Bugfix Requirements Document

## Introduction

The TabezaConnect print service successfully captures receipt files from the watched folder but fails when uploading them to the production endpoint at `http://localhost:3003/api/printer/relay`. The endpoint returns HTTP 500 errors with the message "Failed to process print job". This prevents POS-authoritative venues from delivering digital receipts to customers, which is a critical component of Tabeza Basic mode functionality.

Investigation reveals that the endpoint code structure is correct and has proper error handling, but the actual error details are not being logged sufficiently to diagnose the root cause. The error could be caused by: (1) database insert failures due to data validation, (2) base64 decoding issues with rawData, (3) receipt parsing failures that throw unhandled exceptions, or (4) missing environment variables causing unexpected behavior.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN TabezaConnect uploads a receipt with the payload structure `{driverId, barId, timestamp, rawData, printerName, documentName, metadata}` THEN the `/api/printer/relay` endpoint returns HTTP 500 with error message "Failed to process print job"

1.2 WHEN the endpoint catches an exception during processing THEN it logs only "Error processing print relay:" without detailed error information (error type, stack trace, or which operation failed)

1.3 WHEN the upload fails with HTTP 500 THEN the retry mechanism activates with exponential backoff (5s, 10s, 20s, 40s) but continues to fail on all retry attempts

1.4 WHEN multiple receipts fail to upload THEN the queue builds up with pending receipts that cannot be processed

1.5 WHEN the database insert fails THEN the error message from Supabase is not logged with sufficient detail to identify if it's a constraint violation, RLS policy issue, or data type mismatch

### Expected Behavior (Correct)

2.1 WHEN TabezaConnect uploads a receipt with valid payload structure THEN the `/api/printer/relay` endpoint SHALL successfully process the print job and return HTTP 200 with `{success: true, jobId, message}`

2.2 WHEN the endpoint receives a valid receipt THEN it SHALL create a print_jobs record in the database with status 'no_match' so it appears in Captain's Orders

2.3 WHEN the upload succeeds THEN the receipt SHALL be marked as uploaded in the local queue and removed from pending receipts

2.4 WHEN an error occurs during processing THEN the endpoint SHALL log detailed error information including: (a) the operation that failed (JSON parsing, base64 decoding, receipt parsing, or database insert), (b) the error message and type, (c) the error stack trace, and (d) relevant payload details (barId, driverId, data sizes)

2.5 WHEN the database insert fails THEN the endpoint SHALL log the complete Supabase error object including error code, message, details, and hint to enable diagnosis of constraint violations or RLS policy issues

2.6 WHEN base64 decoding of rawData fails THEN the endpoint SHALL log the rawData length and first 100 characters to help identify encoding issues

2.7 WHEN receipt parsing fails THEN the endpoint SHALL still create the print_jobs record with low confidence parsing (following the foundational rule "Never reject a receipt")

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the endpoint receives a request with missing required fields (barId or rawData) THEN the system SHALL CONTINUE TO return HTTP 400 with appropriate error message

3.2 WHEN the endpoint successfully processes a receipt THEN the system SHALL CONTINUE TO parse receipt data (either from parsedData field or locally via DeepSeek/regex) and determine parsing confidence level (high, medium, low)

3.3 WHEN the endpoint creates a print job THEN the system SHALL CONTINUE TO follow the foundational rule "Never reject a receipt. Always accept, always store."

3.4 WHEN TabezaConnect's heartbeat mechanism sends status updates THEN the system SHALL CONTINUE TO process heartbeats successfully without interference from the upload bug

3.5 WHEN the UploadWorker processes the queue THEN the system SHALL CONTINUE TO use exponential backoff retry strategy for transient network errors

3.6 WHEN the endpoint uses the service role client THEN the system SHALL CONTINUE TO bypass RLS policies for print_jobs inserts

3.7 WHEN receipt parsing uses DeepSeek API THEN the system SHALL CONTINUE TO fall back to regex parsing if DeepSeek fails or times out (10s timeout)

3.8 WHEN the test receipt delivery HTML page sends test receipts THEN the system SHALL CONTINUE TO accept and process them successfully
