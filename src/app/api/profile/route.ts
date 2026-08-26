import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getCurrentUser } from "@/auth";
import { getDb } from "@/lib/db";
import { users } from "@/lib/schema";

export async function GET() {
  const currentUser = await getCurrentUser();
  const db = getDb();

  if (!currentUser || !db) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const [user] = await db
    .select({
      name: users.name,
      email: users.email,
      imageUrl: users.imageUrl,
    })
    .from(users)
    .where(eq(users.id, currentUser.id))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  return NextResponse.json({ user });
}

export async function PATCH(request: Request) {
  const currentUser = await getCurrentUser();
  const db = getDb();

  if (!currentUser || !db) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";

  if (name.length < 2 || name.length > 40) {
    return NextResponse.json(
      { error: "Name must be between 2 and 40 characters." },
      { status: 400 }
    );
  }

  const [user] = await db
    .update(users)
    .set({
      name,
      updatedAt: new Date(),
    })
    .where(eq(users.id, currentUser.id))
    .returning({
      name: users.name,
      email: users.email,
      imageUrl: users.imageUrl,
    });

  return NextResponse.json({ user });
}