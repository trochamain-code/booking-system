import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

// Liveness/readiness probe for load balancers and container orchestration.
// Returns 200 only when the app can actually reach the database.
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    await db.execute(sql`select 1`);
    return Response.json({ status: "ok" }, { status: 200 });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
