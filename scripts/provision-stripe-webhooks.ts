// One-off/ops: create the fulfillment webhook in the Stripe account of every
// company that has keys saved but no webhook yet (e.g. keys saved before the
// webhook feature existed). Requires DATABASE_URL and the public APP_URL.
//
//   DATABASE_URL=... APP_URL=https://... pnpm exec tsx scripts/provision-stripe-webhooks.ts
import { and, eq, isNull, isNotNull } from "drizzle-orm";
import { db } from "../src/lib/db";
import { companies } from "../src/lib/schema";
import { createCompanyWebhook } from "../src/lib/stripe";

async function main() {
  const rows = await db
    .select({ id: companies.id, slug: companies.slug, name: companies.name, key: companies.stripeSecretKey })
    .from(companies)
    .where(and(isNotNull(companies.stripeSecretKey), isNull(companies.stripeWebhookSecret)));

  if (rows.length === 0) console.log("nothing to provision");

  for (const c of rows) {
    try {
      const { endpointId, secret } = await createCompanyWebhook(c.key!, c.id, c.name);
      await db
        .update(companies)
        .set({ stripeWebhookSecret: secret, stripeWebhookEndpointId: endpointId })
        .where(eq(companies.id, c.id));
      console.log(`provisioned ${c.slug}: ${endpointId}`);
    } catch (err) {
      console.error(`FAILED ${c.slug}:`, err instanceof Error ? err.message : err);
    }
  }
  process.exit(0);
}

main();
