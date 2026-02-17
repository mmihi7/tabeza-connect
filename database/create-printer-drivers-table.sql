-- Create printer_drivers table for TabezaConnect heartbeat tracking
-- This table stores driver instances and their heartbeat status

CREATE TABLE IF NOT EXISTS public.printer_drivers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    bar_id UUID NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
    driver_id TEXT NOT NULL,
    version TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'online',
    last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_printer_drivers_bar_id ON public.printer_drivers(bar_id);
CREATE INDEX IF NOT EXISTS idx_printer_drivers_driver_id ON public.printer_drivers(driver_id);
CREATE INDEX IF NOT EXISTS idx_printer_drivers_last_heartbeat ON public.printer_drivers(last_heartbeat DESC);
CREATE INDEX IF NOT EXISTS idx_printer_drivers_status ON public.printer_drivers(status);

-- Add RLS (Row Level Security) policies
ALTER TABLE public.printer_drivers ENABLE ROW LEVEL SECURITY;

-- Create RLS policy to allow users to see drivers for their own bars only
CREATE POLICY printer_drivers_bar_policy ON public.printer_drivers
    USING (bar_id IS NOT NULL)
    WITH CHECK (bar_id = current_setting('app.bar_id'));

-- Create RLS policy to allow service accounts to see all drivers
CREATE POLICY printer_drivers_service_policy ON public.printer_drivers
    USING (auth.jwt() -> 'app_metadata' -> 'role')
    WITH CHECK (auth.jwt() -> 'app_metadata' -> 'role' = 'service');

-- Apply both policies
ALTER TABLE public.printer_drivers ENABLE ROW LEVEL SECURITY;

-- Add comments for documentation
COMMENT ON TABLE public.printer_drivers IS 'Stores TabezaConnect printer driver instances and heartbeat status';
COMMENT ON COLUMN public.printer_drivers.id IS 'Unique identifier for the driver record';
COMMENT ON COLUMN public.printer_drivers.bar_id IS 'Foreign key to the bars table';
COMMENT ON COLUMN public.printer_drivers.driver_id IS 'Unique identifier for the printer driver instance (e.g., driver-hostname)';
COMMENT ON COLUMN public.printer_drivers.version IS 'Version of the TabezaConnect service';
COMMENT ON COLUMN public.printer_drivers.status IS 'Current status: online, offline, error';
COMMENT ON COLUMN public.printer_drivers.last_heartbeat IS 'Timestamp of the last heartbeat received';
COMMENT ON COLUMN public.printer_drivers.first_seen IS 'Timestamp when this driver was first registered';
COMMENT ON COLUMN public.printer_drivers.metadata IS 'JSON metadata about the driver (hostname, platform, etc.)';
