# How to Get the Correct Anon Key for Edge Functions

## The Problem
You're getting `401 Invalid JWT` errors because Edge Functions require **legacy JWT-based anon keys**, not the new publishable keys.

## Solution: Get the Legacy Anon Key

### Step 1: Go to Supabase Dashboard
1. Open your Supabase project: https://supabase.com/dashboard/project/bkaigyrrzsqbfscyznzw
2. Click **Settings** (gear icon in left sidebar)
3. Click **API** in the settings menu

### Step 2: Find the Legacy Keys Section
Scroll down to the section titled:
**"Legacy anon, service_role API keys"**

You'll see two keys:
- **anon** (marked as "public") ← THIS IS THE ONE YOU NEED
- **service_role** (marked as "secret") ← DON'T USE THIS

### Step 3: Copy the Anon Key
1. Click the **"Copy"** button next to the **anon** key
2. The key will be a LONG JWT token that starts with `eyJ...`
3. It will look something like: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrYWlneXJyenNxYmZzY3l6bnp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODc...` (much longer)

### Step 4: Update the Trigger
1. Open `Tabz/database/fix-trigger-use-anon-key.sql`
2. Find this line:
   ```sql
   anon_key TEXT := 'YOUR-LEGACY-ANON-KEY-HERE';
   ```
3. Replace `YOUR-LEGACY-ANON-KEY-HERE` with the JWT token you copied
4. Run the entire SQL file in Supabase SQL Editor

### Step 5: Test Again
Run the test from `test-receipt-trigger-simple.sql` - the 401 error should be gone!

## What You're Looking For

The correct key:
- ✅ Starts with `eyJ`
- ✅ Is very long (hundreds of characters)
- ✅ Is from the "Legacy anon, service_role API keys" section
- ✅ Is labeled as "anon" and "public"

The WRONG keys (don't use these):
- ❌ `sb_publishable_...` (new publishable keys - don't work with Edge Functions)
- ❌ `sb_secret_...` (secret keys - too privileged, not for triggers)
- ❌ service_role key (bypasses RLS, not safe for triggers)

## Why This Matters

Edge Functions use JWT verification which only works with the legacy anon key. The new publishable keys use a different authentication mechanism that Edge Functions don't support yet (unless you use `--no-verify-jwt` mode).

## Still Having Issues?

If you're still getting 401 errors after using the legacy anon key:
1. Double-check you copied the ENTIRE key (it's very long)
2. Make sure there are no extra spaces or line breaks
3. Verify you're using the key from the "Legacy" section, not the "New" section
4. Try regenerating the legacy anon key in Supabase Dashboard

## Alternative: Use Supabase Client Library

If you can't get the trigger working, we can modify the ingestion API to trigger parsing directly instead of using a database trigger. Let me know if you want to go this route.
