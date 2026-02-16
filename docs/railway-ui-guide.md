# Railway Dashboard UI Guide

A quick reference for the parts of the Railway UI we use for CondoBot.

## Project Canvas

After logging in at [railway.app](https://railway.app), you land on the **project canvas** — a visual layout of your services. CondoBot's project is called "genuine-love" (Railway auto-generates project names).

The **CondoBot service card** is the tile on the canvas with the GitHub icon. Click it to open the service detail view. Don't confuse this with the **project settings** (gear icon, top-right) — that's for project-wide config like members and billing, not for your service.

## Service Detail View

Clicking the CondoBot card opens a panel with four tabs:

### Deployments

Shows every deployment with its status badge:

| Badge | Meaning |
|-------|---------|
| **Active** | Currently running in production |
| **Removed** | Superseded by a newer deployment |
| **Failed** | Build or deploy error |

Each deployment has a **three-dot menu (...)** for actions like **Redeploy** and **Rollback**.

Click **View logs** on any deployment to see its output. Inside, there are sub-tabs:

- **Build Logs** — output from `bun install` and the build step
- **Deploy Logs** — runtime `console.log` / `console.error` output from the app (this is where you'll look most often)
- **HTTP Logs** — request/response log for incoming traffic

### Variables

Where you set environment variables like `SLACK_BOT_TOKEN` and `SLACK_CHANNEL_ID`. Two ways to add them:

1. **+ New Variable** — add one at a time via form fields
2. **Raw Editor** — paste multiple variables at once in `KEY="value"` or JSON format

**Gotcha we hit:** After adding variables, open the **Raw Editor** and click **Update Variables** to make sure they're actually saved and injected. Without this, the variables may appear in the UI but not reach the running app.

### Metrics

CPU, memory, and network usage graphs. Useful for spotting if the service is running hot or idle.

### Settings

Service-level config: build/deploy commands, the linked GitHub repo, and the public domain (`condobot-production.up.railway.app`).

## Deployments Are Triggered By

| Trigger | What happens |
|---------|-------------|
| `git push` to main | Railway pulls the new code, builds, and deploys automatically |
| Changing environment variables | Should trigger a redeploy (use Raw Editor → Update Variables to be safe) |
| Manual **Redeploy** from three-dot menu | Re-runs the current code with current variables |

## Common Tasks

### Check if a deploy is working
1. Click the CondoBot card
2. Go to **Deployments** tab
3. Confirm the latest deployment shows **Active**
4. Click **View logs** → **Deploy Logs** to see runtime output

### Add or change an environment variable
1. Click the CondoBot card
2. Go to **Variables** tab
3. Add or edit the variable
4. Open **Raw Editor** → click **Update Variables**
5. Wait for the automatic redeploy

### Test the webhook endpoint

Run the test script to send a fake guest message to production:

```bash
./scripts/test-webhook.sh
```

You should get `{"status":"received"}` back and see a notification in `#condobot-approvals`. If nothing appears in Slack, check Deploy Logs for errors.

### Redeploy manually
1. Click the CondoBot card
2. Go to **Deployments** tab
3. Click **...** on the active deployment → **Redeploy**
