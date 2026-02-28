# Task 2.3 Verification Checklist

## Manual Testing Instructions

### Prerequisites
1. Ensure the customer app is running on port 3002
2. Have access to the database to run SQL scripts
3. Have Node.js installed to run test scripts

### Step 1: Create Test Data

Run the SQL script to create test tabs with different scenarios:

```bash
# Connect to your database and run:
psql <your_database_connection_string> -f dev-tools/sql/test-close-tab-balance-checks.sql
```

This will create 5 test tabs and output their IDs and device identifiers.

### Step 2: Test Each Scenario

Use the test script to verify each scenario:

#### Test Case 1: Zero Balance (Should Succeed)
```bash
node dev-tools/scripts/test-close-tab-api.js \
  "<tab_id_from_sql_output>" \
  "test-device-balance-check-<uuid>-zero"
```

**Expected Result**: 
- Status: 200 OK
- Response includes: `"success": true`, `"balance": 0`

#### Test Case 2: Positive Balance (Should Fail)
```bash
node dev-tools/scripts/test-close-tab-api.js \
  "<tab_id_from_sql_output>" \
  "test-device-balance-check-<uuid>-positive"
```

**Expected Result**:
- Status: 400 Bad Request
- Response includes: `"error": "Cannot close tab with outstanding balance"`
- Details show: `"balance": 150`

#### Test Case 3: Pending Staff Orders (Should Fail)
```bash
node dev-tools/scripts/test-close-tab-api.js \
  "<tab_id_from_sql_output>" \
  "test-device-balance-check-<uuid>-staff-pending"
```

**Expected Result**:
- Status: 400 Bad Request
- Response includes: `"error": "Cannot close tab with pending staff orders"`
- Details show: `"pendingStaffOrders": 1`

#### Test Case 4: Pending Customer Orders (Should Fail)
```bash
node dev-tools/scripts/test-close-tab-api.js \
  "<tab_id_from_sql_output>" \
  "test-device-balance-check-<uuid>-customer-pending"
```

**Expected Result**:
- Status: 400 Bad Request
- Response includes: `"error": "Cannot close tab with pending customer orders"`
- Details show: `"pendingCustomerOrders": 1`

#### Test Case 5: Negative Balance/Overpaid (Should Succeed)
```bash
node dev-tools/scripts/test-close-tab-api.js \
  "<tab_id_from_sql_output>" \
  "test-device-balance-check-<uuid>-negative"
```

**Expected Result**:
- Status: 200 OK
- Response includes: `"success": true`, `"balance": -50`

### Step 3: Test Error Cases

#### Test Case 6: Missing Device ID (Should Fail)
```bash
curl -X POST http://localhost:3002/api/tabs/close \
  -H "Content-Type: application/json" \
  -d '{"tabId": "<any_tab_id>"}'
```

**Expected Result**:
- Status: 401 Unauthorized
- Response: `"error": "Device identifier is required for authorization"`

#### Test Case 7: Wrong Device ID (Should Fail)
```bash
node dev-tools/scripts/test-close-tab-api.js \
  "<tab_id_from_sql_output>" \
  "wrong-device-id"
```

**Expected Result**:
- Status: 401 Unauthorized
- Response: `"error": "Unauthorized to close this tab"`

#### Test Case 8: Non-existent Tab (Should Fail)
```bash
node dev-tools/scripts/test-close-tab-api.js \
  "00000000-0000-0000-0000-000000000000" \
  "any-device-id"
```

**Expected Result**:
- Status: 404 Not Found
- Response: `"error": "Tab not found"`

## Verification Checklist

### Balance Calculation
- [ ] Confirmed orders are correctly summed
- [ ] Successful payments are correctly summed
- [ ] Balance is calculated as orders - payments
- [ ] Positive balance prevents closure
- [ ] Zero balance allows closure
- [ ] Negative balance (overpaid) allows closure

### Pending Orders Check
- [ ] Pending staff orders are detected
- [ ] Pending customer orders are detected
- [ ] Pending staff orders prevent closure
- [ ] Pending customer orders prevent closure
- [ ] Error messages include order counts
- [ ] Error messages are user-friendly

### Error Handling
- [ ] Database errors return 500 status
- [ ] Missing device ID returns 401 status
- [ ] Wrong device ID returns 401 status
- [ ] Non-existent tab returns 404 status
- [ ] Positive balance returns 400 status
- [ ] Pending orders return 400 status
- [ ] Error responses include helpful details

### Response Format
- [ ] Success responses include tab details
- [ ] Success responses include balance
- [ ] Error responses include error message
- [ ] Error responses include details object
- [ ] All responses are valid JSON

### Logging
- [ ] Balance calculation is logged
- [ ] Pending orders check is logged
- [ ] Success/failure reasons are logged
- [ ] Device verification is logged

## Code Quality Checks

- [x] TypeScript compiles without errors
- [x] No linting errors
- [x] Code follows project conventions
- [x] Comments explain business logic
- [x] Requirements are referenced in comments

## Documentation

- [x] Implementation summary created
- [x] Test scripts documented
- [x] Verification checklist created
- [x] Requirements mapped to implementation

## Next Steps

After verifying all checks pass:
1. Proceed to Task 2.4: Implement close_tab RPC call
2. The RPC call will actually close the tab after all validations pass
3. Integration testing will be performed in Task 9

## Notes

- The API currently returns success but doesn't actually close the tab
- Task 2.4 will add the RPC call to complete the closure
- All validation logic is in place and ready for the RPC integration
