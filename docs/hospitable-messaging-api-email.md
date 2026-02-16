# Hospitable Messaging API Access — Support Email

**From:** Smarty from Hospitable.com
**To:** Amanda
**Date:** February 15, 2026

---

Hi Amanda,

Great news! The Messaging API is available through our Public API, and since you already have a Personal Access Token, you should be able to access it.

For the messaging functionality you need:

**API Access:** Your existing Personal Access Token should work for the Messaging API endpoints. Make sure your token has the appropriate read/write permissions for your integration needs.

**Webhook Setup:** You can set up message.created webhooks yourself:

1. Go to Apps in your account
2. Click Webhooks under Tools
3. Click +Add new
4. Provide your webhook URL and select Messages
5. Click Save

**Webhook Types:** Reservations, Properties, Messages (Beta), Reviews

The message webhooks trigger when new messages are created and include a `sent_reference_id` for tracking messages sent via the API. Note that we don't send messages older than 12 hours via webhook — use the messages API for historical data.

If you encounter any issues accessing the messaging endpoints with your current token, you can create a new one with specific permissions in the API access section of your Apps page.

Does this help you get started with your integration? Let me know if you run into any issues with the setup!
