import type { Context } from "hono";
import { notifyChannel, postDraftReply } from "./slack";
import { resolveProperty } from "./properties";
import { generateDraft } from "./draft-generator";

export async function handleWebhook(c: Context) {
  let payload;
  try {
    payload = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  console.log("Webhook received:", JSON.stringify(payload, null, 2));

  if (payload.action === "message.created" && payload.data?.sender_type === "guest") {
    const body = payload.data.body ?? "";
    const senderName = payload.data.sender?.first_name ?? payload.data.user?.first_name ?? "Unknown";
    const listingName = payload.data.property?.public_name ?? payload.data.property?.name ?? payload.data.listing?.name ?? "Unknown listing";
    const platform = payload.data.platform ?? "unknown";

    // Post guest notification to Slack and get the thread timestamp
    notifyChannel({ body, senderName, listingName, platform })
      .then((threadTs) => {
        if (!threadTs) return;

        // Generate AI draft and post as threaded reply
        const property = resolveProperty(listingName);
        const isBooked = payload.data.reservation_id != null;
        generateDraft({
          guestMessage: body,
          guestName: senderName,
          propertySlug: property.slug,
          isBooked,
        })
          .then((draft) => {
            if (draft) {
              postDraftReply(threadTs, draft, senderName).catch((err) =>
                console.error("Failed to post draft reply:", err),
              );
            }
          })
          .catch((err) => console.error("Draft generation failed:", err));
      })
      .catch((err) => console.error("Slack notification failed:", err));
  }

  return c.json({ status: "received" });
}
