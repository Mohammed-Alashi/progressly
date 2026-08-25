import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getCurrentUser } from "@/auth";
import { getDb } from "@/lib/db";
import { sendTestEmail } from "@/lib/email";
import { users } from "@/lib/schema";

export async function POST() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json(
      { error: "Database is not configured." },
      { status: 500 }
    );
  }

  const [user] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, currentUser.id))
    .limit(1);

  if (!user?.email) {
    return NextResponse.json({ error: "User email was not found." }, { status: 404 });
  }

  try {
    await sendTestEmail(user.email);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not send test email." },
      { status: 500 }
    );
  }
}
