const HOSPITABLE_API_TOKEN = process.env.HOSPITABLE_API_TOKEN;
const BASE_URL = "https://public.api.hospitable.com/v2";

// Cindy's Airbnb co-host user ID — sends messages as Cindy instead of Amanda
const CINDY_SENDER_ID = "50593026";

if (!HOSPITABLE_API_TOKEN) {
  console.warn("HOSPITABLE_API_TOKEN is not set — message sending disabled");
}

export interface HospitableMessage {
  body: string;
  sender_type: "host" | "guest";
  created_at: string;
  source: string;
}

interface HospitableMessagesResponse {
  data: HospitableMessage[];
}

export async function getReservationMessages(
  reservationId: string,
): Promise<HospitableMessage[] | null> {
  if (!HOSPITABLE_API_TOKEN) {
    console.warn("HOSPITABLE_API_TOKEN not set — cannot fetch messages");
    return null;
  }

  const url = `${BASE_URL}/reservations/${reservationId}/messages`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${HOSPITABLE_API_TOKEN}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      console.warn(`Failed to fetch reservation messages (${res.status}): ${text}`);
      return null;
    }

    const json = (await res.json()) as HospitableMessagesResponse;
    return json.data;
  } catch (err) {
    console.warn("Error fetching reservation messages:", err);
    return null;
  }
}

export async function sendMessageToGuest(
  opts: { reservationId?: string; conversationId?: string },
  messageBody: string,
): Promise<void> {
  if (!HOSPITABLE_API_TOKEN) {
    throw new Error("HOSPITABLE_API_TOKEN is not configured");
  }

  let url: string;
  if (opts.reservationId) {
    url = `${BASE_URL}/reservations/${opts.reservationId}/messages`;
  } else if (opts.conversationId) {
    url = `${BASE_URL}/inquiries/${opts.conversationId}/messages`;
  } else {
    throw new Error("Neither reservationId nor conversationId provided");
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${HOSPITABLE_API_TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ body: messageBody, sender_id: CINDY_SENDER_ID }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Hospitable API error ${res.status}: ${text}`);
  }
}
