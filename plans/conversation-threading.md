# Add Conversation Threading to Draft Generation

## Context

Currently, each `generateDraft()` call sees only the single incoming guest message. If a guest sends multiple messages in a thread (e.g., asks about parking, then follows up with "and what about the Wi-Fi?"), the model has no context about prior exchanges and may repeat information or miss references.

Per the EDD (docs/EDD.md lines 362-402), the recommended approach is **Option A: Fetch the thread from the Hospitable API at draft time** — stateless, always reflects the source of truth, minimal added latency.

## API Schema (confirmed via Hospitable docs)

`GET /v2/reservations/{uuid}/messages` returns `{ data: Message[] }` — no pagination metadata.

`GET /v2/inquiries/{uuid}/messages` does **not exist** — threading is reservation-only.

**Message fields we use:** `body`, `sender_type` ("host" | "guest"), `created_at`, `source`

**Notes from docs research:**
- `sender_role` is deprecated — use `sender_type` only
- `source: "AI"` = Hospitable's auto-reply feature — these are host-side messages and should be included in the thread as `assistant` turns
- Pagination is ambiguous — no `meta` block in the documented response. If a large thread gets truncated, we may need to add `?page=` support later. For now, assume all messages are returned in one response (typical vacation rental threads are 5-20 messages)

## Step 1: Add `getReservationMessages()` to `src/hospitable.ts`

Define types and a new function:

```typescript
export interface HospitableMessage {
  body: string;
  sender_type: "host" | "guest";
  created_at: string;           // ISO 8601
  source: string;               // "platform" | "public_api" | "automated" | "hospitable" | "AI" | "integration"
}

interface HospitableMessagesResponse {
  data: HospitableMessage[];
}

export async function getReservationMessages(
  reservationId: string,
): Promise<HospitableMessage[] | null> { ... }
```

- `GET /v2/reservations/{reservationId}/messages` with Bearer auth
- Returns `null` on any failure (not throw) — enables graceful fallback
- Logs warning on failure but never throws

## Step 2: Add thread-mapping helpers to `src/draft-generator.ts`

Three pure helper functions + one orchestrator:

1. **`deduplicateCurrentMessage(messages, currentMessage)`** — The webhook message is likely already in the GET response by the time we fetch. Remove it from the end of the thread if it matches (normalized trim + lowercase comparison).

2. **`mergeConsecutiveRoles(messages)`** — Anthropic API requires strict user/assistant alternation. Maps `sender_type: "guest"` → `role: "user"`, `sender_type: "host"` → `role: "assistant"`. If guest sends 2 messages in a row, merge into one `user` turn (joined with `\n\n`). If thread starts with a host message, prepend a synthetic user message.

3. **`ensureAlternation(messageParams)`** — Final safety pass after combining thread + new message. Merges any remaining consecutive same-role entries. Handles the edge case where the thread ended with a different guest message than the one being deduplicated.

4. **`buildThreadMessages(reservationId, currentGuestMessage)`** — Orchestrator. Calls `getReservationMessages()`, keeps messages where `sender_type` is `"guest"` or `"host"` (this includes `source: "AI"` auto-replies since they have `sender_type: "host"`), deduplicates, truncates to most recent 20 messages, merges roles. Returns `[]` on any failure (no reservationId, API error, first message).

## Step 3: Update `DraftRequest` interface in `src/draft-generator.ts`

```typescript
interface DraftRequest {
  guestMessage: string;
  guestName: string;
  propertySlug: string;
  isBooked: boolean;
  reservationId?: string;   // NEW — enables thread fetching
}
```

`conversationId` is not needed here since there's no GET endpoint for inquiries.

## Step 4: Update `buildSystemPrompt()` in `src/draft-generator.ts`

Add `hasThread: boolean` parameter (4th arg). When true, append after `## Instructions`:

```
## Conversation Context
The messages array includes prior messages from this conversation thread. Earlier messages
are provided for context so you understand what has already been discussed. Draft your reply
to the MOST RECENT guest message only — do not re-answer questions that were already addressed
in previous replies. If the guest is following up or referring to something discussed earlier,
use that context to give a coherent, informed response.
```

When false, prompt is identical to today's.

## Step 5: Update `generateDraft()` in `src/draft-generator.ts`

```typescript
// Fetch conversation thread (returns [] on failure or if unavailable)
const threadMessages = await buildThreadMessages(req.reservationId, req.guestMessage);
const hasThread = threadMessages.length > 0;

const systemPrompt = buildSystemPrompt(voiceExamples, req.propertySlug, req.isBooked, hasThread);
const userMessage = `Guest "${req.guestName}" sent this message:\n\n${req.guestMessage}`;

let messages: Anthropic.MessageParam[] = ensureAlternation([
  ...threadMessages,
  { role: "user", content: userMessage },
]);

// ... rest of tool-use loop unchanged
```

## Step 6: Update `src/webhook-handler.ts` — one-line change

Pass `reservationId` to `generateDraft()` (variable already exists at line 22):

```typescript
generateDraft({
  guestMessage: body,
  guestName: senderName,
  propertySlug: property.slug,
  isBooked,
  reservationId,    // NEW
})
```

## Files Modified

| File | Change |
|------|--------|
| `src/hospitable.ts` | Add `HospitableMessage` type + `getReservationMessages()` |
| `src/draft-generator.ts` | Add 4 thread-mapping functions, update `DraftRequest`, update `buildSystemPrompt()`, update `generateDraft()` |
| `src/webhook-handler.ts` | Add `reservationId` to `generateDraft()` call |

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| First message (empty thread) | Dedup removes the only message → `[]` → single-message mode |
| API failure | `getReservationMessages()` returns `null` → `[]` → single-message mode |
| Inquiry-only (no `reservationId`) | No GET endpoint exists → `[]` → single-message mode |
| Messages sent outside CondoBot | Captured by GET since Hospitable is source of truth |
| Long threads (>20 messages) | Truncated to most recent 20 (~2K tokens) |
| Consecutive guest messages | Merged into single `user` turn |
| Thread starts with host message | Synthetic `user` message prepended |
| Automated/system messages in thread | Filtered out (only keep `sender_type` guest/host) |
| Hospitable AI auto-replies (`source: "AI"`) | Included as `assistant` turns (they have `sender_type: "host"`) |
| Pagination missing for large threads | Assume single-page response for now; add `?page=` support if needed later |

## Verification

1. **Local dev test** — `bun run dev`, fire test webhook with a real `reservation_id` that has prior messages, verify logs show thread fetched and mapped
2. **End-to-end** — send a guest message on a test listing, approve the draft, send a follow-up. Verify the second draft acknowledges the prior exchange without repeating information
