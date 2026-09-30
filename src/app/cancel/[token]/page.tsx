import { bookingLanguage, translator, intlLocale, localizedCompanyText } from "@/lib/booking-locale";
import { notFound } from "next/navigation";
import { getBookingByToken } from "@/lib/booking-data";
import { cancelBooking } from "@/lib/booking-actions";
import { contrastText } from "@/lib/color";
import { SubmitButton } from "@/app/submit-button";
import { XIcon, CalendarIcon } from "@/app/icons";
import { computeRefundPercent } from "@/lib/cancellation-policy";

export default async function CancelPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ lang?: string; done?: string; error?: string }>;
}) {
  const { token } = await params;
  const { error, lang: requestedLang } = await searchParams;
  const booking = await getBookingByToken(token);
  if (!booking) notFound();
  const lang = bookingLanguage(requestedLang ?? booking.language);
  const t = translator(lang);

  const when = new Intl.DateTimeFormat(intlLocale[lang], {
    timeZone: booking.timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(booking.startAt);

  // Trust only the DB status — a hand-typed ?done=1 must not claim a booking
  // was cancelled when it wasn't (e.g. after a rate-limited submit).
  const cancelled = booking.status === "cancelled";
  const paid = Boolean(booking.stripePaymentIntentId && booking.amountCents);
  const refundCents = booking.cancellationRefundCents ?? (cancelled ? null :
    Math.round((booking.amountCents ?? 0) * await computeRefundPercent(booking, booking.companyId) / 100));
  const refundAmount = new Intl.NumberFormat(intlLocale[lang], { style: "currency", currency: "EUR" })
    .format((refundCents ?? 0) / 100);

  return (
    <main lang={lang} className="mx-auto max-w-lg p-4 sm:p-6" style={{ ["--brand" as string]: booking.primaryColor, ["--brand-text" as string]: contrastText(booking.primaryColor) }}>
      <div className="card overflow-hidden">
        <div style={{ height: "4px", backgroundColor: cancelled ? "var(--color-subtle)" : "var(--brand)" }} />

        <div className="p-8 text-center">
          {booking.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={booking.logoUrl} alt={booking.companyName} className="mx-auto mb-4 h-12 w-12 rounded-xl object-cover" />
          ) : (
            <div
              className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl text-sm font-bold text-white"
              style={{ backgroundColor: cancelled ? "var(--color-subtle)" : "var(--brand)" }}
              aria-hidden
            >
              {booking.companyName.slice(0, 1).toUpperCase()}
            </div>
          )}

          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full text-white"
            style={{ backgroundColor: cancelled ? "var(--color-subtle)" : "var(--brand)" }}
          >
            {cancelled ? <XIcon className="h-6 w-6" strokeWidth={2.5} /> : <CalendarIcon className="h-6 w-6" />}
          </div>
          <h1 className="text-2xl font-semibold text-ink">
            {cancelled ? t("cancelled") : t("cancelQuestion")}
          </h1>
          <p className="mt-1 text-sm text-muted">{localizedCompanyText(booking.welcomeText, lang, booking.companyName)}</p>
          <p className="mt-2 text-ink first-letter:uppercase">{when}</p>
          <p className="text-sm text-muted">
            {booking.companyName} · {booking.partySize} {t("peopleSuffix")}
          </p>

          {!cancelled && error === "rate" && (
            <p role="alert" className="mt-4 rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">
              {t("cancelRate")}
            </p>
          )}

          {!cancelled && error === "refund" && (
            <p role="alert" className="mt-4 rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">
              {t("cancelError")}
            </p>
          )}

          {paid && refundCents !== null && (
            <p className="mt-4 text-sm text-muted">
              {cancelled && booking.stripeRefundId
                ? t("refundRequested", { amount: refundAmount })
                : refundCents > 0
                  ? t("refundQuote", { amount: refundAmount })
                  : t("noRefund")}
            </p>
          )}

          {cancelled ? (
            <p className="mt-6 text-sm text-muted">{t("cancelDone")}</p>
          ) : (
            <form action={cancelBooking} className="mt-6">
              <input type="hidden" name="lang" value={lang} />
              <input type="hidden" name="token" value={token} />
              <SubmitButton className="btn btn-danger" pendingText={t("cancelling")} >
                {paid && (refundCents ?? 0) > 0 ? t("cancelRefund") : t("cancelYes")}
              </SubmitButton>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
