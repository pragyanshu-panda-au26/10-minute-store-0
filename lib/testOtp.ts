/**
 * Test-OTP allowlist — lets you sign in without receiving a real SMS.
 *
 * Two ways to bypass Twilio + OTP verification:
 *
 *   1. TEST_PHONE_NUMBERS (comma-list of E.164 phones)
 *      → those specific numbers ALWAYS accept `DEV_OTP_MASTER_CODE`,
 *        in dev AND in production. Real customers hit real SMS as usual.
 *        Use this for QA phones on a prod build, or your own dev phone.
 *
 *   2. NODE_ENV !== "production"  (i.e. `npm run dev`)
 *      → `DEV_OTP_MASTER_CODE` works for ANY phone. Never active in prod
 *        unless the phone is also on the TEST_PHONE_NUMBERS list.
 *
 * The .env.example documents the recommended defaults:
 *   DEV_OTP_MASTER_CODE="123456"
 *   TEST_PHONE_NUMBERS="+919999999999,+918888888888"
 */

/** Normalize to E.164 the same way the send-otp route does, so comparisons stick. */
function normalize(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (input.trim().startsWith("+")) return "+" + digits;
  if (digits.length === 10) return "+91" + digits;
  return "+" + digits;
}

export function getTestPhoneAllowlist(): Set<string> {
  const raw = process.env.TEST_PHONE_NUMBERS ?? "";
  return new Set(
    raw
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
      .map(normalize)
  );
}

/** True when this phone should skip Twilio and accept the master OTP. */
export function isTestPhone(phone: string): boolean {
  return getTestPhoneAllowlist().has(normalize(phone));
}

/** True when `otp` should be accepted without a DB challenge, given the phone. */
export function isMasterOtpAccepted(phone: string, otp: string): boolean {
  const master = process.env.DEV_OTP_MASTER_CODE;
  if (!master || otp !== master) return false;

  // Test-phone allowlist wins in every environment — a QA number can still
  // use the master code even in production.
  if (isTestPhone(phone)) return true;

  // "Any phone accepts the master code" is a dangerous shortcut — it means
  // any preview or staging build that inherits the master code accepts
  // `123456` for anyone's phone number. Require an EXPLICIT opt-in env
  // (`ALLOW_MASTER_OTP=1`) so a copied env var doesn't silently open the
  // door on the wrong environment. NODE_ENV alone was too easy to trip.
  if (process.env.ALLOW_MASTER_OTP === "1") return true;

  return false;
}
