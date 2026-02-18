import type { Context } from "hono";
import { getDraft, deleteDraft } from "./draft-store";
import { sendMessageToGuest } from "./hospitable";
import { updateDraftMessage, openEditModal } from "./slack";

export async function handleSlackInteraction(c: Context, rawBody?: string) {
  let payload: any;
  try {
    // Parse URL-encoded form body to extract the "payload" field
    const text = rawBody ?? await c.req.text();
    const params = new URLSearchParams(text);
    payload = JSON.parse(params.get("payload") ?? "");
  } catch {
    return c.json({ error: "Invalid payload" }, 400);
  }

  if (payload.type === "block_actions") {
    // Acknowledge immediately — Slack requires 200 within 3 seconds
    const action = payload.actions?.[0];
    if (!action) return c.json({ ok: true });

    const draftId = action.value;
    const draft = getDraft(draftId);
    const userName =
      payload.user?.name ?? payload.user?.username ?? "Someone";

    if (!draft) {
      // Already handled or server restarted — fail gracefully
      console.warn(`Draft ${draftId} not found (already sent or expired)`);
      return c.json({ ok: true });
    }

    if (action.action_id === "approve_draft") {
      // Process async so we respond to Slack within 3s
      processApproval(draft, draft.draftText, userName, false).catch((err) =>
        console.error("Approval processing failed:", err),
      );
    } else if (action.action_id === "edit_draft") {
      const triggerId = payload.trigger_id;
      openEditModal(triggerId, draftId, draft.draftText, draft.guestName).catch(
        (err) => console.error("Failed to open edit modal:", err),
      );
    }

    return c.json({ ok: true });
  }

  if (payload.type === "view_submission") {
    const callbackId = payload.view?.callback_id;

    if (callbackId === "edit_draft_modal") {
      let metadata: any;
      try {
        metadata = JSON.parse(payload.view.private_metadata);
      } catch {
        return c.json({ error: "Invalid metadata" }, 400);
      }
      const draftId = metadata.draftId;
      const editedText =
        payload.view.state.values.draft_input.draft_text.value;
      const userName =
        payload.user?.name ?? payload.user?.username ?? "Someone";

      const draft = getDraft(draftId);
      if (!draft) {
        console.warn(`Draft ${draftId} not found on modal submit`);
        return c.json({ response_action: "clear" });
      }

      // Capture text to send — don't mutate the shared draft object
      processApproval(draft, editedText, userName, true).catch((err) =>
        console.error("Edit+send processing failed:", err),
      );

      return c.json({ response_action: "clear" });
    }
  }

  return c.json({ ok: true });
}

async function processApproval(
  draft: { id: string; reservationId?: string; conversationId?: string; guestName: string; draftText: string; slackThreadTs: string; slackMessageTs: string },
  textToSend: string,
  approverName: string,
  wasEdited: boolean,
): Promise<void> {
  try {
    await sendMessageToGuest(
      { reservationId: draft.reservationId, conversationId: draft.conversationId },
      textToSend,
    );

    await updateDraftMessage(
      draft.slackMessageTs,
      draft.slackThreadTs,
      textToSend,
      draft.guestName,
      approverName,
      wasEdited,
    );

    deleteDraft(draft.id);
    console.log(
      `Draft ${draft.id} sent to guest ${draft.guestName} by ${approverName}${wasEdited ? " (edited)" : ""}`,
    );
  } catch (err) {
    console.error(
      `Failed to send draft ${draft.id} to Hospitable:`,
      err,
    );
    // Don't delete draft — user can retry
  }
}
