# CondoBot

![CondoBot](CondoBot.png)

An AI-assisted guest messaging system for vacation rental condos in Kailua-Kona, Hawaii. CondoBot monitors the Hospitable platform for guest inquiries, drafts replies that match Cindy's voice and tone, and sends them for human approval before messaging guests.

> **Detailed docs:** [Product Requirements (PRD)](docs/PRD.md) | [Engineering Design (EDD)](docs/EDD.md)

## Project Overview

### Purpose

CondoBot replaces repetitive manual reply composition with AI-generated drafts. It monitors Hospitable (which aggregates Airbnb and VRBO into a unified inbox) for guest messages, composes a response using a knowledge base and Claude's tool-use architecture, and surfaces the draft for approval before sending.

### Workflow

1. Hospitable webhook fires on new guest message
2. CondoBot retrieves the full conversation thread and composes a draft reply
3. Draft is posted to a shared Slack approval channel that Josh, Amanda, and Cindy monitor
4. Any approver clicks Send (or edits and sends); CondoBot sends the message to the guest via Hospitable

### Team

| Name | Role |
|------|------|
| Josh Adams | Co-owner and developer of CondoBot |
| Amanda Vinson | Co-owner (Josh's wife) |
| Cindy Vinson | Amanda's mother, primary message handler. Her voice and tone are the target for AI-generated responses. |
| Bonnie & Darren | Cleaners and caretakers. Currently coordinated by Cindy via iMessage; Twilio SMS planned for Phase 3. |

Josh and Amanda live in Orinda, CA. Cindy lives in nearby Walnut Creek, CA.

### Communication Platform

Slack. Drafts are posted to a shared approval channel (e.g., `#condobot-approvals`) as Block Kit messages with Send/Edit buttons. Josh, Amanda, and Cindy all monitor the channel — whoever sees a draft first can approve it. Edit opens a modal with the draft pre-filled for inline editing.

## Properties

### Banyan Tree 300

- **Address:** Unit 300, The Banyan Tree, 76-6268 Ali'i Drive, Kailua-Kona, HI 96740
- **Type:** 2-bedroom, 2-bathroom oceanfront corner unit, 20 feet from the beach
- **Website:** https://www.banyantree300.com
- **Email:** banyantree300@gmail.com
- **Status:** Operational for 1.5 years, listed on Airbnb and VRBO

#### Key Amenities

- Two king beds + sofa sleeper
- 1 gigabit WiFi
- 3 smart TVs
- Gourmet kitchen
- Beach equipment provided
- Recently renovated in 2024

### Kanaloa at Kona, Unit 1903

- **Status:** Closing March 9, 2026
- **Listings:** Will be listed on Airbnb and VRBO, managed through Hospitable
- **Details:** TBD after closing

## Response Guidelines

- **Identity:** Message as "Cindy"
- **Tone:** Friendly, helpful, warm
- **Voice source of truth:** `knowledge/voice-examples.json` defines Cindy's style. The system prompt should include representative examples from this file.
- **Hawaiian hospitality:** Use Hawaiian words naturally:
  - *Mahalo* (thank you)
  - *Aloha* (hello/goodbye/love)
  - *Ohana* (family)
  - *Mele Kalikimaka* (Merry Christmas, when seasonal)

## Key Resources

### Website Sections

- Restaurants: https://www.banyantree300.com (restaurants section)
- Activities: https://www.banyantree300.com (activities section)
- Local Amenities: https://www.banyantree300.com (amenities section)

### Restaurant Recommendations

- Da Poke Shack
- Green Flash Coffee
- Huggo's
- (Additional recommendations available on website)

### Activity Highlights

- Manta ray night diving/snorkeling
- Hawaii Volcanoes National Park hiking
- Snorkeling at nearby beaches
- (Full list on website)

## TODO

- [ ] Get an Anthropic API key from https://console.anthropic.com (required for powering CondoBot — the Max subscription is for personal use only, not automation)
- [ ] Decide where to host CondoBot (VPS, Mac Mini, Railway, Fly.io, or other)
- [x] Get Hospitable API Personal Access Token (Settings > Apps > API access) and store in .env file
- [x] Email support@hospitable.com from Amanda's email account requesting Messaging API access (turned out to be unnecessary — Messaging API is available through the Public API and the existing PAT works)
- [x] Create Slack workspace and bot app
- [ ] Set up the webhook in Hospitable once you have a deployed server URL to point it at; see EDD
- [ ] Scrape banyantree300.com for knowledge base content
- [ ] Export historical Hospitable conversations for voice-examples.json
