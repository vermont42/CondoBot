# Railway Setup

Steps taken to deploy CondoBot to Railway.

## 1. Create an account

Go to https://railway.com and sign in with GitHub. This links your repos automatically.

## 2. Create the project

**New Project > Deploy from GitHub Repo** — select `vermont42/CondoBot`.

Railway auto-detects Bun from the `bun.lock` file and runs `bun install` + `bun run start`.

## 3. Generate a public domain

Once the service is created, go to **Settings > Networking > Generate Domain**. The domain must be generated **before** the first deploy or the deploy will fail with "Error configuring network."

Production URL: `https://condobot-production.up.railway.app`

## 4. Add environment variables

In the service's **Variables** tab, add:

- `HOSPITABLE_API_TOKEN` — copied from local `.env`
- `SLACK_BOT_TOKEN` — copied from local `.env`

These aren't used by the server yet but are ready for the next phase.

## 5. Verify the deploy

```bash
curl https://condobot-production.up.railway.app/
# Expected: CondoBot is running

curl -X POST https://condobot-production.up.railway.app/webhooks/hospitable \
  -H "Content-Type: application/json" \
  -d '{"event":"message.created","data":{"message":"test"}}'
# Expected: {"status":"received"}
```

Check Railway logs to confirm `CondoBot listening on port <PORT>` and the logged webhook payload.

## Pricing

The free trial gives $5 of usage. After that, the Hobby plan is $5/month.
