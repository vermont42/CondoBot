import type { Context } from "hono";
import { notifyChannel, postDraftWithButtons, postPlainDraft } from "./slack";
import { resolveProperty } from "./properties";
import { generateDraft } from "./draft-generator";
import { storeDraft } from "./draft-store";

interface HospitableWebhookPayload {
  action?: string;
  data?: {
    id?: string;
    body?: string;
    sender_type?: string;
    sender?: { first_name?: string };
    user?: { first_name?: string };
    property?: { public_name?: string; name?: string };
    listing?: { name?: string };
    platform?: string;
    reservation_id?: string;
    conversation_id?: string;
  };
}

// Dedup: track recently processed message IDs to ignore webhook retries
const recentMessageIds = new Map<string, number>();
const DEDUP_TTL_MS = 5 * 60 * 1000; // 5 minutes

function isDuplicate(messageId: string): boolean {
  const now = Date.now();

  // Clean expired entries
  for (const [id, timestamp] of recentMessageIds) {
    if (now - timestamp > DEDUP_TTL_MS) recentMessageIds.delete(id);
  }

  if (recentMessageIds.has(messageId)) return true;
  recentMessageIds.set(messageId, now);
  return false;
}

export async function handleWebhook(c: Context, rawBody?: string) {
  let payload: HospitableWebhookPayload;
  try {
    const text = rawBody ?? await c.req.text();
    payload = JSON.parse(text);
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const data = payload.data;
  const action = payload.action ?? "unknown";
  const senderName = data?.sender?.first_name ?? data?.user?.first_name ?? "Unknown";
  const listingName = data?.property?.public_name ?? data?.property?.name ?? data?.listing?.name ?? "Unknown listing";
  const messageId = data?.id;

  console.log(`Webhook: action=${action} sender=${senderName} listing="${listingName}" message_id=${messageId ?? "none"}`);

  if (action === "message.created" && data?.sender_type === "guest") {
    // Skip duplicate webhooks
    if (messageId && isDuplicate(messageId)) {
      console.log(`Skipping duplicate webhook for message ${messageId}`);
      return c.json({ status: "received" });
    }

    const body = data.body ?? "";
    const platform = data.platform ?? "unknown";
    const reservationId: string | undefined = data.reservation_id ?? undefined;
    const conversationId: string | undefined = data.conversation_id;
    const canSend = !!(reservationId || conversationId);

    // Resolve property and skip unsupported listings
    const property = resolveProperty(listingName);
    if (!property.supported) {
      console.log(`Skipping unsupported property: "${listingName}"`);
      return c.json({ status: "received" });
    }

    // Fire-and-forget: process in background, return 200 immediately
    processGuestMessage({
      body,
      senderName,
      listingName,
      platform,
      reservationId,
      conversationId,
      canSend,
      propertySlug: property.slug,
    }).catch((err) => console.error("Guest message processing failed:", err));
  }

  return c.json({ status: "received" });
}

interface GuestMessageContext {
  body: string;
  senderName: string;
  listingName: string;
  platform: string;
  reservationId?: string;
  conversationId?: string;
  canSend: boolean;
  propertySlug: string;
}

async function processGuestMessage(ctx: GuestMessageContext): Promise<void> {
  const threadTs = await notifyChannel({
    body: ctx.body,
    senderName: ctx.senderName,
    listingName: ctx.listingName,
    platform: ctx.platform,
  });
  if (!threadTs) return;

  const isBooked = ctx.reservationId != null;
  const draft = await generateDraft({
    guestMessage: ctx.body,
    guestName: ctx.senderName,
    propertySlug: ctx.propertySlug,
    isBooked,
    reservationId: ctx.reservationId,
  });
  if (!draft) return;

  if (!ctx.canSend) {
    console.warn("No reservation_id or conversation_id — posting draft without buttons");
    await postPlainDraft(threadTs, draft, ctx.senderName);
    return;
  }

  const draftId = crypto.randomUUID();
  const messageTs = await postDraftWithButtons(threadTs, draft, ctx.senderName, draftId);
  if (!messageTs) return;

  storeDraft({
    id: draftId,
    reservationId: ctx.reservationId,
    conversationId: ctx.conversationId,
    guestName: ctx.senderName,
    draftText: draft,
    slackThreadTs: threadTs,
    slackMessageTs: messageTs,
    createdAt: Date.now(),
  });
  console.log(`Draft ${draftId} stored for guest ${ctx.senderName} (reservation=${ctx.reservationId ?? "none"}, conversation=${ctx.conversationId ?? "none"})`);
}
