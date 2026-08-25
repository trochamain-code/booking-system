import { requireApiKey } from "@/lib/api-auth";
import { getCompanyBySlug, getAvailability, getAvailableDates } from "@/lib/booking-data";
import { isDateStr } from "@/lib/validation";

// Read-only availability for external automations (WhatsApp bot).
// Same source of truth as the public widget: reuses getAvailability so a
// booking made on the web is instantly reflected here and vice-versa.
//
//   GET /api/public/availability?slug=<company>&partySize=2&date=2026-07-20
//     -> { slots: [{ time, startAt, resourceId, remaining, capacity, priceCents }] }
//   GET /api/public/availability?slug=<company>&partySize=2            (no date)
//     -> { dates: ["2026-07-15", ...] }   open dates in the next `days` (default 60)
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const denied = requireApiKey(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const slug = (url.searchParams.get("slug") ?? "").trim();
  if (!slug) return Response.json({ error: "missing_slug" }, { status: 400 });

  const partySize = parseInt(url.searchParams.get("partySize") ?? "1", 10);
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 100) {
    return Response.json({ error: "invalid_partySize" }, { status: 400 });
  }

  const company = await getCompanyBySlug(slug);
  if (!company) return Response.json({ error: "company_not_found" }, { status: 404 });

  const date = (url.searchParams.get("date") ?? "").trim();
  if (date) {
    if (!isDateStr(date)) return Response.json({ error: "invalid_date" }, { status: 400 });
    const slots = await getAvailability(company, date, partySize);
    return Response.json({
      slug: company.slug,
      timezone: company.timezone,
      date,
      partySize,
      slots,
    });
  }

  const daysParam = parseInt(url.searchParams.get("days") ?? "60", 10);
  const days = Number.isInteger(daysParam) && daysParam > 0 && daysParam <= 365 ? daysParam : 60;
  const dates = await getAvailableDates(company, partySize, days);
  return Response.json({
    slug: company.slug,
    timezone: company.timezone,
    partySize,
    days,
    dates: Array.from(dates).sort(),
  });
}
