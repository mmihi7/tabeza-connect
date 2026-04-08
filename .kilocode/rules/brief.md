# Tabeza Connect – Professional Brief

**Tabeza Connect** is a Windows agent that bridges POS systems to the Tabeza digital receipt platform. Using REDMON port monitoring, it intercepts print jobs without interfering with existing printing, processes raw ESC/POS data via capture.exe, and forwards receipts to physical printers via the Windows Print API. Parsed receipt data is uploaded as structured JSON to the cloud. Designed as a set‑and‑forget service, it runs as a Windows Service with automatic startup, offline‑first queuing, and zero ongoing operator attention.

**Goals**: Capture every receipt, parse locally (1‑5ms), ensure reliable cloud upload, provide guided one‑time setup, and operate 24/7 without user intervention.

**Significance**: Enables digital receipts for customer engagement, operational insights, and sustainability while delivering accurate, real‑time sales data.

**Key Features**:
- REDMON port monitoring for non‑invasive print capture
- Windows Print API for reliable physical printing
- Local regex parsing (AI‑assisted template generation)
- Offline‑resilient queue with automatic retry
- Management UI & system tray for monitoring
- Automated installer with folder creation and service registration
- Heartbeat monitoring for real‑time device status

**Technology**: Node.js, Express, chokidar, better‑sqlite3, Electron/PKG packaging, REST API to Supabase, REDMON, Windows Print API.