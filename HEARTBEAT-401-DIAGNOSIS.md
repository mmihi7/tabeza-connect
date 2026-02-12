# Heartbeat 401 Error - Proper Diagnosis

## Diagnostic Results

Ran: `node dev-tools/scripts/diagnose-heartbeat-401.js`

### Finding: Vercel Deployment Protection IS Active

**Evidence:**
```
Response Status: 401 Unauthorized
Response Body: <title>Authentication Required</title>
Set-Cookie: _vercel_sso_nonce=...
```

This confirms Vercel SSO authentication is blocking the request.

## Critical Context

### Current Configuration
- Printer service is configured to use: `https://tabz-kikao.vercel.app`
- This is a `.vercel.app` domain (Vercel's default domain)
- Vercel Deployment Protection CAN apply to `.vercel.app` domains

### The Question
**Is there a custom production domain?**

If `staff.tabeza.co.ke` or another custom domain exists and is properly configured:
- That domain would NOT have Vercel Deployment Protection
- The printer service should use that domain instead
- This would solve the problem without disabling any security

## Next Steps

### Option 1: Use Production Domain (Recommended)

If a custom production domain exists:

1. **Verify the domain:**
   ```bash
   curl -I https://staff.tabeza.co.ke/api/printer/heartbeat
   ```

2. **Update printer service configuration:**
   ```bash
   set TABEZA_API_URL=https://staff.tabeza.co.ke
   ```

3. **Restart printer service**

### Option 2: Disable Vercel Auth on .vercel.app Domain

If `tabz-kikao.vercel.app` IS the production deployment:

1. Go to: https://vercel.com/mwenes-projects/tabz-kikao/settings/deployment-protection
2. Disable "Vercel Authentication"
3. OR add `/api/printer/*` to bypass list

### Option 3: Check API Route Code

Verify the endpoint doesn't have its own auth logic:

```typescript
// Check: apps/staff/app/api/printer/heartbeat/route.ts
// Look for any auth checks like:
const session = await getSession();
if (!session) return new Response('Unauthorized', { status: 401 });
```

## Verification Needed

Please confirm:
1. **What is the actual production domain?** (`staff.tabeza.co.ke` or `tabz-kikao.vercel.app`?)
2. **Is Vercel Deployment Protection intentionally enabled?**
3. **Should the printer service use a different domain?**

## Current Status

- ✅ Diagnostic script works correctly
- ✅ Identified Vercel SSO as the blocker
- ❓ Need to confirm correct production domain
- ❓ Need to decide on proper solution

The diagnostic was correct - Vercel Deployment Protection IS blocking the requests. The question is whether we should:
- Use a different domain that doesn't have this protection
- OR disable the protection on this domain
