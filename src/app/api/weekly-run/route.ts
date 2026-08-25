import { NextResponse } from "next/server";
import { and, eq, gte } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { achievements, posts } from "@/lib/schema";
import { writeWeeklyPost } from "@/lib/groq";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");

  if (
    !process.env.CRON_SECRET ||
    auth !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const db = getDb();

    if (!db) {
      return NextResponse.json(
        { error: "DATABASE_URL is missing." },
        { status: 500 }
      );
    }

    const since = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000
    );

    const weeklyAchievements = await db
      .select()
      .from(achievements)
      .where(
        and(
          eq(achievements.status, "confirmed"),
          gte(achievements.createdAt, since)
        )
      );

    if (weeklyAchievements.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No confirmed achievements this week.",
      });
    }

    const content = await writeWeeklyPost(weeklyAchievements);

    await db.insert(posts).values({
      content,
      status: "draft_ready",
    });

    return NextResponse.json({
      ok: true,
      message: "Weekly post draft created.",
      content,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected error",
      },
      { status: 500 }
    );
  }
}