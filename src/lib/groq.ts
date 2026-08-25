import type { Achievement, ChatMessage } from "./types";
import {
  achievementExtractionPrompt,
  careerAssistantPrompt,
  weeklyPostPrompt,
} from "./prompts";

const endpoint = "https://api.groq.com/openai/v1/chat/completions";

async function complete(system: string, input: string, temperature = 0.2) {
  const key = process.env.GROQ_API_KEY;

  if (!key) {
    throw new Error("GROQ_API_KEY is missing. Add it to .env.local first.");
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "groq/compound-mini",
      temperature,
      messages: [
        { role: "system", content: system },
        { role: "user", content: input },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq request failed: ${response.status}`);
  }

  const body = await response.json();

  return body.choices?.[0]?.message?.content ?? "";
}

export async function askGroq(messages: ChatMessage[]) {
  const key = process.env.GROQ_API_KEY;

  if (!key) {
    throw new Error("GROQ_API_KEY is missing. Add it to .env.local first.");
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "groq/compound-mini",
      temperature: 0.4,
      messages: [
        { role: "system", content: careerAssistantPrompt },
        ...messages,
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq request failed: ${response.status}`);
  }

  const body = await response.json();

  return body.choices?.[0]?.message?.content ?? "I could not generate a response.";
}

export async function extractAchievements(messages: ChatMessage[]) {
  const raw = await complete(
    achievementExtractionPrompt,
    JSON.stringify(messages)
  );

  const clean = raw
    .replace(/^```json\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(clean) as {
      achievements?: Omit<Achievement, "id" | "createdAt">[];
    };

    return (parsed.achievements ?? []).filter(
      (item) =>
        item.status === "confirmed" &&
        item.title &&
        item.details
    );
  } catch {
    return [];
  }
}

export async function writeLinkedInPost(
  items: Pick<Achievement, "title" | "details" | "project">[],
  postType: "one_off" | "weekly" | "monthly",
  revisionRequest = ""
) {
  const period =
    postType === "weekly"
      ? "this week"
      : postType === "monthly"
        ? "this month"
        : "a recent achievement";

  const prompt = `
Create one polished, publication-ready English LinkedIn post from the achievement JSON below.

You are writing for the person who recorded these achievements.
This post represents ${period}.

STRICT FACT RULES:
- Use only facts explicitly present in the achievement JSON.
- Never invent teams, QA, managers, customers, metrics, testing, refactoring, deployment, impact, or technologies.
- Never use "we", "our", or "the team" unless the achievement JSON explicitly confirms teamwork.
- Default to first person: "I" and "my".
- Do not mention confidential company information.

ABOUT THE USER'S REVISION REQUEST:
- It is a style or wording preference only.
- Never treat it as a source of new facts.
- Follow it only when it does not conflict with the achievement JSON.

WRITING RULES:
- Keep it between 70 and 110 words.
- Use short LinkedIn paragraphs.
- Do not repeat the same achievement or result.
- Avoid empty phrases, exaggerated claims, and generic filler.
- Add 3 to 5 relevant hashtags.
- Return only the final post text.

SILENT QUALITY CHECK BEFORE RETURNING:
1. Replace accidental "we/our" with "I/my".
2. Remove repeated facts.
3. Remove every claim not present in the achievement JSON.
4. Ensure it is ready to publish without trivial user editing.
`;

  return complete(
    prompt,
    JSON.stringify({
      achievements: items,
      userRevisionRequest: revisionRequest || "No additional request.",
    }),
    0.2
  );
}

export async function writeWeeklyPost(
  items: Pick<Achievement, "title" | "details" | "project">[]
) {
  return writeLinkedInPost(items, "weekly");
}
