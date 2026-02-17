import { Hono } from "hono";
import { handleWebhook } from "./webhook-handler";
import { handleSlackInteraction } from "./slack-interactions";

const app = new Hono();

app.get("/", (c) => c.text("CondoBot is running"));
app.post("/webhooks/hospitable", handleWebhook);
app.post("/slack/interactions", handleSlackInteraction);

const port = process.env.PORT || 3000;
console.log(`CondoBot listening on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
