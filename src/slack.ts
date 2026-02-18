import { WebClient } from "@slack/web-api";

const token = process.env.SLACK_BOT_TOKEN;
const channel = process.env.SLACK_CHANNEL_ID;

if (!token) console.warn("SLACK_BOT_TOKEN is not set — Slack notifications disabled");
if (!channel) console.warn("SLACK_CHANNEL_ID is not set — Slack notifications disabled");

const slack = token ? new WebClient(token) : null;

interface GuestMessage {
  body: string;
  senderName: string;
  listingName: string;
  platform: string;
}

export async function notifyChannel(msg: GuestMessage): Promise<string | undefined> {
  if (!slack || !channel) return undefined;

  const result = await slack.chat.postMessage({
    channel,
    text: [
      `*New guest message* on ${msg.listingName} (${msg.platform})`,
      `*From:* ${msg.senderName}`,
      `> ${msg.body}`,
    ].join("\n"),
  });

  return result.ts;
}

export async function postDraftWithButtons(
  threadTs: string,
  draft: string,
  guestName: string,
  draftId: string,
): Promise<string | undefined> {
  if (!slack || !channel) return undefined;

  const result = await slack.chat.postMessage({
    channel,
    thread_ts: threadTs,
    text: `Suggested reply to ${guestName}:\n${draft}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Suggested reply to ${guestName}:*\n${draft}`,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Send" },
            style: "primary",
            action_id: "approve_draft",
            value: draftId,
          },
          {
            type: "button",
            text: { type: "plain_text", text: "Edit" },
            action_id: "edit_draft",
            value: draftId,
          },
        ],
      },
    ],
  });

  return result.ts;
}

export async function updateDraftMessage(
  messageTs: string,
  threadTs: string,
  sentText: string,
  guestName: string,
  approverName: string,
  wasEdited: boolean,
): Promise<void> {
  if (!slack || !channel) return;

  const action = wasEdited ? "Edited and sent" : "Sent";
  const timestamp = new Date().toLocaleString("en-US", {
    timeZone: "Pacific/Honolulu",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  await slack.chat.update({
    channel,
    ts: messageTs,
    text: `Reply to ${guestName} — ${action} by ${approverName}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Reply to ${guestName}:*\n${sentText}`,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `${action} by *${approverName}* at ${timestamp} (Hawaii)`,
          },
        ],
      },
    ],
  });
}

export async function postPlainDraft(
  threadTs: string,
  draft: string,
  guestName: string,
): Promise<void> {
  if (!slack || !channel) return;

  await slack.chat.postMessage({
    channel,
    thread_ts: threadTs,
    text: `*Suggested reply to ${guestName}:*\n${draft}\n\n_No conversation ID available — reply must be sent manually._`,
  });
}

export async function openEditModal(
  triggerId: string,
  draftId: string,
  currentText: string,
  guestName: string,
): Promise<void> {
  if (!slack) return;

  await slack.views.open({
    trigger_id: triggerId,
    view: {
      type: "modal",
      callback_id: "edit_draft_modal",
      private_metadata: JSON.stringify({ draftId }),
      title: { type: "plain_text", text: "Edit Reply" },
      submit: { type: "plain_text", text: "Send" },
      close: { type: "plain_text", text: "Cancel" },
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `Editing reply to *${guestName}*`,
          },
        },
        {
          type: "input",
          block_id: "draft_input",
          label: { type: "plain_text", text: "Message" },
          element: {
            type: "plain_text_input",
            action_id: "draft_text",
            multiline: true,
            initial_value: currentText,
          },
        },
      ],
    },
  });
}
