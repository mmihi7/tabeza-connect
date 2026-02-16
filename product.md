# Product Overview

**Tabeza** is an anonymous tab management system designed for bars and restaurants. It enables customers to open tabs, place orders, and make payments through a mobile-first Progressive Web App (PWA) without requiring user registration or personal information.

## Core Features

- **Anonymous Tab Management**: Customers can open tabs using QR codes without creating accounts
- **Dual-Mode Operation**: Supports both Basic mode (POS integration) and Venue mode (full service)
- **Progressive Onboarding**: Clear setup flow starting with mode selection (Basic vs Venue)
- **Authority-Based Configuration**: Enforces single digital authority (POS or Tabeza) with manual service always present
- **Real-time Ordering**: Interactive menu system with real-time order placement and staff notifications
- **Multiple Payment Methods**: Support for M-Pesa mobile payments, cash, and card payments
- **Staff Management Interface**: Comprehensive admin panel for bar staff to manage orders, tabs, and payments
- **Multi-tenant Architecture**: Single platform supporting multiple bars with isolated data
- **PWA Support**: Mobile-optimized Progressive Web App for both customer and staff interfaces

## Operating Modes

### 🔵 Tabeza Basic (Transaction & Receipt Bridge)
- **Target**: Venues with existing POS systems
- **Authority**: POS-only (Tabeza mirrors receipts)
- **Features**: Digital receipts, customer payments, simple dashboard
- **Requirements**: Thermal printer integration mandatory + Tabeza printer drivers (from tabeza.co.ke)
- **Onboarding**: Streamlined 3-step setup (info → M-Pesa → printer)

### 🟢 Tabeza Venue (Customer Interaction & Service Layer)
- **Target**: Venues wanting full customer interaction
- **Authority**: Either POS integration or Tabeza-native
- **Features**: Menus, customer ordering, two-way messaging, payments
- **Requirements**: Printer optional (if POS authority: requires Tabeza printer drivers from tabeza.co.ke)
- **Onboarding**: Guided setup with POS decision point

## Target Users

- **Customers**: Bar/restaurant patrons who want to order and pay without waiting for staff
- **Bar Staff**: Employees who need to manage orders, tabs, and payments efficiently
- **Bar Owners**: Business owners who need oversight and reporting capabilities

## Key Business Logic

- **Core Truth Model**: Manual service always exists, digital authority is singular
- **Configuration Enforcement**: System prevents invalid venue/authority combinations
- **Progressive Setup**: Users reach dashboard immediately, complete optional settings later
- **Device-Based Enforcement**: Prevents multiple open tabs per device
- **Automatic Status Management**: Tabs transition to "overdue" after business hours
- **Real-time Notifications**: Instant alerts for new orders and payment confirmations
- **Comprehensive Audit Logging**: All financial transactions and configuration changes tracked