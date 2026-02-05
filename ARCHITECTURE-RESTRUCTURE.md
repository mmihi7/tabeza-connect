# TABEZA Architecture Restructure

## Problem Identified

The current monorepo contains **on-premises infrastructure** mixed with **cloud-first components**. This violates the architectural boundary between Vercel-hosted services and Windows-based printer agents.

## Current State (WRONG)

```
packages/
├── printer-agent/          # ❌ Windows Service - needs OS hooks
├── virtual-printer/        # ❌ Print capture - needs spooler access  
├── receipt-schema/         # ✅ Shared schema - belongs here
└── shared/                 # ✅ Business logic - belongs here
```

## Target State (CORRECT)

### ✅ Vercel Monorepo (This Repo)
```
tabeza/
├── apps/
│   ├── customer/           # Customer PWA
│   ├── staff/              # Staff dashboard  
│   └── api/                # Serverless endpoints
├── packages/
│   ├── receipt-schema/     # 🔑 SINGLE SOURCE OF TRUTH
│   ├── shared/             # Business logic (pure)
│   ├── escpos-parser/      # Pure parsing logic (no OS)
│   ├── tax-rules/          # KRA logic (pure)
│   └── validation/         # Schema validators
```

### ✅ TABEZA Printer Agent (New Repo: `tabeza-agent`)
```
tabeza-agent/
├── service/
│   ├── windows-service/
│   ├── printer-capture/
│   └── spooler-monitor/
├── storage/
│   ├── sqlite/
│   └── sync-queue/
├── packages/
│   └── receipt-schema/     # 🔗 npm link to cloud repo
```

## Architectural Rules

### What STAYS in Vercel Monorepo
- ✅ Pure business logic
- ✅ Schema definitions  
- ✅ Validation rules
- ✅ Tax calculations
- ✅ Web dashboards
- ✅ API endpoints

### What MOVES to Agent Repo
- ❌ Windows Service
- ❌ Print spooler monitoring
- ❌ SQLite storage
- ❌ File system watching
- ❌ Offline queues
- ❌ OS-level integrations

## Implementation Plan

### Phase 1: Clean Current Repo ✅
1. Remove `packages/printer-agent/`
2. Remove `packages/virtual-printer/`
3. Extract pure parsing logic to `packages/escpos-parser/`
4. Keep `packages/receipt-schema/` as single source of truth

### Phase 2: Create Agent Repo
1. Create new repository: `tabeza-agent`
2. Move infrastructure code
3. Link to shared schema via npm
4. Implement proper Windows Service

### Phase 3: Integration
1. Agent pulls schema from npm registry
2. Cloud APIs accept agent data
3. Proper versioning strategy

## Trust Boundary

```
┌─────────────────┐    ┌─────────────────┐
│   Vercel Cloud  │    │  Windows Agent  │
│                 │    │                 │
│ • Configuration │◄──►│ • Reality       │
│ • Intent        │    │ • Execution     │
│ • Verification  │    │ • Truth Source  │
└─────────────────┘    └─────────────────┘
```

**Rule**: Vercel hosts intent and configuration. The agent executes reality.

## Next Steps

1. ✅ Remove infrastructure packages from this repo
2. ⏳ Create `tabeza-agent` repository  
3. ⏳ Extract pure parsing logic
4. ⏳ Implement proper linking strategy