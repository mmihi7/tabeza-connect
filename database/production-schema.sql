-- Tabeza Production Schema
-- CORE TRUTH: Manual service always exists. 
-- Digital authority is singular. 
-- Tabeza adapts to the venue — never the reverse.

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE transaction_status AS ENUM ('pending', 'sent', 'completed', 'failed', 'cancelled');
CREATE TYPE venue_mode_enum AS ENUM ('basic', 'venue');
CREATE TYPE authority_mode_enum AS ENUM ('pos', 'tabeza');
CREATE TYPE receipt_status AS ENUM ('CAPTURED', 'PARSING', 'PARSED', 'UNCLAIMED', 'CLAIMED', 'PAID', 'VOID', 'PARSE_FAILED');
CREATE TYPE rejection_reason AS ENUM ('out_of_stock', 'kitchen_closed', 'invalid_item', 'other');

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Bars (Venues)
CREATE TABLE bars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT,
  phone TEXT,
  email TEXT,
  webhook_url TEXT,
  qr_code_url TEXT,
  subscription_tier TEXT DEFAULT 'free',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  slug TEXT UNIQUE,
  pdf_menu_url TEXT,
  menu_type TEXT DEFAULT 'interactive',
  static_menu_url TEXT,
  static_menu_type TEXT,
  notification_new_orders BOOLEAN DEFAULT false,
  notification_pending_approvals BOOLEAN DEFAULT false,
  notification_payments BOOLEAN DEFAULT false,
  payment_cash_enabled BOOLEAN DEFAULT true,
  payment_card_enabled BOOLEAN DEFAULT false,
  card_provider TEXT,
  business_hours_mode TEXT DEFAULT 'simple',
  business_hours_simple JSONB,
  business_hours_advanced JSONB,
  business_24_hours BOOLEAN DEFAULT false,
  timezone TEXT DEFAULT 'Africa/Nairobi',
  slideshow_settings JSONB DEFAULT '{"transitionSpeed": 10000}',
  alert_timeout INTEGER DEFAULT 5,
  alert_sound_enabled BOOLEAN DEFAULT true,
  alert_custom_audio_url TEXT,
  alert_volume NUMERIC(3, 2) DEFAULT 0.8,
  alert_custom_audio_name TEXT,
  table_setup_enabled BOOLEAN DEFAULT false,
  table_count INTEGER DEFAULT 0,
  mpesa_enabled BOOLEAN DEFAULT false,
  mpesa_environment VARCHAR(20) DEFAULT 'sandbox',
  mpesa_business_shortcode VARCHAR(20),
  mpesa_consumer_key_encrypted TEXT,
  mpesa_consumer_secret_encrypted TEXT,
  mpesa_passkey_encrypted TEXT,
  mpesa_callback_url TEXT,
  mpesa_setup_completed BOOLEAN DEFAULT false,
  mpesa_last_test_at TIMESTAMPTZ,
  mpesa_test_status VARCHAR(20) DEFAULT 'pending',
  venue_mode venue_mode_enum DEFAULT 'venue',
  authority_mode authority_mode_enum DEFAULT 'tabeza',
  pos_integration_enabled BOOLEAN DEFAULT false,
  printer_required BOOLEAN DEFAULT false,
  onboarding_completed BOOLEAN DEFAULT false,
  authority_configured_at TIMESTAMPTZ,
  mode_last_changed_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT bars_venue_authority_check CHECK (
    (venue_mode = 'basic' AND authority_mode = 'pos') OR
    (venue_mode = 'venue' AND authority_mode IN ('pos', 'tabeza'))
  ),
  CONSTRAINT bars_printer_requirement_check CHECK (
    (venue_mode = 'basic' AND printer_required = true) OR
    (venue_mode = 'venue')
  ),
  CONSTRAINT bars_pos_integration_check CHECK (
    (authority_mode = 'pos' AND pos_integration_enabled = true) OR
    (authority_mode = 'tabeza' AND pos_integration_enabled = false)
  )
);

CREATE INDEX idx_bars_slug ON bars(slug);
CREATE INDEX idx_bars_venue_mode ON bars(venue_mode);
CREATE INDEX idx_bars_authority_mode ON bars(authority_mode);
CREATE INDEX idx_bars_onboarding_completed ON bars(onboarding_completed);

-- Suppliers
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT,
  subscription_tier TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  category TEXT,
  image_url TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_supplier_id ON products(supplier_id);

-- Categories
CREATE TABLE categories (
  name TEXT PRIMARY KEY,
  image_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Custom Products
CREATE TABLE custom_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID REFERENCES bars(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  description TEXT,
  image_url TEXT,
  sku TEXT UNIQUE
);

CREATE INDEX idx_custom_products_bar ON custom_products(bar_id);

-- Bar Products
CREATE TABLE bar_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID REFERENCES bars(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  sale_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  custom_product_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  image_url TEXT,
  sku TEXT,
  CONSTRAINT check_product_xor_custom CHECK (
    (product_id IS NULL) <> (custom_product_id IS NULL)
  )
);

CREATE INDEX idx_bar_products_bar ON bar_products(bar_id);
CREATE INDEX idx_bar_products_product ON bar_products(product_id);
CREATE INDEX idx_bar_products_custom ON bar_products(custom_product_id);
CREATE INDEX idx_bar_products_category ON bar_products(category);

-- Food Products
CREATE TABLE food_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID REFERENCES bars(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  sale_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  custom_product_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  image_url TEXT,
  sku TEXT,
  CONSTRAINT food_check_product_xor_custom CHECK (
    (product_id IS NULL) <> (custom_product_id IS NULL)
  )
);

CREATE INDEX idx_food_products_bar ON food_products(bar_id);
CREATE INDEX idx_food_products_product ON food_products(product_id);

-- User Bars (Staff assignments)
CREATE TABLE user_bars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  bar_id UUID NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'staff',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, bar_id)
);

CREATE INDEX idx_user_bars_user_id ON user_bars(user_id);
CREATE INDEX idx_user_bars_bar_id ON user_bars(bar_id);

-- ============================================================================
-- DEVICE & TAB MANAGEMENT
-- ============================================================================

-- Devices
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT UNIQUE NOT NULL,
  fingerprint TEXT UNIQUE NOT NULL,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  last_bar_id UUID REFERENCES bars(id),
  is_active BOOLEAN DEFAULT true,
  suspicious_activity_count INTEGER DEFAULT 0,
  user_agent TEXT,
  platform TEXT,
  screen_resolution TEXT,
  timezone TEXT,
  is_suspicious BOOLEAN DEFAULT false,
  language TEXT,
  hardware_concurrency INTEGER,
  device_memory INTEGER,
  install_count INTEGER DEFAULT 1,
  last_install_at TIMESTAMPTZ DEFAULT NOW(),
  pwa_installed BOOLEAN DEFAULT false,
  total_tabs_created INTEGER DEFAULT 0,
  total_amount_spent NUMERIC(10, 2) DEFAULT 0.00,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_devices_device_id ON devices(device_id);
CREATE INDEX idx_devices_fingerprint ON devices(fingerprint);
CREATE INDEX idx_devices_user_id ON devices(user_id);
CREATE INDEX idx_devices_last_seen ON devices(last_seen DESC);

-- Tabs
CREATE TABLE tabs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
  tab_number INTEGER NOT NULL,
  owner_identifier TEXT,
  status TEXT DEFAULT 'open',
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  closed_by TEXT,
  device_identifier TEXT,
  moved_to_overdue_at TIMESTAMPTZ,
  overdue_reason TEXT,
  sound_enabled BOOLEAN DEFAULT true,
  vibration_enabled BOOLEAN DEFAULT true,
  UNIQUE(bar_id, tab_number),
  CONSTRAINT tabs_status_check CHECK (status IN ('open', 'overdue', 'closed'))
);

CREATE INDEX idx_tabs_bar ON tabs(bar_id);
CREATE INDEX idx_tabs_status ON tabs(status);
CREATE INDEX idx_tabs_owner ON tabs(owner_identifier);
CREATE INDEX idx_tabs_bar_status ON tabs(bar_id, status);

-- Tab Orders
CREATE TABLE tab_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_id UUID NOT NULL REFERENCES tabs(id) ON DELETE CASCADE,
  items JSONB NOT NULL,
  total NUMERIC(10, 2) NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  initiated_by TEXT DEFAULT 'customer',
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  order_number INTEGER,
  rejection_reason rejection_reason,
  cancelled_by TEXT,
  CONSTRAINT tab_orders_status_check CHECK (status IN ('pending', 'confirmed', 'cancelled'))
);

CREATE INDEX idx_orders_tab ON tab_orders(tab_id);
CREATE INDEX idx_orders_status ON tab_orders(status);
CREATE INDEX idx_orders_created ON tab_orders(created_at);

-- Tab Payments
CREATE TABLE tab_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_id UUID NOT NULL REFERENCES tabs(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  method TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  reference TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT tab_payments_method_check CHECK (method IN ('mpesa', 'cash', 'card')),
  CONSTRAINT tab_payments_status_check CHECK (status IN ('pending', 'success', 'failed'))
);

CREATE INDEX idx_payments_tab ON tab_payments(tab_id);
CREATE INDEX idx_payments_method ON tab_payments(method);
CREATE INDEX idx_payments_status ON tab_payments(status);

-- Tab Telegram Messages
CREATE TABLE tab_telegram_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_id UUID NOT NULL REFERENCES tabs(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  order_type VARCHAR(20) DEFAULT 'telegram',
  status VARCHAR(20) DEFAULT 'pending',
  message_metadata JSONB DEFAULT '{}',
  customer_notified BOOLEAN DEFAULT false,
  staff_acknowledged_at TIMESTAMPTZ,
  customer_notified_at TIMESTAMPTZ,
  initiated_by VARCHAR(20) DEFAULT 'customer',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tab_telegram_messages_tab_id ON tab_telegram_messages(tab_id);
CREATE INDEX idx_tab_telegram_messages_status ON tab_telegram_messages(status);

-- ============================================================================
-- POS INTEGRATION TABLES
-- ============================================================================

-- Printer Drivers
CREATE TABLE printer_drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
  driver_id TEXT UNIQUE NOT NULL,
  version TEXT NOT NULL,
  status TEXT DEFAULT 'online',
  last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT printer_drivers_status_check CHECK (status IN ('online', 'offline', 'error'))
);

CREATE INDEX idx_printer_drivers_bar_id ON printer_drivers(bar_id);
CREATE INDEX idx_printer_drivers_driver_id ON printer_drivers(driver_id);
CREATE INDEX idx_printer_drivers_last_heartbeat ON printer_drivers(last_heartbeat DESC);
CREATE INDEX idx_printer_drivers_status ON printer_drivers(status);

-- Raw POS Receipts
CREATE TABLE raw_pos_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  escpos_bytes TEXT,
  text TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_raw_pos_receipts_bar ON raw_pos_receipts(bar_id);
CREATE INDEX idx_raw_pos_receipts_timestamp ON raw_pos_receipts(timestamp DESC);
CREATE INDEX idx_raw_pos_receipts_device ON raw_pos_receipts(device_id);

-- POS Receipts
CREATE TABLE pos_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_receipt_id UUID NOT NULL REFERENCES raw_pos_receipts(id) ON DELETE CASCADE,
  bar_id UUID NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
  receipt_number TEXT,
  subtotal NUMERIC(10, 2) NOT NULL,
  tax NUMERIC(10, 2) NOT NULL,
  total NUMERIC(10, 2) NOT NULL,
  currency TEXT DEFAULT 'KES',
  parsed_at TIMESTAMPTZ DEFAULT NOW(),
  confidence_score NUMERIC(3, 2) NOT NULL,
  parsing_method TEXT NOT NULL,
  template_version INTEGER,
  status receipt_status DEFAULT 'PARSED',
  claimed_by_tab_id UUID REFERENCES tabs(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  voided_at TIMESTAMPTZ,
  voided_by_staff_id UUID,
  CONSTRAINT pos_receipts_confidence_check CHECK (confidence_score >= 0.00 AND confidence_score <= 1.00),
  CONSTRAINT pos_receipts_parsing_method_check CHECK (parsing_method IN ('regex', 'ai'))
);

CREATE INDEX idx_pos_receipts_bar ON pos_receipts(bar_id);
CREATE INDEX idx_pos_receipts_raw ON pos_receipts(raw_receipt_id);
CREATE INDEX idx_pos_receipts_tab ON pos_receipts(claimed_by_tab_id);
CREATE INDEX idx_pos_receipts_status ON pos_receipts(status);

-- POS Receipt Items
CREATE TABLE pos_receipt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES pos_receipts(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  item_name TEXT NOT NULL,
  unit_price NUMERIC(10, 2) NOT NULL,
  total_price NUMERIC(10, 2) NOT NULL,
  CONSTRAINT pos_receipt_items_quantity_check CHECK (quantity > 0),
  CONSTRAINT pos_receipt_items_price_check CHECK (unit_price >= 0 AND total_price >= 0)
);

CREATE INDEX idx_pos_receipt_items_receipt ON pos_receipt_items(receipt_id);

-- Receipt Parsing Templates
CREATE TABLE receipt_parsing_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  patterns JSONB NOT NULL,
  semantic_map JSONB NOT NULL,
  known_edge_cases JSONB,
  confidence_threshold NUMERIC(3, 2) DEFAULT 0.85,
  active BOOLEAN DEFAULT false,
  accuracy NUMERIC(3, 2),
  receipt_samples_used INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  activated_at TIMESTAMPTZ
);

CREATE INDEX idx_parsing_templates_bar ON receipt_parsing_templates(bar_id);
CREATE INDEX idx_parsing_templates_active ON receipt_parsing_templates(bar_id, active);

-- ============================================================================
-- M-PESA TABLES
-- ============================================================================

-- M-Pesa Credentials
CREATE TABLE mpesa_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
  environment TEXT NOT NULL,
  business_shortcode TEXT NOT NULL,
  consumer_key_enc BYTEA NOT NULL,
  consumer_secret_enc BYTEA NOT NULL,
  passkey_enc BYTEA NOT NULL,
  callback_url TEXT NOT NULL,
  timeout_url TEXT,
  initiator_name TEXT,
  security_credential_enc BYTEA,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, environment)
);

CREATE INDEX idx_mpesa_credentials_tenant_id ON mpesa_credentials(tenant_id);

-- M-Pesa Transactions
CREATE TABLE mpesa_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_id UUID NOT NULL REFERENCES tabs(id) ON DELETE CASCADE,
  customer_id TEXT,
  phone_number TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT DEFAULT 'KES',
  status transaction_status DEFAULT 'pending',
  checkout_request_id TEXT UNIQUE,
  merchant_request_id TEXT,
  mpesa_receipt_number TEXT UNIQUE,
  transaction_date TIMESTAMPTZ,
  failure_reason TEXT,
  result_code INTEGER,
  environment TEXT NOT NULL,
  callback_data JSONB,
  tab_payment_id UUID REFERENCES tab_payments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT mpesa_transactions_amount_check CHECK (amount > 0)
);

CREATE INDEX idx_mpesa_transactions_tab_id ON mpesa_transactions(tab_id);
CREATE INDEX idx_mpesa_transactions_status ON mpesa_transactions(status);
CREATE INDEX idx_mpesa_transactions_phone ON mpesa_transactions(phone_number);

-- ============================================================================
-- AUDIT & FEEDBACK
-- ============================================================================

-- Audit Logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID REFERENCES bars(id) ON DELETE CASCADE,
  tab_id UUID REFERENCES tabs(id) ON DELETE SET NULL,
  staff_id UUID,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_bar ON audit_logs(bar_id);
CREATE INDEX idx_audit_tab ON audit_logs(tab_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at);

-- Feedback
CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  bar_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Slideshow Images
CREATE TABLE slideshow_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID REFERENCES bars(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  display_order INTEGER NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bar_id, display_order)
);

CREATE INDEX idx_slideshow_images_bar_id ON slideshow_images(bar_id);
CREATE INDEX idx_slideshow_images_active ON slideshow_images(active);
