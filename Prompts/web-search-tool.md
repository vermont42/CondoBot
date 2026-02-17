# Add Web Search Tool to Draft Generation

## Context

CondoBot's knowledge base covers property info, policies, restaurants, activities, amenities, and technology — but guests sometimes ask about topics outside that scope (e.g., spearfishing spots, airport transportation, inter-island flights, weather). Currently the AI either makes something up or punts. Adding a web search tool lets it look up real answers and draft informed replies, while the human approval step catches any bad results.

## Approach: Tavily Search API

Tavily over Brave/SerpAPI/Google because:
- Free tier: 1,000 searches/month, no credit card required (CondoBot needs ~30-60/month)
- Returns pre-extracted page content per result (not just snippets) — purpose-built for LLM tool use
- Simple REST `POST`, no SDK — uses native `fetch` like `hospitable.ts` already does

## Files to Change

| File | Change |
|------|--------|
| `src/tools.ts` | Add `web_search` tool definition, `searchWeb()` helper, switch case |
| `src/draft-generator.ts` | Add "Tool Usage Priority" section to system prompt |

No new dependencies — uses Bun's native `fetch`.

## Step 1: Modify `src/tools.ts`

**Add env var** near top (after line 6):
```typescript
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
```

**Add `searchWeb` helper** (before `toolDefinitions`):
- `POST https://api.tavily.com/search` with Bearer auth
- Params: `query`, `max_results: 5`, `search_depth: "basic"`, `include_answer: "basic"`
- Format results as: summary + title/content/source per result, separated by `---`
- On error: return fallback string (don't throw) — consistent with other tools
- Log each search for visibility: `console.log('Web search: "${query}"')`

**Add tool definition** (append after `lookup_amenities`):
- `name: "web_search"`
- `input_schema`: requires `query` string
- `description` explicitly scopes to Hawaii/Big Island/travel topics and lists examples (spearfishing, tour operators, airport transport, weather)

**Add switch case** in `executeTool` (before `default`):
- Read `input.query`, call `searchWeb(query)`, return result string

## Step 2: Modify `src/draft-generator.ts`

Add a "Tool Usage Priority" section to the system prompt in `buildSystemPrompt`, between the website-URL guidance and the instructions section:

1. Always check knowledge-base tools first (verified, curated info)
2. Only use `web_search` for topics not in the knowledge base
3. Include geographic context in search queries (e.g., "Kailua-Kona Big Island")
4. Never share raw URLs from search results with guests — summarize in Cindy's voice
5. If search returns poor results, use general knowledge and offer to find out more

## Step 3: Environment Variable

- **Name:** `TAVILY_API_KEY`
- **Get key:** https://app.tavily.com/sign-in (free signup, no credit card)
- Add to `.env` locally and to Railway via dashboard

## Verification

Test with these webhook messages (modify `scripts/test-webhook.sh`):
1. "What's the Wi-Fi password?" → should use `lookup_technology`, NOT web search
2. "Where can I go spearfishing near the condo?" → should fall back to `web_search`
3. "Can you recommend restaurants?" → should use `lookup_restaurants`, NOT web search

Check Railway logs to confirm which tool is invoked for each.
