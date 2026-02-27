# Preservation Property Tests - Findings

## Test Execution Summary

**Date**: 2025-01-XX
**Test File**: `apps/staff/app/api/printer/relay/__tests__/preservation.test.ts`
**Status**: ✅ All tests PASSED on unfixed code (baseline behavior confirmed)

## Test Results

### Property 1: HTTP 400 for Missing Required Fields ✅

**Requirement 3.1**: Requests with missing required fields return HTTP 400

**Test Coverage**:
- ✅ Missing `barId` returns HTTP 400 with error message (20 property-based test runs)
- ✅ Missing `rawData` returns HTTP 400 with error message (20 property-based test runs)
- ✅ Missing both fields returns HTTP 400

**Baseline Behavior Confirmed**: The endpoint correctly validates required fields and returns appropriate error responses. This behavior must be preserved after the fix.

### Property 2: Parsing Confidence Determination ✅

**Requirement 3.2**: Parsing confidence logic (high, medium, low) works correctly

**Test Coverage**:
- ✅ HIGH confidence when items AND total are present (20 property-based test runs)
- ✅ MEDIUM confidence when only total is present (20 property-based test runs)

**Baseline Behavior Confirmed**: The parsing confidence determination logic correctly classifies receipts based on extracted data. This logic must remain unchanged after the fix.

**Confidence Rules Observed**:
```typescript
if (hasItems && hasTotal) {
  parsingConfidence = 'high';
} else if (hasTotal && !hasItems) {
  parsingConfidence = 'medium';
} else if (hasItems && !hasTotal) {
  parsingConfidence = 'medium';
} else {
  parsingConfidence = 'low';
}
```

### Property 3: Foundational Rule - Never Reject a Receipt ✅

**Requirement 3.3**: The foundational rule "Never reject a receipt. Always accept, always store." is enforced

**Requirement 3.7**: Receipt parsing falls back gracefully when parsing fails

**Test Coverage**:
- ✅ Empty parsing results (no items, zero total) produce LOW confidence
- ✅ Local parsing is attempted when no parsedData is provided
- ✅ Parsing failures are caught and fallback data is created

**Baseline Behavior Confirmed**: The endpoint catches parsing errors and creates fallback parsed_data objects with empty items and zero total. This ensures receipts are never rejected, even when parsing fails.

**Fallback Data Structure**:
```typescript
{
  items: [],
  total: 0,
  rawText: 'Failed to parse receipt'
}
```

### Property 4: Service Role Client Bypasses RLS ✅

**Requirement 3.6**: Service role client is used for database operations

**Test Coverage**:
- ✅ Service role client is used for all database inserts (20 property-based test runs)

**Baseline Behavior Confirmed**: The endpoint uses the service role client (created with `SUPABASE_SECRET_KEY`) which bypasses RLS policies. This must continue after the fix.

### Property 5: Parsed Data Structure ✅

**Requirement 3.2**: Parsed data can come from payload or local parsing

**Test Coverage**:
- ✅ Provided `parsedData` in payload is used directly (20 property-based test runs)
- ✅ Local parsing via `parseReceipt()` is called when no parsedData provided (20 property-based test runs)

**Baseline Behavior Confirmed**: The endpoint has two paths for obtaining parsed data:
1. Use `parsedData` from payload (preferred, from TabezaConnect)
2. Parse locally using `parseReceipt()` (fallback)

This dual-path approach must be preserved after the fix.

### Property 6: Metadata Structure ✅

**Requirement 3.2**: Metadata from payload is preserved and parsing_confidence is added

**Test Coverage**:
- ✅ Metadata from payload is preserved in database insert (20 property-based test runs)
- ✅ `parsing_confidence` field is added to metadata
- ✅ Confidence value is one of: 'high', 'medium', 'low'

**Baseline Behavior Confirmed**: The endpoint merges payload metadata with system-generated metadata (parsing_confidence). This structure must remain unchanged after the fix.

**Metadata Structure**:
```typescript
{
  ...metadata, // From payload
  parsing_confidence: 'high' | 'medium' | 'low'
}
```

### Property 7: Status Always 'no_match' ✅

**Requirement 3.3**: All receipts are created with status 'no_match'

**Test Coverage**:
- ✅ All print_jobs records have status 'no_match' (20 property-based test runs)

**Baseline Behavior Confirmed**: The endpoint always sets `status: 'no_match'` so receipts appear in Captain's Orders for staff assignment. This must continue after the fix.

## Behaviors to Preserve

The following behaviors MUST remain unchanged after implementing the fix:

1. **HTTP 400 Validation**: Missing `barId` or `rawData` returns HTTP 400
2. **Parsing Confidence Logic**: High/medium/low determination based on items and total
3. **Foundational Rule**: Never reject a receipt, always create print_jobs record
4. **Parsing Fallback**: Catch parsing errors and create fallback data
5. **Service Role Client**: Use service role client for database operations
6. **Dual Parsing Path**: Support both provided parsedData and local parsing
7. **Metadata Preservation**: Preserve payload metadata and add parsing_confidence
8. **Status Assignment**: Always set status to 'no_match'

## Test Strategy Notes

### Why Property-Based Testing?

Property-based testing was used for preservation tests because:
- Generates many test cases automatically (20 runs per property)
- Catches edge cases that manual tests might miss
- Provides strong guarantees that behavior is unchanged across the input domain
- Fast-check library shrinks failing cases to minimal counterexamples

### Handling the Bug in Preservation Tests

The bug in unfixed code prevents database inserts from succeeding for valid receipts. To work around this in preservation tests:
- Tests focus on behaviors that can be observed even when the bug is present
- Tests use mocked database responses to isolate the logic being tested
- Tests verify parsing logic, validation logic, and data structure logic
- Tests avoid triggering the bug by providing parsedData in payloads where needed

## Conclusion

All preservation property tests PASS on unfixed code, confirming the baseline behaviors that must be preserved. These tests will continue to run after the fix is implemented to ensure no regressions are introduced.

The tests provide strong guarantees through property-based testing with 20+ runs per property, covering a wide range of input variations.

## Files Created

- `apps/staff/app/api/printer/relay/__tests__/preservation.test.ts` - Preservation property tests
- `.kiro/specs/print-job-upload-500-error-fix/preservation-test-findings.md` - This document
