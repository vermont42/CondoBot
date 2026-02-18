import { Hono } from "hono";
import { handleWebhook } from "./webhook-handler";
import { handleSlackInteraction } from "./slack-interactions";
import { cleanStaleDrafts } from "./draft-store";

const app = new Hono();

// --- Slack signature verification ---
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;

async function verifySlackSignature(
  rawBody: string,
  timestamp: string,
  signature: string,
): Promise<boolean> {
  if (!SLACK_SIGNING_SECRET) return false;
  const sigBasestring = `v0:${timestamp}:${rawBody}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SLACK_SIGNING_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(sigBasestring));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return signature === `v0=${hex}`;
}

// --- Hospitable webhook signature verification ---
const HOSPITABLE_WEBHOOK_SECRET = process.env.HOSPITABLE_WEBHOOK_SECRET;

async function verifyHospitableSignature(
  rawBody: string,
  signature: string,
): Promise<boolean> {
  if (!HOSPITABLE_WEBHOOK_SECRET) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(HOSPITABLE_WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return signature === hex;
}

app.get("/", (c) => c.text("CondoBot is running"));

app.post("/webhooks/hospitable", async (c) => {
  const rawBody = await c.req.text();

  if (HOSPITABLE_WEBHOOK_SECRET) {
    const signature = c.req.header("Signature") ?? "";
    if (!await verifyHospitableSignature(rawBody, signature)) {
      console.warn("Hospitable webhook signature verification failed");
      return c.json({ error: "Invalid signature" }, 401);
    }
  }

  return handleWebhook(c, rawBody);
});

app.post("/slack/interactions", async (c) => {
  const rawBody = await c.req.text();

  if (SLACK_SIGNING_SECRET) {
    const timestamp = c.req.header("X-Slack-Request-Timestamp") ?? "";
    const signature = c.req.header("X-Slack-Signature") ?? "";

    // Reject requests older than 5 minutes to prevent replay attacks
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - Number(timestamp)) > 300) {
      return c.json({ error: "Request too old" }, 401);
    }

    if (!await verifySlackSignature(rawBody, timestamp, signature)) {
      console.warn("Slack signature verification failed");
      return c.json({ error: "Invalid signature" }, 401);
    }
  }

  return handleSlackInteraction(c, rawBody);
});

// Clean up stale drafts every hour
setInterval(cleanStaleDrafts, 60 * 60 * 1000);

const port = process.env.PORT || 3000;
console.log(`CondoBot listening on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
