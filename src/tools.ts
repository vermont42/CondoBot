import { readFile } from "fs/promises";
import { join } from "path";
import type Anthropic from "@anthropic-ai/sdk";

const KNOWLEDGE_DIR = join(import.meta.dir, "..", "knowledge");

// Tool definitions for the Anthropic API
export const toolDefinitions: Anthropic.Tool[] = [
  {
    name: "lookup_property_info",
    description:
      "Look up detailed information about a vacation rental property, including amenities, check-in/out times, parking, Wi-Fi, beach equipment, and more.",
    input_schema: {
      type: "object" as const,
      properties: {
        property_slug: {
          type: "string",
          description: 'The property identifier, e.g. "banyan-tree-300"',
        },
      },
      required: ["property_slug"],
    },
  },
  {
    name: "lookup_policy",
    description:
      "Look up house rules and policies including cancellation, pets, noise, checkout, smoking, and damages.",
    input_schema: {
      type: "object" as const,
      properties: {
        property_slug: {
          type: "string",
          description: 'The property identifier, e.g. "banyan-tree-300"',
        },
      },
      required: ["property_slug"],
    },
  },
  {
    name: "lookup_restaurants",
    description: "Look up restaurant recommendations near the property.",
    input_schema: {
      type: "object" as const,
      properties: {
        property_slug: {
          type: "string",
          description: 'The property identifier, e.g. "banyan-tree-300"',
        },
      },
      required: ["property_slug"],
    },
  },
  {
    name: "lookup_activities",
    description: "Look up recommended activities and things to do near the property.",
    input_schema: {
      type: "object" as const,
      properties: {
        property_slug: {
          type: "string",
          description: 'The property identifier, e.g. "banyan-tree-300"',
        },
      },
      required: ["property_slug"],
    },
  },
  {
    name: "lookup_technology",
    description: "Look up technology information for the property (Wi-Fi, smart TVs, etc.).",
    input_schema: {
      type: "object" as const,
      properties: {
        property_slug: {
          type: "string",
          description: 'The property identifier, e.g. "banyan-tree-300"',
        },
      },
      required: ["property_slug"],
    },
  },
];

// Execute a tool call and return the result string
export async function executeTool(
  name: string,
  input: Record<string, string>,
): Promise<string> {
  const slug = input.property_slug ?? "banyan-tree-300";

  switch (name) {
    case "lookup_property_info": {
      const path = join(KNOWLEDGE_DIR, "properties", `${slug}.md`);
      try {
        return await readFile(path, "utf-8");
      } catch {
        return `No property information found for "${slug}".`;
      }
    }

    case "lookup_policy": {
      const path = join(KNOWLEDGE_DIR, "policies.md");
      try {
        return await readFile(path, "utf-8");
      } catch {
        return "Policy information is not yet available.";
      }
    }

    case "lookup_restaurants":
      return "Restaurant guide not yet available. Suggest the guest check our website at banyantree300.com for restaurant recommendations.";

    case "lookup_activities":
      return "Activity guide not yet available. Suggest the guest check our website at banyantree300.com for activity ideas.";

    case "lookup_technology":
      return "Technology guide not yet available. The property has 1 gigabit Wi-Fi and 3 smart TVs. Wi-Fi credentials are on the welcome card on the kitchen counter.";

    default:
      return `Unknown tool: ${name}`;
  }
}
