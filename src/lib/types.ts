export type Achievement = {
  id: string;
  title: string;
  details: string;
  project: string;
  status: "confirmed" | "pending";
  createdAt: string;
};

export type ChatMessage = { role: "user" | "assistant"; content: string };
