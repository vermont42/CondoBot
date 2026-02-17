export interface PendingDraft {
  id: string;
  reservationId?: string;    // booked guests — POST /v2/reservations/{uuid}/messages
  conversationId?: string;   // inquiries — POST /v2/inquiries/{uuid}/messages
  guestName: string;
  draftText: string;
  slackThreadTs: string;
  slackMessageTs: string;
  createdAt: number;
}

const drafts = new Map<string, PendingDraft>();

export function storeDraft(draft: PendingDraft): void {
  drafts.set(draft.id, draft);
}

export function getDraft(id: string): PendingDraft | undefined {
  return drafts.get(id);
}

export function deleteDraft(id: string): void {
  drafts.delete(id);
}
