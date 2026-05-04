# Header Spec v1 (Non-Admin) — QA Checklist

Use this as a tick-box checklist when validating header behavior. Scope: **all routes outside `/admin`**.

## Global invariants (every non-admin route)
- [ ] Brand click navigates to `/logs`
- [ ] Header copy uses “Logs” terminology (All Logs / New Log / Back to Logs)
- [ ] Admin button is permission-gated (never shown without access)
- [ ] User menu is hydration-safe (no flicker/mismatch)

## State checks

### Unauthenticated
- [ ] Brand visible; All Logs and New Log not shown

### Authenticated + memberships present
- [ ] All Logs visible and enabled
- [ ] New Log visible (enabled or disabled + reason)
- [ ] Admin button shown only if permitted

### Authenticated + no memberships (“Not assigned”)
- [ ] All Logs visible but disabled + reason
- [ ] New Log visible but disabled + reason
- [ ] Admin shown only if permitted
- [ ] User menu still available

### Authenticated + cannot create now
- [ ] New Log visible but disabled + reason (never hidden)

## Route-specific
- [ ] `/reports/[id]` shows “Back to Logs”

