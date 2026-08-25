import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";

import { getCurrentUser } from "@/auth";
import { getDb } from "@/lib/db";
import { posts } from "@/lib/schema";

const allowedPostTypes = ["one_off", "weekly", "monthly"] as const;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = getDb();

  if (!db) {
    return NextResponse.json({ posts: [] });
  }

  const data = await db
    .select()
    .from(posts)
    .where(eq(posts.userId, user.id))
    .orderBy(desc(posts.createdAt));

  return NextResponse.json({ posts: data });
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

  if (!body.content || typeof body.content !== "string") {
    return NextResponse.json(
      { error: "Post content is required." },
      { status: 400 }
    );
  }

  const postType = allowedPostTypes.includes(body.postType)
    ? body.postType
    : "one_off";

  const title =
    postType === "weekly"
      ? "Weekly LinkedIn post"
      : postType === "monthly"
        ? "Monthly LinkedIn post"
        : "LinkedIn post draft";

  const [post] = await db
    .insert(posts)
    .values({
      userId: user.id,
      title,
      content: body.content.trim(),
      postType,
      status: "draft",
    })
    .returning();

  return NextResponse.json({ post }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = getDb();
  if (!db) return NextResponse.json({ error: "Database is not configured." }, { status: 500 });

  const body = await request.json();
  if (typeof body.id !== "string" || typeof body.content !== "string" || !body.content.trim()) {
    return NextResponse.json({ error: "Post id and content are required." }, { status: 400 });
  }

  const [post] = await db
    .update(posts)
    .set({ content: body.content.trim(), updatedAt: new Date() })
    .where(and(eq(posts.id, body.id), eq(posts.userId, user.id)))
    .returning();

  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });
  return NextResponse.json({ post });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Post id is required." }, { status: 400 });

  const db = getDb();
  if (!db) return NextResponse.json({ error: "Database is not configured." }, { status: 500 });

  await db.delete(posts).where(and(eq(posts.id, id), eq(posts.userId, user.id)));
  return NextResponse.json({ success: true });
}
