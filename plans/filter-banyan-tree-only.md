# Plan: Filter CondoBot to Only Process Banyan Tree Inquiries

## Context

A guest sent a message about the Sands of Kahana unit ("SOK"), but CondoBot processed it as if it were a Banyan Tree inquiry. Because the `properties` map in `properties.ts` is empty, all messages default to Banyan Tree 300 — so CondoBot posted a confusing draft referencing "the Banyan Tree property here in Kailua-Kona" for a Maui inquiry. The fix: only process messages for Banyan Tree and silently skip everything else until support for the other properties is added.

---

## Changes

### 1. `src/properties.ts` — add `supported` flag and populate the map

- Add `supported: boolean` to the `Property` interface
- Create a shared `BANYAN_TREE` object with `supported: true`
- Add two keys to the `properties` Record to cover both listing names:
  - `"Gorgeous Unit, Stunning Views!"` — exact match for the Airbnb listing name
  - `"banyan tree"` — substring-matches the VRBO listing name (`Banyan Tree 300: Gorgeous, New Unit 20 ft from Beach w/ Stunning Ocean Views/AC!`)
- The existing `resolveProperty()` substring matching handles both: Airbnb hits the exact match, VRBO hits via the `"banyan tree"` substring key
- Change `DEFAULT_PROPERTY` to `supported: false` so unknown/unmapped listings are skipped

### 2. `src/webhook-handler.ts` — bail early for unsupported properties

Move `resolveProperty()` call to **before** the Slack notification (currently it's called after). If `!property.supported`, log and return — no Slack notification, no draft generation.

### 3. `CLAUDE.md` — check off the TODO item

Mark done: `[ ] For now, have CondoBot ignore all inquiries that are not for the Banyan Tree unit`

---

## Files Modified

| File | Change |
|------|--------|
| `src/properties.ts` | Add `supported` flag, populate Banyan Tree entries, unsupported default |
| `src/webhook-handler.ts` | Early return before Slack notification for unsupported properties |
| `CLAUDE.md` | Check off TODO |

---

## Verification

1. `grep -i "supported" src/properties.ts` — confirm the flag exists
2. Send test webhook with SOK listing name → should log "Skipping" and NOT post to Slack
3. Send test webhook with Banyan Tree listing name → should post notification + draft as before
4. Send test webhook with unknown listing name → should log "Skipping" and NOT post to Slack
