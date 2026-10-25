import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authenticateAccount } from "@nexus/auth";
import { database, repository } from "@nexus/database";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/sign-in" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: (credentials) =>
        authenticateAccount(
          repository,
          credentials.email,
          credentials.password,
        ),
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.sessionVersion = user.sessionVersion ?? 0;
      if (!token.sub) return null;
      const account = await database.user.findUnique({
        where: { id: token.sub },
        select: { sessionVersion: true },
      });
      if (!account || account.sessionVersion !== token.sessionVersion)
        return null;
      return token;
    },
    session({ session, token }) {
      if (!token.sub) throw new Error("Session subject is missing.");
      session.user.id = token.sub;
      return session;
    },
  },
});
