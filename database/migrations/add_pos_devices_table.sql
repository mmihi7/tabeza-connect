-- POS Device/Printer Connection Tracking
-- Stores status of TabezaConnect installations

CREATE TABLE IF NOT EXISTS public.pos_devices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  bar_id uuid NOT NULL,
  device_id text NOT NULL,
  device_name text NULL,
  
  -- Connection status
  status text NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'error')),
  last_heartbeat_at timestamptz NULL,
  last_error text NULL,
  
  -- Device info from heartbeat
  version text NULL,
  os_info jsonb NULL,
  capture_mode text NULL, -- 'spooler' or 'folder'
  
  -- Statistics
  receipts_captured integer NOT NULL DEFAULT 0,
  receipts_uploaded integer NOT NULL DEFAULT 0,
  last_receipt_at timestamptz NULL,
  
  -- Timestamps
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT pos_devices_pkey PRIMARY KEY (id),
  CONSTRAINT pos_devices_bar_id_fkey FOREIGN KEY (bar_id) REFERENCES bars(id) ON DELETE CASCADE,
  CONSTRAINT pos_devices_unique_device UNIQUE (bar_id, device_id)
) TABLESPACE pg_default;

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_pos_devices_bar ON public.pos_devices USING btree (bar_id);
CREATE INDEX IF NOT EXISTS idx_pos_devices_status ON public.pos_devices USING btree (bar_id, status);
CREATE INDEX IF NOT EXISTS idx_pos_devices_heartbeat ON public.pos_devices USING btree (last_heartbeat_at DESC);
CREATE INDEX IF NOT EXISTS idx_pos_devices_device_id ON public.pos_devices USING btree (device_id);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_pos_devices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_pos_devices_updated_at
  BEFORE UPDATE ON pos_devices
  FOR EACH ROW
  EXECUTE FUNCTION update_pos_devices_updated_at();

-- Function to mark devices offline if no heartbeat for 2 minutes
CREATE OR REPLACE FUNCTION mark_stale_devices_offline()
RETURNS void AS $$
BEGIN
  UPDATE pos_devices
  SET status = 'offline'
  WHERE status = 'online'
    AND last_heartbeat_at < (now() - interval '2 minutes');
END;
$$ LANGUAGE plpgsql;

-- Optional: Schedule this function to run periodically via pg_cron
-- SELECT cron.schedule('mark-stale-devices', '* * * * *', 'SELECT mark_stale_devices_offline()');
