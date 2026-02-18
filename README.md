[![Built with Bun](https://img.shields.io/badge/Built_with-Bun-f9f1e1?style=flat-square&logo=bun)](https://bun.sh)
[![Powered by Claude](https://img.shields.io/badge/Powered_by-Claude-d4a574?style=flat-square&logo=anthropic)](https://anthropic.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Slack](https://img.shields.io/badge/Slack-4A154B?style=flat-square&logo=slack&logoColor=white)](https://slack.com)
[![Aloha from Kona](https://img.shields.io/badge/Aloha_from-Kona_🌺-ff6b6b?style=flat-square)](#)
[![Status: Phase 1](https://img.shields.io/badge/Status-Phase_1-f0a500?style=flat-square)](#)

<p align="center">
  <img src="img/CondoBot.png" alt="CondoBot" width="300" />
</p>

# CondoBot

An AI-powered guest messaging system for our vacation rental condos in Kailua-Kona, Hawaii. CondoBot monitors [Hospitable](https://www.hospitable.com) for incoming guest messages, drafts replies that match Cindy's warm and welcoming voice, and posts them to Slack for human approval before sending.

## Flow

<p align="center">
  <img src="img/flow_diagram.png" alt="CondoBot message flow" width="700" />
</p>

## Architecture

<p align="center">
  <img src="img/architecture.png" alt="CondoBot architecture" width="800" />
</p>

Five layers make up the system: **External Services** (Hospitable, Slack, Claude, Tavily) handle communication with the outside world; **Server & Routes** (Hono HTTP server, webhook handler, Slack interaction handler) receive and dispatch requests; **Core Logic** (draft generator, tool executor, property resolver) orchestrate AI-powered reply composition; the **Knowledge Base** (voice examples, property details, policies, local recommendations) gives the AI grounded, accurate content to draw from; and **Storage** (in-memory draft store) holds pending drafts until approval. Solid blue lines trace data flow, dashed green lines show tool calls into the Claude API and knowledge base, and dotted red lines mark async events like Slack button clicks and draft lifecycle updates.

**Detailed docs:** [Product Requirements (PRD)](docs/PRD.md) | [Engineering Design (EDD)](docs/EDD.md)
