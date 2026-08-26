import {
  boolean,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),

  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  imageUrl: text("image_url"),

  headline: text("headline"),
  bio: text("bio"),

  weeklyReminderEnabled: boolean("weekly_reminder_enabled")
    .notNull()
    .default(true),
  postTone: text("post_tone").notNull().default("professional"),
  postLength: text("post_length").notNull().default("normal"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// الجداول القديمة نبقيها الآن حتى لا نحذف بيانات التجربة السابقة.
export const conversations = pgTable("conversations", {
  id: uuid("id").defaultRandom().primaryKey(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),

  conversationId: uuid("conversation_id")
    .references(() => conversations.id)
    .notNull(),

  role: text("role").notNull(),
  content: text("content").notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const achievements = pgTable("achievements", {
  id: uuid("id").defaultRandom().primaryKey(),

  // سنربطه بالمستخدم بعد إضافة Google Sign-in.
  // تركناه اختياريًا الآن حتى لا تتأثر إنجازاتك القديمة.
  userId: uuid("user_id").references(() => users.id),

  title: text("title").notNull(),
  details: text("details").notNull(),

  category: text("category").notNull().default("project"),
  project: text("project").notNull().default("General"),

  evidenceUrl: text("evidence_url"),
  isPublic: boolean("is_public").notNull().default(false),

  status: text("status").notNull().default("confirmed"),

  achievedAt: timestamp("achieved_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const posts = pgTable("posts", {
  id: uuid("id").defaultRandom().primaryKey(),

  // سنربطه بالمستخدم بعد Google Sign-in.
  userId: uuid("user_id").references(() => users.id),

  title: text("title").notNull().default("LinkedIn post"),
  content: text("content").notNull(),

  // one_off | weekly | monthly
  postType: text("post_type").notNull().default("one_off"),

  // draft | pending_approval | approved | published | skipped
  status: text("status").notNull().default("draft"),

  linkedinPostId: text("linkedin_post_id"),
  publishedAt: timestamp("published_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
