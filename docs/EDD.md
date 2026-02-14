# CondoBot — Engineering Design Document

## Why CondoBot Needs a Standalone Runtime

Claude Code is the development tool — it's how we build, test, and iterate on CondoBot. But Claude Code is not suitable as the production runtime for several reasons:

- **Always-on webhook listener.** CondoBot needs a persistent HTTP server to receive Hospitable webhooks 24/7. Claude Code is an interactive CLI session, not a daemon.
- **Cost control.** CondoBot's per-response work (retrieve knowledge, compose a reply) is well within Haiku 4.5's capabilities at ~$0.005/response. Running these tasks through Claude Code would use Opus or Sonnet at 50–100x the cost.
- **Programmatic control.** A standalone service gives full control over system prompts, tool definitions, prompt caching, retry logic, and conversation threading — none of which are configurable when working through Claude Code's interactive interface.
- **Approval UI.** The service needs to send interactive messages (with Send/Edit buttons) to an approval channel and handle callback responses. This requires a running server with state.
- **Reliability and uptime.** A deployed service can be monitored, auto-restarted, and load-balanced. A Claude Code session cannot.

## Why Bun

**Bun** is the chosen runtime for CondoBot. Key advantages over Node.js:

- **Anthropic acquired Bun in December 2025.** Claude Code itself runs on Bun. The ecosystem alignment means strong long-term support and first-class integration with Anthropic tooling.
- **Runs TypeScript natively.** No compilation step, no `tsconfig.json`, no build pipeline. Write `.ts` files and run them directly.
- **Significantly faster.** Written in Zig using JavaScriptCore (not V8). Faster startup, faster execution, lower memory usage.
- **All-in-one toolkit.** Runtime, package manager (`bun install`), test runner (`bun test`), and bundler — replaces Node.js + npm + Jest + webpack/esbuild.
- **Drop-in Node.js compatibility.** Uses the same `node_modules`, supports most Node.js APIs, runs existing npm packages unchanged.
- **Built-in SQLite driver.** `bun:sqlite` provides a native SQLite interface with no external dependency — ideal for CondoBot's conversation database.

## Tech Stack

| Component | Technology | Notes |
|-----------|-----------|-------|
| Runtime | Bun (TypeScript) | Runs `.ts` files natively |
| Guest messaging | Hospitable | Webhooks for message events, API for reading/sending messages |
| Draft generation | Anthropic API (Haiku 4.5) | ~$0.005/response |
| Prompt optimization | Prompt caching | System prompt + knowledge base cached; 90% input cost reduction |
| Cleaner coordination | Twilio (Phase 3) | SMS to Bonnie & Darren |
| HTTP framework | Hono | Lightweight, Bun-native, Express-like API |
| Approval channel | Slack (Block Kit) | Interactive buttons for Send/Edit; modals for editing drafts |
| Data storage | SQLite via `bun:sqlite` | Conversation history, guest records |

## Architecture: Tool Use from Day One

Even though Phase 1 is a knowledge-base responder, the system uses Claude's tool-use architecture from the start. The upgrade path from "answer FAQs" to "check calendars and coordinate cleanings" is just adding new tools, not rewriting the core.

### Phase 1 tools (read from local files)

- `lookup_property_info` — property-specific details
- `lookup_policy` — house rules, checkout times, cancellation terms
- `lookup_restaurants` — restaurant recommendations by category
- `lookup_activities` — activity and attraction recommendations
- `lookup_technology` — TV, Wi-Fi, Alexa, and appliance instructions

### Phase 2 tools (hit live APIs)

- `check_calendar_availability` — query Hospitable API for reservation conflicts
- `get_reservation_details` — pull check-in/check-out dates, guest info

### Phase 3 tools (external coordination)

- `text_bonnie` — send SMS to cleaner via Twilio
- `check_cleaner_schedule` — query cleaner availability
- `send_extension_quote` — calculate and propose pricing for stay extensions

## Data Storage

### Application Data (CondoBot Runtime)

CondoBot uses **SQLite** (`data/conversations.db`) for all transactional data: conversation history, guest records, draft status, and approval outcomes. SQLite is queryable by guest, date, property, and status — and `bun:sqlite` provides a native driver with no external dependencies.

### Claude Code Development Sessions

When working on CondoBot in Claude Code, the three memory types still apply as a design principle:

| Memory Type | What It Stores | Example | Storage Mechanism |
|-------------|---------------|---------|-------------------|
| Episodic | Lessons learned, operational insights | "Guests frequently ask about parking" | `MEMORY.md` |
| Semantic | Stable facts about the property, people, and area | "The unit has 1-gigabit WiFi"; "Bonnie prefers texts for non-urgent issues" | Knowledge base (this file, property docs) |
| Transactional | Stateful guest-interaction records | "The Smiths asked about March 12–19; awaiting approval on response" | SQLite database |

Most AI-application memory mistakes come from cramming all three types into a single mechanism. Each type has different access patterns, lifespans, and query needs.

### SQLite Schema

Three tables for Phase 1:

```sql
CREATE TABLE reservations (
  id TEXT PRIMARY KEY,                -- Hospitable reservation ID
  property_id TEXT NOT NULL,
  guest_name TEXT,
  platform TEXT CHECK(platform IN ('airbnb', 'vrbo')),
  check_in TEXT,
  check_out TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT
);

CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reservation_id TEXT NOT NULL REFERENCES reservations(id),
  hospitable_message_id TEXT UNIQUE,  -- NULL for CondoBot-sent messages
  sender TEXT NOT NULL CHECK(sender IN ('guest', 'host')),
  body TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE drafts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reservation_id TEXT NOT NULL REFERENCES reservations(id),
  trigger_message_id INTEGER NOT NULL REFERENCES messages(id),
  body TEXT NOT NULL,                 -- AI-generated draft
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending', 'approved', 'edited', 'sent', 'rejected')),
  final_body TEXT,                    -- What was actually sent (original if approved, edited text if edited)
  slack_ts TEXT,                      -- Slack message timestamp for updating the approval message
  reviewer TEXT,                      -- Who approved/rejected
  created_at TEXT DEFAULT (datetime('now')),
  resolved_at TEXT
);
```

**Note:** Schema may need adjustment once we verify against the actual Hospitable API data model (their reservation/message IDs, field names, etc.).

## Webhook Security

Hospitable's webhook signature mechanism needs to be verified during implementation. The webhook handler should validate incoming requests to ensure they originate from Hospitable. This will be designed as a spike task once we have API access and can inspect actual webhook payloads.

## Approval Channel Portability

Slack is the chosen approval channel. If Slack doesn't work out, alternatives are:

| Alternative | Editing UX | Push Notifications | Swap Effort |
|-------------|-----------|-------------------|-------------|
| **Discord** | Modals (similar to Slack) | Good on mobile | ~1-2 days |
| **Telegram** | Reply-based (no modals) or WebApp (hosted mini-page) | Excellent on mobile | ~1-2 days |
| **Web dashboard** | Full control over UX | Requires adding web push | ~2-3 days |
| **SMS (Twilio)** | Reply with edited text | Native phone notifications | ~1 day |

To keep the swap cost low, `approval-notifier.ts` should define a clean interface that the rest of the system codes against. Slack-specific logic (Block Kit formatting, modal payloads, interaction webhook parsing) stays inside that module. The `slack_ts` column in the `drafts` table would be renamed/replaced for a different platform, but the rest of the schema is platform-agnostic.

Estimated swap effort: **1-2 days** for Discord or Telegram, since the core pipeline (webhook → draft → approve → send) doesn't change.

## Repo Structure

```
condobot/
├── CLAUDE.md                    # Project context for Claude Code
├── docs/
│   ├── PRD.md                   # Product requirements document
│   └── EDD.md                   # Engineering design document (this file)
├── knowledge/                   # Knowledge base files
├── src/
│   ├── webhook-handler.ts       # Receives Hospitable message webhooks
│   ├── draft-generator.ts       # Builds prompt with tools, calls Anthropic API
│   ├── approval-notifier.ts     # Sends draft to approval channel (Slack interface)
│   ├── slack-bot.ts             # Slack Block Kit messages, modals, interaction handlers
│   ├── hospitable-client.ts     # Wraps Hospitable API (auth, messages, reservations, calendar)
│   └── tools/                   # Tool definitions for Claude tool-use
│       ├── lookup-property.ts
│       ├── lookup-policy.ts
│       ├── lookup-restaurants.ts
│       ├── lookup-activities.ts
│       ├── lookup-technology.ts
│       ├── check-calendar.ts        # Phase 2
│       ├── get-reservation.ts       # Phase 2
│       └── text-bonnie.ts           # Phase 3
├── data/
│   └── conversations.db         # SQLite: historical messages + ongoing conversations
└── package.json
```
