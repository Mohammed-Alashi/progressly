import NextAuth, { getServerSession, type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

import { getDb } from "@/lib/db";
import { users } from "@/lib/schema";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID ?? "",
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? "",
    }),
  ],
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },

  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;

      const db = getDb();
      if (!db) return false;

      const [dbUser] = await db
        .insert(users)
        .values({
          email: user.email,
          name: user.name?.trim() || user.email,
          imageUrl: user.image ?? null,
        })
        .onConflictDoUpdate({
          target: users.email,
          set: {
            imageUrl: user.image ?? null,
            updatedAt: new Date(),
          },
        })
        .returning({
          id: users.id,
          name: users.name,
        });

      if (!dbUser) return false;

      user.id = dbUser.id;
      user.name = dbUser.name;
      return true;
    },

    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.name = user.name;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        if (typeof token.userId === "string") {
          session.user.id = token.userId;
        }

        if (typeof token.name === "string") {
          session.user.name = token.name;
        }
      }

      return session;
    },
  },
};

export const authHandler = NextAuth(authOptions);

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  return typeof userId === "string" ? { id: userId } : null;
}