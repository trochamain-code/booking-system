// Inclusive last reservation date, interpreted in the company's local timezone.
// Companies without an explicit cutoff retain their normal booking window.
export function lastBookingDate(slug: string): string | undefined {
  return slug === "la-madriguera-de-mai" ? "2027-01-01" : undefined;
}

export function isBookingDateAllowed(slug: string, date: string): boolean {
  const lastDate = lastBookingDate(slug);
  return lastDate === undefined || date <= lastDate;
}
