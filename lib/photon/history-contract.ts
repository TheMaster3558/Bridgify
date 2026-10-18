export type ProjectChatMessage = {
  id: string;
  direction: "inbound" | "outbound";
  sender: "client" | "agent" | "unknown";
  text: string | null;
  sentAt: string;
  editedAt: string | null;
  deleted: boolean;
  delivery: "read" | "delivered" | "sent" | "pending" | "failed" | null;
  attachments: { name: string; mimeType: string }[];
};
export type ProjectChatHistory = {
  projectName: string;
  timezone: string;
  connected: boolean;
  connectionKey: string | null;
  clientName: string | null;
  agentAddress: string | null;
  messages: ProjectChatMessage[];
  nextCursor: string | null;
  fetchedAt: string;
};

export type OwnerMessageResult = {
  state: "sent" | "failed" | "unknown";
  messageId?: string;
};
