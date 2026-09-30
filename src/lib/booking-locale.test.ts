import { test } from "node:test";
import assert from "node:assert/strict";
import { bookingLanguage, languages, messages, translator, localizedCompanyText } from "./booking-locale";
import { customerEmailContent } from "./customer-email";
import { refundPolicyText } from "./refund-policy-text";

test("unsupported and absent languages fall back to Spanish; regional codes normalize", () => {
  for (const value of [undefined, null, "", "de", {}, ["en"], "__proto__"]) assert.equal(bookingLanguage(value), "es");
  assert.equal(bookingLanguage("FR-fr"), "fr");
  assert.equal(bookingLanguage("en_GB"), "en");
});
for (const language of languages) {
  test(`${language}: complete messages, translated customer emails and refund policy`, () => {
    assert.deepEqual(Object.keys(messages[language]), Object.keys(messages.es));
    const t = translator(language);
    const policies = refundPolicyText([
      { ruleType: "after_booking", thresholdMinutes: 60, refundPercent: 100 },
      { ruleType: "before_event", thresholdMinutes: 1440, refundPercent: 50 },
    ], language);
    const input = { language, customerName: '<Test & Customer>', companyName: 'La Madriguera',
      timezone: 'Europe/Madrid', startAt: new Date('2026-10-02T18:00:00Z'), partySize: 2,
      resourceName: 'Niños ( desde 6 hasta 10 años)' };
    const email = customerEmailContent(input, { kind: 'confirmation', policyLines: policies,
      cancelUrl: `https://booking.host-ia.online/cancel/test?lang=${language}`, paid: true });
    assert.ok(email.subject.startsWith(t('confirmationTitle')));
    assert.ok(email.text.includes(policies[1]));
    assert.ok(email.body.includes(localizedCompanyText(input.resourceName, language, '')));
    assert.ok(email.body.includes(`lang=${language}`));
    assert.ok(email.body.includes('&lt;Test &amp; Customer&gt;'));
    assert.ok(!email.body.includes('<Test & Customer>'));
    assert.ok(!email.text.match(/\{(?:duration|percent|name|company)\}/));
    const cancellation = customerEmailContent(input, { kind: 'cancellation', refundCents: 1500 });
    assert.ok(cancellation.subject.startsWith(t('cancelled')));
    assert.ok(cancellation.body.includes(t('cancellationUnexpected')));
    if (language !== 'es') {
      assert.ok(!email.text.includes('Política de cancelación'));
      assert.ok(!cancellation.text.includes('Reembolso solicitado'));
    }
  });
}
