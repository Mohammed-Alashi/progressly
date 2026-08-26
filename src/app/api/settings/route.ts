import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getCurrentUser } from "@/auth";
import { getDb } from "@/lib/db";
import { users } from "@/lib/schema";

const allowedTones = ["professional", "friendly", "concise"] as const;
const allowedLengths = ["short", "normal"] as const;

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json({ error: "Database is not configured." }, { status: 500 });
  }

  const [settings] = await db
    .select({
      weeklyReminderEnabled: users.weeklyReminderEnabled,
      postTone: users.postTone,
      postLength: users.postLength,
    })
    .from(users)
    .where(eq(users.id, currentUser.id))
    .limit(1);

  if (!settings) {
    return NextResponse.json({ error: "User settings were not found." }, { status: 404 });
  }

  return NextResponse.json({ settings });
}

export async function PATCH(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json({ error: "Database is not configured." }, { status: 500 });
  }

  const body = await request.json();
  const updates: {
    weeklyReminderEnabled?: boolean;
    postTone?: (typeof allowedTones)[number];
    postLength?: (typeof allowedLengths)[number];
    updatedAt: Date;
  } = { updatedAt: new Date() };

  if ("weeklyReminderEnabled" in body) {
    if (typeof body.weeklyReminderEnabled !== "boolean") {
      return NextResponse.json({ error: "weeklyReminderEnabled must be a boolean." }, { status: 400 });
    }
    updates.weeklyReminderEnabled = body.weeklyReminderEnabled;
  }

  if ("postTone" in body) {
    if (!allowedTones.includes(body.postTone)) {
      return NextResponse.json({ error: "Invalid post tone." }, { status: 400 });
    }
    updates.postTone = body.postTone;
  }

  if ("postLength" in body) {
    if (!allowedLengths.includes(body.postLength)) {
      return NextResponse.json({ error: "Invalid post length." }, { status: 400 });
    }
    updates.postLength = body.postLength;
  }

  if (Object.keys(updates).length === 1) {
    return NextResponse.json({ error: "No settings were provided." }, { status: 400 });
  }

  const [settings] = await db
    .update(users)
    .set(updates)
    .where(eq(users.id, currentUser.id))
    .returning({
      weeklyReminderEnabled: users.weeklyReminderEnabled,
      postTone: users.postTone,
      postLength: users.postLength,
    });

  if (!settings) {
    return NextResponse.json({ error: "User settings were not found." }, { status: 404 });
  }

  return NextResponse.json({ settings });
}
