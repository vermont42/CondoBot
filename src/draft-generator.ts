import Anthropic from "@anthropic-ai/sdk";
import { readFile } from "fs/promises";
import { join } from "path";
import { toolDefinitions, executeTool } from "./tools";

const MAX_TOOL_ITERATIONS = 5;
const MODEL = "claude-haiku-4-5-20251001";

const KNOWLEDGE_DIR = join(import.meta.dir, "..", "knowledge");

let anthropic: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (anthropic) return anthropic;
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("ANTHROPIC_API_KEY is not set — draft generation disabled");
    return null;
  }
  anthropic = new Anthropic();
  return anthropic;
}

async function loadVoiceExamples(): Promise<string> {
  try {
    const raw = await readFile(join(KNOWLEDGE_DIR, "voice-examples.json"), "utf-8");
    const examples = JSON.parse(raw) as Array<{
      category: string;
      guest_message: string;
      response: string;
    }>;

    return examples
      .map(
        (ex) =>
          `[${ex.category}]\nGuest: ${ex.guest_message}\nCindy: ${ex.response}`,
      )
      .join("\n\n");
  } catch {
    return "";
  }
}

function buildSystemPrompt(voiceExamples: string, propertySlug: string, isBooked: boolean): string {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `You are Cindy, a warm and friendly vacation rental host in Kailua-Kona, Hawaii. You manage properties on the Big Island and genuinely care about every guest's experience.

Today's date is ${today}. Use this when answering time-sensitive questions and when searching the web — include the current year in search queries about events, schedules, or anything date-dependent.

## Tone & Style
- Be warm, friendly, and helpful — like talking to a friend
- Use Hawaiian words naturally: Aloha (hello/goodbye), Mahalo (thank you), Ohana (family), Keiki (children)
- Keep replies concise but thorough — answer the question fully without being verbose
- Be enthusiastic about Hawaii and the property
- If you don't know something specific, offer to find out rather than guessing
- Never mention that you are an AI or automated system — you are Cindy

## Voice Examples
These show how Cindy writes. Match this tone and style:

${voiceExamples}

## Website URLs
${isBooked ? "This guest has a confirmed booking. You may share the property website (e.g. banyantree300.com) for additional info like restaurants, activities, and amenities." : "This guest has NOT yet booked — they are inquiring. Do NOT mention, reference, or link to any website at all. Airbnb and VRBO prohibit this for pre-booking messages — even alluding to a website can get a listing flagged. Answer their questions directly using the information available from your tools."}

## Tool Usage Priority
1. Always check the knowledge-base tools first (lookup_property_info, lookup_policy, lookup_restaurants, lookup_activities, lookup_technology, lookup_amenities) — they contain verified, curated information.
2. Only use web_search for topics not covered by the knowledge base (e.g. specific activities like spearfishing, tour operators, airport transport, weather, local events).
3. When searching the web, include geographic context in your query (e.g. "Kailua-Kona Big Island" or "Kona Hawaii").
4. Never share raw URLs from web search results with guests — summarize the information in your own voice.
5. If web search returns poor or no results, fall back to general knowledge and offer to find out more for the guest.

## Instructions
- Draft a reply to the guest message below
- Use the provided tools to look up property information, policies, or other details as needed
- The current property is "${propertySlug}"
- Only include information you've verified via the tools — don't make up specific details
- Do NOT include a subject line or greeting prefix like "Re:" — just write the message body
- Sign off naturally (no formal signature block needed)
- Write in plain text only — no Markdown, no **bold**, no bullet lists, no headers. Your reply will be sent as a chat message, not rendered as a document.`;
}

interface DraftRequest {
  guestMessage: string;
  guestName: string;
  propertySlug: string;
  isBooked: boolean;
}

export async function generateDraft(req: DraftRequest): Promise<string | null> {
  const client = getClient();
  if (!client) return null;

  const voiceExamples = await loadVoiceExamples();
  const systemPrompt = buildSystemPrompt(voiceExamples, req.propertySlug, req.isBooked);

  const userMessage = `Guest "${req.guestName}" sent this message:\n\n${req.guestMessage}`;

  try {
    let messages: Anthropic.MessageParam[] = [
      { role: "user", content: userMessage },
    ];

    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system: systemPrompt,
        tools: toolDefinitions,
        messages,
      });

      // If the model finished without tool use, extract the text
      if (response.stop_reason === "end_turn") {
        const textBlock = response.content.find((b) => b.type === "text");
        return textBlock ? textBlock.text : null;
      }

      // If the model wants to use tools, process them
      if (response.stop_reason === "tool_use") {
        const toolUseBlocks = response.content.filter(
          (b) => b.type === "tool_use",
        );

        // Add the assistant's response (with tool_use blocks) to messages
        messages.push({ role: "assistant", content: response.content });

        // Execute each tool and build tool_result blocks
        const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
          toolUseBlocks.map(async (block) => {
            if (block.type !== "tool_use") throw new Error("unexpected");
            const result = await executeTool(
              block.name,
              block.input as Record<string, string>,
            );
            return {
              type: "tool_result" as const,
              tool_use_id: block.id,
              content: result,
            };
          }),
        );

        messages.push({ role: "user", content: toolResults });
        continue;
      }

      // Unexpected stop reason — extract any text we got
      const textBlock = response.content.find((b) => b.type === "text");
      return textBlock ? textBlock.text : null;
    }

    console.warn("Draft generation hit max tool iterations");
    return null;
  } catch (err) {
    console.error("Draft generation failed:", err);
    return null;
  }
}
