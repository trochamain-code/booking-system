import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "./db";
import { companies } from "./schema";
import { requireRole } from "./session";
import type { Company } from "./schema";

/**
 * Owner/staff guard that also loads the company. If the session is valid but the
 * company no longer exists (e.g. it was deleted / re-seeded), the session is stale —
 * send the user back to /login to re-authenticate instead of crashing.
 */
export async function requireCompany(): Promise<{ companyId: string; company: Company }> {
  const session = await requireRole("owner", "staff");
  if (!session.companyId) redirect("/login");
  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, session.companyId))
    .limit(1);
  if (!company) redirect("/login");
  return { companyId: company.id, company };
}
