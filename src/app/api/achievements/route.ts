import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";

import { getCurrentUser } from "@/auth";
import { getDb } from "@/lib/db";
import { achievements } from "@/lib/schema";

const allowedCategories = [
  "project",
  "learning",
  "work",
  "university",
  "other",
];

function normalizeCategory(value: unknown) {
  return typeof value === "string" && allowedCategories.includes(value)
    ? value
    : "project";
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = getDb();

  if (!db) {
    return NextResponse.json({ achievements: [] });
  }

  const data = await db
    .select()
    .from(achievements)
    .where(eq(achievements.userId, user.id))
    .orderBy(desc(achievements.achievedAt));

  return NextResponse.json({ achievements: data });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = getDb();

  if (!db) {
    return NextResponse.json(
      { error: "Database is not configured." },
      { status: 500 }
    );
  }

  const body = await request.json();

  if (!body.title || typeof body.title !== "string") {
    return NextResponse.json(
      { error: "Achievement title is required." },
      { status: 400 }
    );
  }

  const [achievement] = await db
    .insert(achievements)
    .values({
      userId: user.id,
      title: body.title.trim(),
      details:
        typeof body.details === "string" && body.details.trim()
          ? body.details.trim()
          : body.title.trim(),
      category: normalizeCategory(body.category),
      project:
        typeof body.project === "string" && body.project.trim()
          ? body.project.trim()
          : "General",
      evidenceUrl:
        typeof body.evidenceUrl === "string" && body.evidenceUrl.trim()
          ? body.evidenceUrl.trim()
          : null,
      isPublic: body.isPublic === true,
      status: "confirmed",
      achievedAt: body.achievedAt
        ? new Date(body.achievedAt)
        : new Date(),
    })
    .returning();

  return NextResponse.json({ achievement }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = getDb();

  if (!db) {
    return NextResponse.json(
      { error: "Database is not configured." },
      { status: 500 }
    );
  }

  const body = await request.json();

  if (!body.id) {
    return NextResponse.json(
      { error: "Achievement id is required." },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (typeof body.title === "string" && body.title.trim()) {
    updates.title = body.title.trim();
  }

  if (typeof body.details === "string" && body.details.trim()) {
    updates.details = body.details.trim();
  }

  if (typeof body.project === "string" && body.project.trim()) {
    updates.project = body.project.trim();
  }

  if (body.category) {
    updates.category = normalizeCategory(body.category);
  }

  if (typeof body.evidenceUrl === "string") {
    updates.evidenceUrl = body.evidenceUrl.trim() || null;
  }

  if (typeof body.isPublic === "boolean") {
    updates.isPublic = body.isPublic;
  }

  if (body.achievedAt) {
    updates.achievedAt = new Date(body.achievedAt);
  }

  const [achievement] = await db
    .update(achievements)
    .set(updates)
    .where(and(eq(achievements.id, body.id), eq(achievements.userId, user.id)))
    .returning();

  if (!achievement) {
    return NextResponse.json(
      { error: "Achievement not found." },
      { status: 404 }
    );
  }

  return NextResponse.json({ achievement });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = getDb();

  if (!db) {
    return NextResponse.json(
      { error: "Database is not configured." },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { error: "Achievement id is required." },
      { status: 400 }
    );
  }

  await db
    .delete(achievements)
    .where(and(eq(achievements.id, id), eq(achievements.userId, user.id)));

  return NextResponse.json({ success: true });
}
