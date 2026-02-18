import type { Context } from "hono";
import { notifyChannel, postDraftWithButtons, postPlainDraft } from "./slack";
import { resolveProperty } from "./properties";
import { generateDraft } from "./draft-generator";
import { storeDraft } from "./draft-store";

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
    const reservationId: string | undefined = payload.data.reservation_id ?? undefined;
    const conversationId: string | undefined = payload.data.conversation_id;
    const canSend = !!(reservationId || conversationId);

    // Resolve property and skip unsupported listings
    const property = resolveProperty(listingName);
    if (!property.supported) {
      console.log(`Skipping unsupported property: "${listingName}"`);
      return c.json({ status: "received" });
    }

    // Post guest notification to Slack and get the thread timestamp
    notifyChannel({ body, senderName, listingName, platform })
      .then((threadTs) => {
        if (!threadTs) return;

        // Generate AI draft and post as threaded reply
        const isBooked = reservationId != null;
        generateDraft({
          guestMessage: body,
          guestName: senderName,
          propertySlug: property.slug,
          isBooked,
          reservationId,
        })
          .then((draft) => {
            if (!draft) return;

            if (!canSend) {
              console.warn("No reservation_id or conversation_id — posting draft without buttons");
              postPlainDraft(threadTs, draft, senderName).catch((err) =>
                console.error("Failed to post plain draft:", err),
              );
              return;
            }

            const draftId = crypto.randomUUID();
            postDraftWithButtons(threadTs, draft, senderName, draftId)
              .then((messageTs) => {
                if (!messageTs) return;
                storeDraft({
                  id: draftId,
                  reservationId,
                  conversationId,
                  guestName: senderName,
                  draftText: draft,
                  slackThreadTs: threadTs,
                  slackMessageTs: messageTs,
                  createdAt: Date.now(),
                });
                console.log(`Draft ${draftId} stored for guest ${senderName} (reservation=${reservationId ?? "none"}, conversation=${conversationId ?? "none"})`);
              })
              .catch((err) => console.error("Failed to post draft with buttons:", err));
          })
          .catch((err) => console.error("Draft generation failed:", err));
      })
      .catch((err) => console.error("Slack notification failed:", err));
  }

  return c.json({ status: "received" });
}
