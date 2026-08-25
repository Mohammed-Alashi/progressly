import { NextResponse } from "next/server";
import { askGroq } from "@/lib/groq";
import type { ChatMessage } from "@/lib/types";
import { getDb } from "@/lib/db";
import {
  achievements,
  conversations,
  messages as savedMessages,
} from "@/lib/schema";

export async function POST(request: Request) {
  try {
    const { messages, conversationId } = (await request.json()) as {
      messages: ChatMessage[];
      conversationId: string;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "A message is required." },
        { status: 400 }
      );
    }

    const answer = await askGroq(messages.slice(-12));
    const lastUserMessage = messages.at(-1);

    const newAchievements: {
    title: string;
    details: string;
    project: string;
    status: "confirmed";
  }[] = [];
 

    const db = getDb();

    if (db && conversationId) {
      await db
        .insert(conversations)
        .values({ id: conversationId })
        .onConflictDoNothing();

      if (lastUserMessage) {
        await db.insert(savedMessages).values({
          conversationId,
          role: "user",
          content: lastUserMessage.content,
        });
      }

      await db.insert(savedMessages).values({
        conversationId,
        role: "assistant",
        content: answer,
      });

      if (newAchievements.length > 0) {
        await db.insert(achievements).values(
          newAchievements.map((item) => ({
            project: item.project,
            title: item.title,
            details: item.details,
            status: item.status,
          }))
        );
      }
    }

    return NextResponse.json({
      answer,
      achievements: newAchievements,
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