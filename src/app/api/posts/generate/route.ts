import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";

import { getCurrentUser } from "@/auth";
import { getDb } from "@/lib/db";
import { achievements, users } from "@/lib/schema";
import { writeLinkedInPost } from "@/lib/groq";

const allowedPostTypes = ["one_off", "weekly", "monthly"] as const;

type PostType = (typeof allowedPostTypes)[number];

export async function POST(request: Request) {
  const user = await getCurrentUser();
  const body = await request.json();
  const achievementIds = body.achievementIds;

  const postType: PostType = allowedPostTypes.includes(body.postType)
    ? body.postType
    : "one_off";

  const revisionRequest =
    typeof body.revisionRequest === "string"
      ? body.revisionRequest.trim().slice(0, 1000)
      : "";

  if (!Array.isArray(achievementIds) || achievementIds.length === 0) {
    return NextResponse.json(
      { error: "Select at least one achievement first." },
      { status: 400 }
    );
  }

  let selectedAchievements: {
    id: string;
    title: string;
    details: string;
    project: string;
  }[];
  let preferences: {
    tone: "professional" | "friendly" | "concise";
    length: "short" | "normal";
  } = { tone: "professional", length: "normal" };

  if (user) {
    const db = getDb();

    if (!db) {
      return NextResponse.json(
        { error: "Database is not configured." },
        { status: 500 }
      );
    }

    const [userSettings] = await db
      .select({ postTone: users.postTone, postLength: users.postLength })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    if (userSettings?.postTone === "friendly" || userSettings?.postTone === "concise") {
      preferences.tone = userSettings.postTone;
    }
    if (userSettings?.postLength === "short") {
      preferences.length = userSettings.postLength;
    }

    selectedAchievements = await db
      .select({
        id: achievements.id,
        title: achievements.title,
        details: achievements.details,
        project: achievements.project,
      })
      .from(achievements)
      .where(
        and(
          inArray(achievements.id, achievementIds),
          eq(achievements.userId, user.id)
        )
      );
  } else {
    const guestAchievements: unknown[] = Array.isArray(body.guestAchievements)
      ? body.guestAchievements
      : [];

    selectedAchievements = guestAchievements
      .filter(
        (item: unknown): item is Record<string, unknown> =>
          typeof item === "object" && item !== null
      )
      .filter(
        (item) =>
          typeof item.id === "string" &&
          achievementIds.includes(item.id) &&
          typeof item.title === "string" &&
          item.title.trim().length > 0
      )
      .slice(0, 50)
      .map((item) => ({
        id: item.id as string,
        title: (item.title as string).trim().slice(0, 500),
        details:
          typeof item.details === "string" && item.details.trim()
            ? item.details.trim().slice(0, 2000)
            : (item.title as string).trim().slice(0, 500),
        project:
          typeof item.project === "string" && item.project.trim()
            ? item.project.trim().slice(0, 500)
            : "General",
      }));
  }

  if (selectedAchievements.length === 0) {
    return NextResponse.json(
      { error: "No matching achievements were found." },
      { status: 404 }
    );
  }

  try {
    const content = await writeLinkedInPost(
      selectedAchievements,
      postType,
      revisionRequest,
      preferences
    );

    // لا نحفظ هنا. هذا Preview فقط حتى يوافق المستخدم.
    return NextResponse.json({
      content,
      postType,
      achievementIds,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not generate post.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
