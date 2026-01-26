# Test Fixes Explanation

## Issues Found and Fixed

### 1. **Window Type Errors (Recurring Issue)**

**Error**: `error TS2304: Cannot find name 'window'`

**Root Cause**:
- TypeScript doesn't recognize `window` in Node.js context
- Even with `typeof window === 'undefined'` checks, TypeScript still tries to type-check `window.location`
- This happens because TypeScript's type checker runs before runtime checks

**Why It Keeps Happening**:
- The file `lib/utils/url.ts` is used in both browser and Node.js contexts
- TypeScript needs explicit type guards for browser-only globals
- Previous fixes used `typeof window` but TypeScript still sees `window` in the code

**Solution**:
```typescript
// Instead of:
if (typeof window !== 'undefined' && window.location) {
  return window.location.origin;
}

// Use:
try {
  if (typeof globalThis !== 'undefined' && 'window' in globalThis) {
    const win = globalThis as any;
    if (win.window?.location?.origin) {
      return win.window.location.origin;
    }
  }
} catch {
  // Ignore errors in Node.js environment
}
```

**Why This Works**:
- `globalThis` is available in both Node.js and browser
- Using `as any` bypasses TypeScript's strict checking for this specific case
- Try-catch ensures no runtime errors in Node.js
- Only accesses `window` if it actually exists

---

### 2. **Slot Reservation Failure (Recurring Issue)**

**Error**: `Slot reservation failed. Slot status: available, reserved_until: null`

**Root Cause**:
- The `reserveSlot` method used a complex Supabase `.or()` condition:
  ```typescript
  .or(`status.eq.${SLOT_STATUS.AVAILABLE},and(status.eq.${SLOT_STATUS.RESERVED},reserved_until.lt.${now})`)
  ```
- This complex condition was failing silently
- Supabase's `.or()` syntax can be tricky with nested conditions
- The update was returning 0 rows even though the slot was available

**Why It Keeps Happening**:
- The complex `.or()` condition syntax might not be parsed correctly by Supabase
- Race conditions: slot status might change between the `getSlotById` check and the update
- The condition was too complex for Supabase to evaluate correctly

**Solution**:
```typescript
// Build update query conditionally based on current status
let updateQuery = supabaseAdmin
  .from('slots')
  .update({
    status: SLOT_STATUS.RESERVED,
    reserved_until: reservedUntil.toISOString(),
  })
  .eq('id', slotId);

// Add condition based on current status
if (slot.status === SLOT_STATUS.AVAILABLE) {
  // Only update if still available (atomic check)
  updateQuery = updateQuery.eq('status', SLOT_STATUS.AVAILABLE);
} else if (slot.status === SLOT_STATUS.RESERVED && slot.reserved_until) {
  // Only update if reservation has expired
  const now = new Date().toISOString();
  updateQuery = updateQuery
    .eq('status', SLOT_STATUS.RESERVED)
    .lt('reserved_until', now);
} else {
  // Invalid state, cannot reserve
  return false;
}
```

**Why This Works**:
- Simpler, more explicit conditions that Supabase can handle
- Checks status before building the query
- Handles expired reservations explicitly
- Atomic update ensures no race conditions
- Returns `false` if no rows updated (PGRST116 error code)

---

## Prevention Strategies

### For Window Errors:
1. **Always use `globalThis` with type assertions** for browser-only globals
2. **Wrap in try-catch** for safety
3. **Check environment first** before accessing browser globals
4. **Use type guards** that TypeScript understands

### For Slot Reservation:
1. **Avoid complex `.or()` conditions** - break them into separate queries
2. **Check status before building query** - don't rely on complex conditions
3. **Handle expired reservations explicitly** - don't try to combine conditions
4. **Use atomic updates** - check status in the update condition itself
5. **Return false on PGRST116** - means no rows matched (race condition)

---

## Testing Recommendations

1. **Test in both environments**: Node.js (tests) and browser (runtime)
2. **Test race conditions**: Multiple concurrent slot reservations
3. **Test expired reservations**: Slots with past `reserved_until` dates
4. **Test edge cases**: Slots transitioning between states

---

## Files Modified

- `lib/utils/url.ts` - Fixed window type errors
- `services/slot.service.ts` - Fixed reserveSlot method
- `docs/TEST_FIXES_EXPLANATION.md` - This documentation
