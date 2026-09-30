import { bookingLanguage, translator, intlLocale, localizedCompanyText } from "@/lib/booking-locale";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBookingByToken } from "@/lib/booking-data";
import { confirmPayment } from "@/lib/stripe-actions";
import { contrastText } from "@/lib/color";
import { CheckIcon, XIcon } from "@/app/icons";

export default async function ConfirmedPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lang?: string; token?: string; session_id?: string }>;
}) {
  const { slug } = await params;
  const { token, session_id: sessionId, lang: requestedLang } = await searchParams;
  let lang = bookingLanguage(requestedLang);
  let t = translator(lang);

  if (!token) notFound();

  let booking = token ? await getBookingByToken(token) : undefined;

  let paymentConfirmed = false;
  if (!booking && sessionId && token) {
    const result = await confirmPayment(sessionId, token, slug);
    if (result.ok) {
      booking = await getBookingByToken(token);
      paymentConfirmed = true;
    } else {
      // The customer may have just PAID — never show a bare 404 here.
      const messages: Record<string, string> = {
        slot_taken: result.refunded
          ? t("slotRefunded")
          : t("slotRefundFailed"),
        not_paid: t("notPaid"),
        pending:
          t("asyncPayment"),
        rate: t("reloadRate"),
      };
      const message =
        messages[result.error] ??
        t("verifyError");
      const pending = result.error === "pending";
      return (
        <main lang={lang} className="mx-auto max-w-lg p-4 sm:p-6">
          <div className="card overflow-hidden">
            <div style={{ height: "4px", backgroundColor: "var(--color-subtle)" }} />
            <div className="p-8 text-center">
              <h1 className="text-2xl font-semibold text-ink">
                {pending ? t("pending") : t("failed")}
              </h1>
              <p className="mt-4 text-sm text-muted">{message}</p>
              <Link href={`/embed/${slug}?lang=${lang}`} className="mt-6 inline-block text-sm text-muted underline underline-offset-4 hover:text-ink">
                {t("back")}
              </Link>
            </div>
          </div>
        </main>
      );
    }
  }

  if (!booking) notFound();
  lang = bookingLanguage(requestedLang ?? booking.language);
  t = translator(lang);

  const when = new Intl.DateTimeFormat(intlLocale[lang], {
    timeZone: booking.timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(booking.startAt);

  const cancelled = booking.status === "cancelled";

  return (
    <main lang={lang}
      className="mx-auto max-w-lg p-4 sm:p-6"
      style={{ ["--brand" as string]: booking.primaryColor, ["--brand-text" as string]: contrastText(booking.primaryColor) }}
    >
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
            {cancelled ? (
              <XIcon className="h-6 w-6" strokeWidth={2.5} />
            ) : (
              <CheckIcon className="h-6 w-6" strokeWidth={2.5} />
            )}
          </div>
          <h1 className="text-2xl font-semibold text-ink">
            {cancelled ? t("cancelled") : paymentConfirmed ? t("paid") : t("confirmed")}
          </h1>
          <p className="mt-1 text-sm text-muted">{localizedCompanyText(booking.welcomeText, lang, booking.companyName)}</p>
          <p className="mt-2 text-ink first-letter:uppercase">{when}</p>
          <p className="text-sm text-muted">
            {booking.companyName} · {booking.partySize} {t("peopleSuffix")}
          </p>
          {!cancelled && booking.email && (
            <p className="mt-4 text-sm text-muted">{t("emailSent")}</p>
          )}
        </div>
      </div>
    </main>
  );
}
