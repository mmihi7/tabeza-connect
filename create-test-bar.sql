-- Create test bar for local development
INSERT INTO bars (
    id,
    name,
    location,
    venue_mode,
    authority_mode,
    pos_integration_enabled,
    printer_required,
    onboarding_completed,
    created_at,
    updated_at
) VALUES (
    '438c80c1-fe11-4ac5-8a48-2fc45104ba31',
    'Test Bar - Local Dev',
    'Local Development',
    'basic',  -- Basic mode requires printer
    'pos',    -- POS authority
    true,     -- POS integration enabled
    true,     -- Printer required
    true,     -- Onboarding completed
    NOW(),
    NOW()
)
ON CONFLICT (id) DO UPDATE SET
    venue_mode = 'basic',
    authority_mode = 'pos',
    pos_integration_enabled = true,
    printer_required = true,
    updated_at = NOW();

-- Verify the bar was created
SELECT id, name, venue_mode, authority_mode, pos_integration_enabled, printer_required 
FROM bars 
WHERE id = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';
