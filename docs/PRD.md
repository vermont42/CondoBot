# CondoBot — Product Requirements Document

## Phased Delivery

### Phase 1: Knowledge-Base FAQ Responder

**Goal:** Handle the 90% of messages that are repetitive FAQs. Every draft requires human approval before sending.

**Pipeline:**

1. Hospitable webhook fires on `message.created` (guest message received)
2. Webhook handler receives payload, calls Hospitable API to get full conversation thread
3. System builds prompt: system prompt + knowledge base + conversation thread + guest's latest message
4. Anthropic API (Haiku 4.5) generates draft reply using tool-use to pull relevant knowledge
5. Draft is posted to a shared Slack approval channel that Josh, Amanda, and Cindy all monitor (Block Kit message with Send/Edit buttons; Edit opens a modal with the draft pre-filled)
6. Any approver clicks Send (or edits and sends); server calls Hospitable Send Message API to reply as host

**Hospitable API notes:**

- Authentication via Personal Access Token (generated in Hospitable settings under Apps > API access)
- Messaging API access may require emailing support@hospitable.com to enable
- Send Message rate limits: 2 messages/minute per reservation, 50 messages per 5 minutes
- Message webhooks only fire for messages less than 12 hours old; use Messages API for historical retrieval
- Reservation data includes property ID for routing to correct knowledge base

**Key build tasks:**

- Webhook receiver (Bun HTTP server, deployed to Railway, Fly.io, or similar)
- Hospitable API client (auth, get messages, send messages, get reservations)
- Knowledge base files (see Knowledge Base section)
- Prompt construction and Anthropic API integration with tool use
- Slack bot (Block Kit messages, modal for editing, interaction handlers)
- One-time historical message backfill from Hospitable API

**Note:** Every guest message generates a draft — there is no classification or filtering step. Approvers ignore drafts that don't need a reply.

### Phase 2: Calendar-Aware Tool Use

**Goal:** Handle availability questions, extension requests, and date-dependent inquiries by checking the Hospitable calendar.

**New capabilities:**

- Guest asks "Can I extend through Wednesday?" → system checks calendar for conflicting reservations → drafts informed approval or decline
- Guest asks "Is the condo available next week?" → system checks availability → drafts response with booking link
- No-conflict extensions get drafted for one-click approval in the shared channel
- Conflicts get flagged with explanation

### Phase 3: Twilio Integration for Bonnie & Darren

**Goal:** Automate cleaner coordination for schedule changes.

**New capabilities:**

- Extension approved → system texts Bonnie via Twilio to confirm cleaning reschedule
- Bonnie replies → system ingests response and drafts guest confirmation
- The approval channel keeps everyone in the loop without having to manually relay between guest and cleaner

**Implementation note:** Use Twilio (not iMessage) for programmatic SMS. iMessage has no legitimate API. Set up a dedicated Twilio phone number for CondoBot.

## Inquiry Types & Handling

Quick reference for the four main inquiry categories and how CondoBot handles each. These map to the tool-use architecture in the [EDD](EDD.md).

### Type 1: Local Information Questions

Questions about restaurants, activities, things to do.

**Handling:** `lookup_restaurants`, `lookup_activities`, or information from the property website.

### Type 2: Property Questions

Questions about remotes, TV operation, appliances, unit features.

**Handling:** `lookup_property_info`, `lookup_technology`.

### Type 3: Reservation Changes

Requests to modify bookings, dates, or other reservation details.

**Handling:** `check_calendar_availability`, `get_reservation_details` (Phase 2). Until then, provide instructions for using the booking platform or escalate to owners.

### Type 4: Mechanical Issues

Problems with appliances, A/C, plumbing, etc.

**Handling:** `text_bonnie` (Phase 3). Until then, offer to contact Bonnie & Darren.

## Knowledge Base

The knowledge base is the single biggest determinant of response quality. Structured as Markdown files that Claude's tools read from.

### Sources

The banyantree300.com Squarespace site already contains most of the needed content. Claude Code can scrape the site and convert each page into structured knowledge base files. For Kanaloa 1903, equivalent content should be built as the property is set up.

### Directory Structure

```
knowledge/
├── properties/
│   ├── banyan-tree-300.md       # Property description, amenities, check-in/out times, parking (stall #6), pool/hot tub access, beach gear, Wi-Fi (1 gig), 3 smart TVs
│   └── kanaloa-1903.md          # TBD after closing
├── restaurants/
│   ├── banyan-tree-area.md      # Categorized: casual, mid-range, fine dining, family, shave ice, coffee
│   └── kanaloa-area.md          # TBD
├── activities/
│   ├── banyan-tree-area.md      # Manta ray dives, volcano hikes, farm tours, festivals
│   └── kanaloa-area.md          # TBD
├── technology/
│   └── banyan-tree-300.md       # Xumo streambox, Alexa, roller shades, Eero Wi-Fi troubleshooting
├── policies.md                  # House rules, late checkout pricing, cancellation, pet policy, noise, extra guests, children on lanai, parking, no parties, no illegal substances
├── local-amenities.md           # Grocery stores, pharmacies, etc.
└── voice-examples.json          # Cindy's actual past replies, categorized
```

### voice-examples.json

This file is critical for matching Cindy's tone. Structure as an array:

```json
[
  {
    "category": "late_checkout",
    "property": "banyan-tree-300",
    "guest_question": "Is there any chance we could check out a bit later on Sunday?",
    "cindy_reply": "..."
  },
  {
    "category": "restaurants",
    "property": "banyan-tree-300",
    "guest_question": "Any good spots for dinner nearby?",
    "cindy_reply": "..."
  }
]
```

**To build this file:** Export historical conversations from Hospitable and use Claude Code to categorize and extract question/reply pairs. Aim for at least 2–3 dozen representative examples across common categories.

### Common Inquiry Categories

- Restaurant / food recommendations
- Activity recommendations
- Check-in / check-out times and procedures
- Late checkout requests
- Early check-in requests
- Stay extension requests
- Wi-Fi password / troubleshooting
- TV / streaming setup
- Parking instructions
- Beach gear and supplies
- Pool and hot tub access
- Local grocery / pharmacy
- Booking / availability questions
- House rules clarifications
- Noise / neighbor concerns
- Maintenance issues (AC, plumbing, appliances)

## Security & Safety

**Threat model is minimal.** Guests interact through Airbnb/VRBO messaging and believe they're talking to Cindy. They have no reason to attempt prompt injection or adversarial inputs. This is fundamentally different from a public-facing chatbot.

**Human-in-the-loop** serves as both quality check and safety layer in Phase 1. Josh, Amanda, or Cindy catches hallucinations, wrong information, or odd tone before anything reaches the guest.

**For future auto-send (if ever implemented):** Guard against hallucination rather than adversarial abuse. The system should not confidently affirm information that isn't in the knowledge base (e.g., a guest mentions a restaurant by name and the model agrees it's great without verifying).

## Cost Estimate

At Haiku 4.5 pricing ($1/$5 per million input/output tokens):

- ~4,000 input tokens per request (system prompt + knowledge base + conversation thread)
- ~250 output tokens per response
- **~$0.005 per draft response (half a cent)**
- At 20 messages/day peak season across both properties: **~$3/month**
- With prompt caching on the system prompt: even less
