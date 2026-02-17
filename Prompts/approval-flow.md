# Approval Flow Implementation Plan

## Context

CondoBot currently posts AI-generated draft replies as plain text in Slack threads (visible in the screenshot). Approvers (Josh, Amanda, Cindy) can see the drafts but have no way to send them to guests. This plan adds interactive Send/Edit buttons, handles button clicks and modal submissions, and sends approved replies to guests via the Hospitable Messaging API — completing the Phase 1 MVP.

## Overview

4 files modified, 2 new files created:

| File | Action | Purpose |
|------|--------|---------|
| `src/draft-store.ts` | **New** | In-memory Map to hold pending drafts |
| `src/hospitable.ts` | **New** | Send messages to guests via Hospitable API |
| `src/slack.ts` | Modify | Block Kit message with buttons, edit modal, message updates |
| `src/slack-interactions.ts` | **New** | Handle Slack button clicks and modal submissions |
| `src/webhook-handler.ts` | Modify | Extract `conversation_id`, wire up draft storage |
| `src/index.ts` | Modify | Add `POST /slack/interactions` route |

## Step 0: Discover Hospitable Send Message API

The exact endpoint is unknown (docs are JS-rendered). Before coding, make an exploratory curl call:

```bash
# Try the most likely endpoint pattern
curl -s https://api.hospitable.com/conversations/cbb6b3be-d786-4833-9a37-71949393939e \
  -H "Authorization: Bearer $HOSPITABLE_API_TOKEN" \
  -H "Accept: application/json" | jq .
```

This will confirm the base URL works and reveal the conversation structure. Then try:

```bash
curl -s -X POST https://api.hospitable.com/conversations/cbb6b3be-d786-4833-9a37-71949393939e/messages \
  -H "Authorization: Bearer $HOSPITABLE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"body": "Test reply from API"}' | jq .
```

If this doesn't work, try `/v2/conversations/...` or check error messages for hints.

## Step 1: Create `src/draft-store.ts`

Simple in-memory Map keyed by UUID. Stores everything needed to send a reply and update the Slack message after approval:

```typescript
interface PendingDraft {
  id: string;
  conversationId: string;   // from Hospitable webhook
  guestName: string;
  draftText: string;
  slackThreadTs: string;     // parent notification message
  slackMessageTs: string;    // the Block Kit draft message (for chat.update)
  createdAt: number;
}
```

- `storeDraft()`, `getDraft()`, `deleteDraft()`
- Drafts are lost on restart (acceptable for Phase 1 — SQLite comes later)

## Step 2: Create `src/hospitable.ts`

Single function: `sendMessageToGuest(conversationId, messageBody)`:
- `POST https://api.hospitable.com/conversations/{id}/messages` (pending Step 0 confirmation)
- Auth: `Bearer ${HOSPITABLE_API_TOKEN}`
- Body: `{ "body": messageBody }`
- Throws on failure (caller handles it)

## Step 3: Modify `src/slack.ts`

**Replace** `postDraftReply()` with `postDraftWithButtons()`:
- Posts a Block Kit message with a section showing the draft text and an actions block with green "Send" button (`action_id: "approve_draft"`) and "Edit" button (`action_id: "edit_draft"`)
- Button `value` = the draft UUID (36 chars, well under 2000 limit)
- Returns `{ ts }` for storing as `slackMessageTs`

**Add** `updateDraftMessage()`:
- Calls `chat.update` to replace buttons with a context block: "Sent by {name}" or "Edited and sent by {name}" with timestamp
- Keeps the draft text visible for audit

**Add** `openEditModal()`:
- Calls `views.open` with `trigger_id` from the interaction payload
- Modal has a multiline `plain_text_input` pre-filled with the draft text
- `private_metadata` = JSON with the draft ID (passed through to submission handler)
- `callback_id: "edit_draft_modal"` for routing submissions

## Step 4: Create `src/slack-interactions.ts`

Exports `handleSlackInteraction(c: Context)`:

1. Parse `application/x-www-form-urlencoded` body → extract `payload` → JSON parse
2. Route on `payload.type`:

**`block_actions`** (button clicked):
- Extract `draftId` from `action.value`, look up in store
- If draft not found → return 200 (already handled, race condition safe)
- `approve_draft` → send via Hospitable → update Slack message → delete draft
- `edit_draft` → open modal with `trigger_id`

**`view_submission`** (modal submitted):
- Extract `draftId` from `view.private_metadata`
- Extract edited text from `view.state.values.draft_input.draft_text.value`
- Send edited text via Hospitable → update Slack message → delete draft
- Return `{ "response_action": "clear" }` to close modal

**Error handling:**
- If Hospitable send fails, log error and don't delete draft (user can retry)
- Slack requires 200 response within 3 seconds — if Hospitable is slow, acknowledge immediately and process async

## Step 5: Modify `src/webhook-handler.ts`

- Extract `payload.data.conversation_id` from the webhook
- After draft generation: generate UUID, call `postDraftWithButtons()`, call `storeDraft()`
- If `conversation_id` is missing: fall back to plain text draft (no buttons — can't send without it) with a note

## Step 6: Modify `src/index.ts`

Add one route:
```typescript
app.post("/slack/interactions", handleSlackInteraction);
```

## Step 7: Update Slack App Config (Manual)

At api.slack.com → CondoBot app → Interactivity & Shortcuts:
- Change Request URL from `https://racecondition.software/slack/interactions` to `https://condobot-production.up.railway.app/slack/interactions`

## Verification

1. **Deploy** to Railway
2. **Update** Slack app interactivity URL
3. **Send test webhook** with `conversation_id` (modify `scripts/test-webhook.sh` to include it)
4. **Verify** Block Kit message appears in Slack with Send/Edit buttons
5. **Click Send** → verify message sent via Hospitable, Slack message shows "Sent by {name}"
6. **Click Edit** → verify modal opens with draft pre-filled → submit → verify send + Slack update
7. **Test edge cases**: click button after server restart (graceful "draft not found"), missing conversation_id (plain text fallback)
