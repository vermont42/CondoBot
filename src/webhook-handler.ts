import type { Context } from "hono";

export async function handleWebhook(c: Context) {
  let payload;
  try {
    payload = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  console.log("Webhook received:", JSON.stringify(payload, null, 2));
  return c.json({ status: "received" });
}
