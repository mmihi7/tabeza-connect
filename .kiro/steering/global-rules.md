---
trigger: always_on
---
NON-DESTRUCTIVE CODE RULE (MANDATORY)

You are NOT allowed to delete, remove, or replace any existing function, method, class, or exported interface unless you have explicit, written authorization from the user.

If you believe a function is unused, redundant, or incorrect:
- DO NOT delete it
- DO NOT silently modify its signature or behavior

Instead, you MUST:
1. Leave the original function intact
2. Add a comment explaining the issue
3. Suggest a change separately
4. Ask for explicit approval before making destructive changes

Any destructive action without approval is considered a failure.
---

