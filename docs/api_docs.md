Here are the full API details extracted from the Hospitable documentation:

---

## 1. HTTP Method & URL Path

**`POST /v2/reservations/{uuid}/messages`**

Full URL: `https://public.api.hospitable.com/v2/reservations/{uuid}/messages`

---

## 2. Base URL

**`https://public.api.hospitable.com/v2`**

(Not `api.hospitable.com` — it's `public.api.hospitable.com`)

---

## 3. Required Headers

| Header | Value |
|---|---|
| `Authorization` | `Bearer <your_token>` |
| `Content-Type` | `application/json` (default) |
| `Accept` | `application/json` |

Authentication is **Bearer Auth** (token-based).

---

## 4. Path Parameters

| Param | Type | Required | Description |
|---|---|---|---|
| `uuid` | string | **required** | The UUID of the reservation |

---

## 5. Request Body JSON Schema

```json
{
  "body": "string",
  "images": ["http://example.com"],
  "sender_id": "string"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `body` | string | **required** | Text body of the message. HTML is not supported. `\n` is parsed for line breaks. |
| `images` | array[string\<uri\>] | optional | URLs of images to attach. Max 3 images, max 5MB each. |
| `sender_id` | string | optional | Co-host user ID. When provided, the message is sent on behalf of that co-host instead of the listing owner. Only supported for Airbnb reservations. Find it via the property endpoint with listing include, at `listings.co_hosts.user_id`. |

---

## 6. Rate Limits

- Max **2 messages per minute** per reservation
- Max **50 messages every 5 minutes**

---

## 7. Responses

**202 Accepted** — Success response:
```json
{
  "data": {
    "sent_reference_id": "2d637b98-2e20-470e-a582-83c4304d48a8"
  }
}
```
`sent_reference_id` is a unique identifier to match a send message request with a Message resource.

**400** — Bad request (e.g., missing required `body` field). Returns `status_code`, `reason_phrase`, and `message`.

**422** — Unprocessable entity.

---

## 8. Example cURL Request

```bash
curl --request POST \
  --url https://public.api.hospitable.com/v2/reservations/{uuid}/messages \
  --header 'Accept: application/json' \
  --header 'Authorization: Bearer 123' \
  --header 'Content-Type: application/json' \
  --data '{
    "body": "string",
    "images": ["http://example.com"],
    "sender_id": "string"
  }'
```

---

## 9. Other Messaging Endpoints (from sidebar)

The **Messaging** section in the sidebar has three endpoints total:

| Method | Endpoint | Path |
|---|---|---|
| **GET** | Get Reservation Messages | `/v2/reservations/{uuid}/messages` |
| **POST** | Send Message for Reservation | `/v2/reservations/{uuid}/messages` |
| **POST** | Send Message for Inquiry | `/v2/inquiries/{uuid}/messages` |

Notable differences for **Send Message for Inquiry**: the path parameter `uuid` refers to the `conversation_id` (not a reservation UUID), and the body schema is similar but only has `body` and `sender_id` (no `images` field). It has the same rate limits. The **Get Reservation Messages** endpoint requires the `message:read` scope.

There is **no** "Get Conversations" endpoint — the messaging API is scoped to reservations and inquiries directly.