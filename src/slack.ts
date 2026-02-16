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

export async function postDraftReply(threadTs: string, draft: string, guestName: string) {
  if (!slack || !channel) return;

  await slack.chat.postMessage({
    channel,
    thread_ts: threadTs,
    text: `*Suggested reply to ${guestName}:*\n${draft}`,
  });
}
