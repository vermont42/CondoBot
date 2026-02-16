import type { Context } from "hono";
import { notifyChannel } from "./slack";

export async function handleWebhook(c: Context) {
  let payload;
  try {
    payload = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  console.log("Webhook received:", JSON.stringify(payload, null, 2));

  if (payload.action === "message.created" && payload.data?.sender_type === "guest") {
    notifyChannel({
      body: payload.data.body ?? "",
      senderName: payload.data.user?.first_name ?? "Unknown",
      listingName: payload.data.listing?.name ?? "Unknown listing",
      platform: payload.data.platform ?? "unknown",
    }).catch((err) => console.error("Slack notification failed:", err));
  }

  return c.json({ status: "received" });
}
