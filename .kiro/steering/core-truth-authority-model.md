# Core Truth & Order Authority Model (FINAL)

## Purpose
To define the fundamental operating law of Tabeza and prevent architectural, UX, and operational errors.
This document overrides assumptions in code, UI, onboarding, and sales.

## Core Truth (Authoritative)
Every venue operates with exactly one digital order authority, while always retaining manual traditional ordering.

The three authorities are:
1. **POS System**
2. **Tabeza Built-in Ordering System** 
3. **Manual / Traditional Ordering (Non-Tabeza)**

## Constraint Rule (Non-Negotiable)
- Exactly ONE of (1) POS or (2) Tabeza may be active as the digital order authority
- Manual / traditional ordering (3) always coexists

**Formally: (POS OR Tabeza) AND Manual**

Manual ordering never disappears. Digital authority must never be duplicated.

## What Each Authority Means (Clarified)

### 1️⃣ POS Authority
- Creates financial orders
- Defines prices, taxes, totals
- Produces printed receipts
- Is mirrored by Tabeza

### 2️⃣ Tabeza Authority
- Creates financial orders
- Generates digital receipts
- Accepts payments
- Is the system of record

### 3️⃣ Manual / Traditional Ordering (Always Present)
- Verbal waiter interactions
- Handwritten notes
- Physical service workflows
- Manual actions must always resolve into the active digital authority (POS or Tabeza)

## Why This Exists (First Principles)
- Physical service cannot be digitized away
- Financial truth must be singular
- Staff must not choose between systems
- Customers must not reconcile duplicates

**This rule is structural, not configurable.**

## FINAL SYSTEM LAW (Put This in Code Comments)
Manual service always exists. Digital authority is singular. Tabeza adapts to the venue — never the reverse.