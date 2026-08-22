/**
 * Transactional SMS — a provider-agnostic sender.
 *
 * The OTP path already uses HanuOTP (see `app/api/send-otp/route.ts`), but
 * HanuOTP's endpoint is OTP-only — you can't send an arbitrary "your order
 * is on the way" message through it. This module adds a general-purpose
 * transactional path.
 *
 *   MSG91 is the default provider (India-native, DLT-compliant, widely used
 *   by 10-minute grocery apps). Kaleyra and Gupshup are drop-in swaps.
 *
 * Configure via env:
 *
 *   MSG91_AUTH_KEY         Your MSG91 auth key
 *   MSG91_SENDER_ID        6-char DLT-registered sender ID (e.g. "10MINT")
 *   MSG91_DLT_TE_ID_...    One env var per template — see below.
 *
 * Templates are looked up per-status. Register them in the MSG91 dashboard
 * against your DLT principal entity, then set the returned template id in:
 *
 *   MSG91_DLT_TE_ID_ORDER_CONFIRMED
 *   MSG91_DLT_TE_ID_ORDER_OUT_FOR_DELIVERY
 *   MSG91_DLT_TE_ID_ORDER_DELIVERED
 *   MSG91_DLT_TE_ID_ORDER_CANCELLED
 *
 * If a template env var is missing for a given status, the corresponding
 * send is silently skipped (with a warn) — orders still succeed, they just
 * don't SMS-notify. This lets you roll out templates one status at a time.
 */

import { log } from "@/lib/log";

/* ── Types & config lookup ────────────────────────────────────── */

export type OrderSmsStatus =
  | "order_confirmed"
  | "order_out_for_delivery"
  | "order_delivered"
  | "order_cancelled";

const TEMPLATE_ENV: Record<OrderSmsStatus, string> = {
  order_confirmed:        "MSG91_DLT_TE_ID_ORDER_CONFIRMED",
  order_out_for_delivery: "MSG91_DLT_TE_ID_ORDER_OUT_FOR_DELIVERY",
  order_delivered:        "MSG91_DLT_TE_ID_ORDER_DELIVERED",
  order_cancelled:        "MSG91_DLT_TE_ID_ORDER_CANCELLED",
};

function normalizeIndianPhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  // Accept +91XXXXXXXXXX, 91XXXXXXXXXX, or a bare 10-digit Indian number.
  if (digits.length === 10) return "91" + digits;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  if (digits.length === 11 && digits.startsWith("0")) return "91" + digits.slice(1);
  return null;
}

/* ── MSG91 provider ──────────────────────────────────────────── */

interface SendResult {
  ok: boolean;
  provider: "msg91";
  reason?: string;
}

/**
 * Send a DLT-templated SMS via MSG91's Flow API.
 * https://docs.msg91.com/reference/flow
 *
 * `variables` is a map of the template variable names to their values.
 * MSG91 templates use `##VAR1##` etc. as placeholders; the flow API
 * substitutes them by key.
 */
async function sendMsg91Template(args: {
  templateId: string;
  toE164MinusPlus: string;
  variables: Record<string, string | number>;
}): Promise<SendResult> {
  const authKey = process.env.MSG91_AUTH_KEY;
  const senderId = process.env.MSG91_SENDER_ID;
  if (!authKey || !senderId) {
    return { ok: false, provider: "msg91", reason: "MSG91_AUTH_KEY / MSG91_SENDER_ID not set" };
  }

  try {
    const res = await fetch("https://control.msg91.com/api/v5/flow/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        authkey: authKey,
      },
      body: JSON.stringify({
        template_id: args.templateId,
        short_url: "0",
        recipients: [
          {
            mobiles: args.toE164MinusPlus,
            ...Object.fromEntries(
              Object.entries(args.variables).map(([k, v]) => [k, String(v)])
            ),
          },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        provider: "msg91",
        reason: `HTTP ${res.status}: ${body.slice(0, 200)}`,
      };
    }
    return { ok: true, provider: "msg91" };
  } catch (err: any) {
    return { ok: false, provider: "msg91", reason: err?.message ?? "network error" };
  }
}

/* ── Public API ───────────────────────────────────────────────── */

export interface OrderSmsInput {
  phone: string;
  customerName?: string | null;
  orderNumber: string;
  status: OrderSmsStatus;
  totalRupees?: number;
  etaMinutes?: number;
}

/**
 * Send a transactional order SMS. Fire-and-forget from the caller's
 * perspective — always resolves, never throws. Success only means the
 * provider accepted the send; carrier delivery isn't confirmed here.
 */
export async function sendOrderSms(input: OrderSmsInput): Promise<boolean> {
  const templateEnv = TEMPLATE_ENV[input.status];
  const templateId = process.env[templateEnv];
  if (!templateId) {
    log.debug("SMS skipped — no template configured", {
      status: input.status,
      hint: `Set ${templateEnv} in env with your MSG91 DLT template id.`,
    });
    return false;
  }

  const mobiles = normalizeIndianPhone(input.phone);
  if (!mobiles) {
    log.warn("SMS skipped — phone number not normalisable to Indian E.164", { phone: input.phone });
    return false;
  }

  const firstName = (input.customerName ?? "").trim().split(" ")[0] || "there";
  const variables: Record<string, string | number> = {
    VAR1: firstName,
    VAR2: input.orderNumber,
    ...(input.totalRupees != null ? { VAR3: input.totalRupees } : {}),
    ...(input.etaMinutes != null ? { VAR4: input.etaMinutes } : {}),
  };

  const result = await sendMsg91Template({
    templateId,
    toE164MinusPlus: mobiles,
    variables,
  });

  if (!result.ok) {
    log.warn("SMS send failed", { status: input.status, provider: result.provider }, result.reason);
    return false;
  }
  log.info("SMS sent", { status: input.status, orderNumber: input.orderNumber });
  return true;
}
