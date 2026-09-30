import { translator } from "./booking-locale";
type RefundRule = {
  ruleType: "after_booking" | "before_event";
  thresholdMinutes: number;
  refundPercent: number;
};

function duration(minutes: number, language: unknown): string {
  const t = translator(language);
  if (minutes > 0 && minutes % 1440 === 0) {
    const days = minutes / 1440;
    return `${days} ${t(days === 1 ? "day" : "days")}`;
  }
  if (minutes > 0 && minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} ${t(hours === 1 ? "hour" : "hours")}`;
  }
  return `${minutes} ${t(minutes === 1 ? "minute" : "minutes")}`;
}
export function refundPolicyText(rules: readonly RefundRule[], language: unknown = "es"): string[] {
  const t = translator(language);
  const afterBooking = rules.filter(r => r.ruleType === "after_booking").sort((a, b) => a.thresholdMinutes - b.thresholdMinutes);
  const beforeEvent = rules.filter(r => r.ruleType === "before_event").sort((a, b) => b.thresholdMinutes - a.thresholdMinutes);
  if (!rules.length) return [t("policyNone")];
  return [t("policyOrder"),
    ...afterBooking.map(r => t("policyAfter", { duration: duration(r.thresholdMinutes, language), percent: r.refundPercent })),
    ...beforeEvent.map(r => t("policyBefore", { duration: duration(r.thresholdMinutes, language), percent: r.refundPercent })),
    t("policyOtherwise")];
}
