# CondoBot

![CondoBot](CondoBot.png)

An AI-assisted guest messaging system for three vacation-rental condos in Hawaii and one vacation-rental house in California, CondoBot monitors the Hospitable platform for guest inquiries, drafts replies that match Cindy's voice and tone, and sends them for human approval before messaging guests. Additional features are planned.

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
| Josh Adams | Co-owner of both Kona units; developer of CondoBot |
| Amanda Vinson | Co-owner of both Kona units; Josh's wife |
| Cindy Vinson | Co-owner of Sands of Kahana (Maui) unit and Tahoe house; Amanda's mother; primary message handler. Cindy's voice and tone are the target for AI-generated responses. |
| Bill Vinson | Co-owner of Sands of Kahana unit and Tahoe house; Amanda's father |
| Bonnie & Darren | Cleaners and caretakers for the two Kona condos. Currently coordinated by Cindy via iMessage; Twilio SMS planned for Phase 3. |

Josh and Amanda live in Orinda, CA. Cindy and Bill live in nearby Walnut Creek, CA.

### Communication Platform

Slack. Drafts are posted to a shared approval channel (`#condobot-approvals`) as Block Kit messages with Send/Edit buttons. Josh, Amanda, and Cindy all monitor the channel — whoever sees a draft first can approve it. Edit opens a modal with the draft pre-filled for inline editing.

## Properties

### Banyan Tree 300

- **Address:** The Banyan Tree, Unit 300, 76-6268 Ali'i Drive, Kailua-Kona, HI 96740
- **Type:** 2-bedroom, 2-bathroom oceanfront corner unit, 20 feet from the beach
- **Website:** https://www.banyantree300.com
- **Email:** banyantree300@gmail.com
- **Status:** Operational since fall 2024, listed on Airbnb and VRBO

#### Key Amenities of Banyan Tree Unit

- Two king beds + sofa sleeper
- 1 gigabit WiFi
- 3 smart TVs
- Gourmet kitchen
- Beach equipment provided
- Fully renovated in 2024

### Kanaloa at Kona, Unit 1903

- **Address:** Kanaloa at Kona, Unit 1903, 78-261 Manukai St, Kailua-Kona, HI 96740
- **Type:** 3-bedroom, 2-bathroom oceanfront unit, 20 feet from the beach
- **Website:** https://www.kanaloa1903.com (planned)
- **Email:** kanaloa1903@gmail.com
- **Status:** Purchase closing March 9, 2026; will be listed on Airbnb and VRBO after setup

### Sands of Kahana, Unit 384

- **Address:** 4299 Lower Honoapiilani Rd, Lahaina, HI 96761
- **Type:** 3-bedroom, 3-bathroom oceanfront unit, 30 feet from the beach
- **Website:** https://www.vinsonfamilyvacations.com
- **Email:** cindy@vinson.org
- **Status:** Operational since 1998

### 895 Skyline Drive

- **Address:** 895 Skyline Drive, Tahoe City, CA 96145
- **Type:** 3-bedroom, 3-bathroom house overlooking Lake Tahoe
- **Website:** https://www.vinsonfamilyvacations.com
- **Email:** cindy@vinson.org
- **Status:** Operational since 1990

## Response Guidelines

- **Identity:** Message as "Cindy"
- **Tone:** Friendly, helpful, warm
- **Voice source of truth:** `knowledge/voice-examples.json` defines Cindy's style. The system prompt should include representative examples from this file.
- **Hawaiian hospitality:** For the units in Hawaii, use Hawaiian words naturally:
  - *Mahalo* (thank you)
  - *Aloha* (hello/goodbye/love)
  - *Ohana* (family)
  - *Mele Kalikimaka* (Merry Christmas, when seasonal)
Do not use Hawaiian words when answering inquiries about the California house.

## Key Resources

### Banyan-Website Sections

- Restaurants: https://www.banyantree300.com (restaurants section)
- Activities: https://www.banyantree300.com (activities section)
- Local Amenities: https://www.banyantree300.com (amenities section)

### Competing Kanaloa Business

https://www.konacoastvacations.com/neighborhoods/kanaloa-at-kona/

This has info that 1903's website could use.

### YouTube Video About Kanaloa at Kona

https://www.youtube.com/watch?v=1M62gp7SOk8

This video answers questions like:
What makes Kanaloa at Kona a top luxury living option in Hawaii?
What amenities are offered at Kanaloa at Kona?
How close is Kanaloa at Kona to the ocean and key attractions?
What are the property features of Kanaloa at Kona condos?
Is Kanaloa at Kona a good investment for second homes or vacation rentals?
How does Kanaloa at Kona compare to other luxury communities on the Big Island?
What makes the lifestyle at Kanaloa at Kona so desirable?

### Kanaloa Communiqué

https://kanaloacommunique.com

This website is run by the Kanaloa at Kona HOA and has information about the complex and its management.

## Developer Workflow and Guidelines

- When outputting long commands for Josh to run in his terminal, copy them to the macOS pasteboard using `echo "..." | pbcopy` and tell him the command is in his clipboard. Terminal copy-paste mangles long lines due to soft-wrapping.
- When sending JSON via `curl -d`, do NOT pass it inline — the shell mangles nested quotes. Write the JSON to a temp file and use `curl -d @/tmp/filename.json` instead.
- When you need to read documentation that is JavaScript-rendered (and WebFetch only returns CSS/empty markup), ask Josh to use the Claude Chrome extension to explore the page. Give him the URL and a specific prompt describing what to extract.
- API Integration: When working with external APIs (Hospitable, App Store Connect, etc.), always verify base URLs and endpoint paths against official documentation before implementing. Never assume API paths — read the docs first. If you can't access the documentation at a certain URL, provide Josh the URL and a prompt to provide the Claude Chrome extension.

## TODO

- [x] Get an Anthropic API key from https://console.anthropic.com (required for powering CondoBot — the Max subscription is for personal use only, not automation)
- [x] Decide where to host CondoBot (VPS, Mac Mini, Railway, Fly.io, or other) - chose Railway
- [x] Get Hospitable API Personal Access Token (Settings > Apps > API access) and store in .env file
- [x] Email support@hospitable.com from Amanda's email account requesting Messaging API access
- [x] Create Slack workspace and bot app
- [ ] Add conversation threading to draft generation — pass prior messages from the Hospitable thread so the model sees the full back-and-forth, not just the latest guest message (see EDD § Conversation Threading)
- [ ] For now, have CondoBot ignore all inquiries that are not for the Banyan Tree unit
- [ ] Add support for inquiries about the other three properties
- [ ] Install the Railway CLI
- [ ] Complete scrape of banyantree300.com for knowledge-base content
- [ ] Export historical Hospitable conversations for voice-examples.json
