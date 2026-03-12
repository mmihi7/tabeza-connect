# Property-Based Tests for Textifier

## Installation

Before running the property-based tests, you need to install fast-check:

```bash
cd C:\Projects\tabeza-connect
npm install
```

This will install fast-check (version ^3.15.0) which is already added to package.json devDependencies.

## Running the Tests

### Run all textifier tests (unit + property-based):
```bash
npm test -- textifier
```

### Run only property-based tests:
```bash
npm test -- textifier.property.test.js
```

### Run with verbose output:
```bash
npm test -- textifier.property.test.js --verbose
```

## Test Coverage

The property-based tests verify 12 universal properties:

1. **Property 4.1: Idempotency** - textify(textify(x)) === textify(x)
2. **Property 4.2: Length Preservation** - Output length ≤ input length
3. **Property 4.3: Character Preservation** - \r, \n, \t are preserved
4. **Property 4.4: No Control Codes** - Output contains no ESC/POS codes
5. **Property 4.5: Space Collapsing** - No multiple consecutive spaces
6. **Property 4.6: Performance** - Completes in < 10ms for 10KB buffers
7. **Property 4.7: Empty Input Handling** - Empty input → empty output
8. **Property 4.8: Encoding Consistency** - Windows-1252 text is preserved
9. **Property 4.9: Non-Printable Replacement** - Control codes → spaces
10. **Property 4.10: Deterministic Output** - Same input → same output
11. **Property 4.11: Options Respect** - collapseSpaces option works
12. **Property 4.12: Buffer Type Validation** - Throws TypeError for non-Buffer

Each property test runs 100 iterations with randomized inputs.

## Requirements Validated

These tests validate the following requirements from the spec:

- **Requirement 3.1**: Windows-1252 decoding
- **Requirement 3.2**: Non-printable character replacement
- **Requirement 3.3**: Space collapsing
- **Requirement 3.4**: Line break and tab preservation
- **Requirement 3.6**: Performance (< 10ms per receipt)

## Troubleshooting

### fast-check not found
If you see "Cannot find module 'fast-check'", run:
```bash
npm install
```

### Tests timing out
If performance tests fail, check system load. The 10ms target assumes normal system conditions.

### Random test failures
Property-based tests use randomized inputs. If a test fails:
1. Note the seed value from the error message
2. Re-run with the same seed to reproduce: `fc.assert(..., { seed: <value> })`
3. Investigate the specific input that caused the failure

## Test Configuration

- **Library**: fast-check v3.15.0+
- **Iterations**: 100 per property test
- **Max input size**: 10KB (10,240 bytes)
- **Feature tag**: redmon-receipt-capture
- **Property tag**: Property 4 (ESC/POS Textification Correctness)
