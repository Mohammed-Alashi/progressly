import { NextResponse } from "next/server";
import { and, eq, gte } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { sendWeeklyDraftReadyEmail } from "@/lib/email";
import { writeLinkedInPost } from "@/lib/groq";
import { achievements, posts, users } from "@/lib/schema";

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json({ error: "DATABASE_URL is missing." }, { status: 500 });
  }

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const summary = { processedUsers: 0, createdDrafts: 0, sentEmails: 0, errors: [] as string[] };

  try {
    const activeUsers = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .innerJoin(achievements, eq(achievements.userId, users.id))
      .where(and(eq(achievements.status, "confirmed"), gte(achievements.achievedAt, since)))
      .groupBy(users.id, users.email);

    for (const user of activeUsers) {
      summary.processedUsers += 1;

      try {
        const [existingDraft] = await db
          .select({ id: posts.id })
          .from(posts)
          .where(and(eq(posts.userId, user.id), eq(posts.postType, "weekly"), gte(posts.createdAt, since)))
          .limit(1);
        if (existingDraft) continue;

        const weeklyAchievements = await db
          .select({ title: achievements.title, details: achievements.details, project: achievements.project })
          .from(achievements)
          .where(and(eq(achievements.userId, user.id), eq(achievements.status, "confirmed"), gte(achievements.achievedAt, since)));
        const content = await writeLinkedInPost(weeklyAchievements, "weekly");

        await db.insert(posts).values({
          userId: user.id,
          title: "Weekly LinkedIn post",
          content,
          postType: "weekly",
          status: "draft",
        });
        summary.createdDrafts += 1;

        try {
          await sendWeeklyDraftReadyEmail(user.email);
          summary.sentEmails += 1;
        } catch (error) {
          summary.errors.push(`${user.email}: email failed — ${error instanceof Error ? error.message : "Unknown error"}`);
        }
      } catch (error) {
        summary.errors.push(`${user.email}: draft failed — ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    return NextResponse.json(
      { ok: false, ...summary, error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
