import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { encodeSession, decodeSession, type Role, type SessionData } from "./session-token";

export type { Role, SessionData } from "./session-token";

const COOKIE = "session";
const MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7 days

export async function createSession(data: Omit<SessionData, "exp">): Promise<void> {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SEC;
  (await cookies()).set(COOKIE, encodeSession({ ...data, exp }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SEC,
  });
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export async function getSession(): Promise<SessionData | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  return token ? decodeSession(token) : null;
}

/** Redirect to /login unless a session with one of the allowed roles exists. */
export async function requireRole(...allowed: Role[]): Promise<SessionData> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (allowed.length && !allowed.includes(session.role)) redirect("/login");
  return session;
}
