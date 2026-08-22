/**
 * Transactional email — nodemailer over SMTP.
 *
 * Configured from env vars so the same code works on local dev, staging, and
 * prod without a rebuild:
 *
 *   SMTP_HOST      = "smtpout.secureserver.net"   (GoDaddy Workspace)
 *   SMTP_PORT      = 465                          (SSL) or 587 (STARTTLS)
 *   SMTP_SECURE    = "true" for 465, "false" for 587
 *   SMTP_USER      = "connect@satyuglifestyle.com"
 *   SMTP_PASS      = "…"
 *   SMTP_FROM      = 'Satyug <connect@satyuglifestyle.com>'
 *   SMTP_EHLO_NAME = "satyuglifestyle.com"        (some hosts reject default HELO)
 *
 * Every send is best-effort. Failures are logged loudly (server console)
 * but never propagate to the API caller — a transactional email failing
 * must never fail the order it's confirming.
 */

import nodemailer, { type Transporter } from "nodemailer";

let cachedTransport: Transporter | null | undefined;

function getTransport(): Transporter | null {
  if (cachedTransport !== undefined) return cachedTransport;

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    cachedTransport = null;
    return null;
  }

  const port = Number(process.env.SMTP_PORT ?? 465);
  const secure = process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE === "true"
    : port === 465;

  cachedTransport = nodemailer.createTransport({
    host,
    port,
    secure,
    // Some providers (GoDaddy Workspace, Office365) reject connections that
    // send the default OS hostname as the HELO — Node on Windows sends the
    // machine name, which isn't a valid FQDN. Explicit `name` prevents that
    // "501 HELO requires valid address" failure mode.
    name: process.env.SMTP_EHLO_NAME || "localhost",
    auth: { user, pass },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    // STARTTLS on 587 needs requireTLS; a no-op on 465 (already SSL).
    ...(secure ? {} : { requireTLS: true }),
  });

  return cachedTransport;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
}

/**
 * Fire off an email. Returns `false` on any failure (missing config, network,
 * SMTP-level rejection) but never throws — so a caller in a hot path can
 * write `void sendEmail({...})` and forget.
 */
export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  const transport = getTransport();
  if (!transport) {
    console.warn("[email] skipped — SMTP not configured (set SMTP_HOST / SMTP_USER / SMTP_PASS)");
    return false;
  }
  const from = process.env.SMTP_FROM || `10minute <${process.env.SMTP_USER}>`;

  try {
    const info = await transport.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      replyTo: input.replyTo,
    });
    console.log(`[email] sent to=${input.to} messageId=${info.messageId}`);
    return true;
  } catch (err: any) {
    console.error(
      `[email] FAILED to=${input.to} subject="${input.subject}" reason=${err?.message ?? err}`
    );
    return false;
  }
}

/* ── Templates ─────────────────────────────────────────────────
 *
 * Kept as small pure functions so they're easy to unit-test and to swap
 * out for a proper templating layer later. Every template returns the
 * `{subject, text, html}` triplet that sendEmail expects.
 *
 * HTML is deliberately inline-styled and tightly scoped — no external
 * stylesheets, no fonts, no images — so every mail client renders it the
 * same way (Gmail, Outlook, iOS Mail, GoDaddy webmail).
 */

// Customer-facing product brand. See docs — Satyug is a separate entity;
// the customer app is "10minute" (Veloz Technologies Pvt Ltd).
const BRAND = "10minute";
const BRAND_ACCENT = "#10b981";

function shell(inner: string, preheader?: string) {
  // `preheader` is the tiny hidden text that mail clients show next to the
  // subject in the inbox list.
  const pre = preheader
    ? `<div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">${escapeHtml(preheader)}</div>`
    : "";
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f5f0e6;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;color:#171410">
${pre}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0e6;padding:24px 0">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #e3ddce;border-radius:12px;overflow:hidden">
      <tr><td style="padding:20px 28px;border-bottom:1px solid #eee6d3;background:#fff">
        <div style="font-weight:900;font-size:18px;letter-spacing:-0.01em">${BRAND} <span style="color:${BRAND_ACCENT}">·</span> <span style="font-weight:600;color:#6b655b">10-minute grocer</span></div>
      </td></tr>
      <tr><td style="padding:28px">${inner}</td></tr>
      <tr><td style="padding:16px 28px 24px;font-size:11px;color:#98908a;border-top:1px solid #eee6d3;background:#fbf9f4">
        You're receiving this because you placed an order with ${BRAND}. Reply to this email if anything looks wrong — we read every reply.
      </td></tr>
    </table>
  </td></tr>
</table></body></html>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => (
    c === "&" ? "&amp;" :
    c === "<" ? "&lt;" :
    c === ">" ? "&gt;" :
    c === '"' ? "&quot;" : "&#39;"
  ));
}

export interface OrderEmailInput {
  to: string;
  customerName?: string | null;
  orderNumber: string;
  totalRupees: number;
  itemsCount: number;
  deliveryAddress: string;
  paymentMethod: "cod" | "razorpay";
  etaMinutes?: number;
}

export function orderConfirmationEmail(input: OrderEmailInput) {
  const name = (input.customerName?.trim() || "there").split(" ")[0];
  const pm = input.paymentMethod === "cod" ? "Cash on Delivery" : "Paid online";
  const subject = `Order confirmed · #${input.orderNumber}`;
  const eta = input.etaMinutes ? `~${input.etaMinutes} min` : "10 min";

  const text = [
    `Hi ${name},`,
    ``,
    `Your ${BRAND} order #${input.orderNumber} is confirmed. Expected in ${eta}.`,
    ``,
    `${input.itemsCount} item${input.itemsCount === 1 ? "" : "s"}  ·  ₹${input.totalRupees}  ·  ${pm}`,
    `Delivering to: ${input.deliveryAddress}`,
    ``,
    `Track it in the app under My orders.`,
    `— ${BRAND}`,
  ].join("\n");

  const html = shell(
    `
    <p style="margin:0 0 6px;font-size:14px;color:#6b655b">Order confirmed</p>
    <h1 style="margin:0 0 12px;font-size:26px;font-weight:900;letter-spacing:-0.01em">#${escapeHtml(input.orderNumber)}</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.55">Hi ${escapeHtml(name)} — we've got your order and the shop owner is packing it now.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee6d3;border-radius:10px;background:#fbf9f4;margin:0 0 20px">
      <tr>
        <td style="padding:14px 16px;font-size:13px;color:#6b655b;border-bottom:1px solid #eee6d3">Items</td>
        <td style="padding:14px 16px;font-size:13px;color:#171410;text-align:right;border-bottom:1px solid #eee6d3;font-weight:700">${input.itemsCount}</td>
      </tr>
      <tr>
        <td style="padding:14px 16px;font-size:13px;color:#6b655b;border-bottom:1px solid #eee6d3">Total</td>
        <td style="padding:14px 16px;font-size:13px;color:#171410;text-align:right;border-bottom:1px solid #eee6d3;font-weight:700">₹${input.totalRupees}</td>
      </tr>
      <tr>
        <td style="padding:14px 16px;font-size:13px;color:#6b655b;border-bottom:1px solid #eee6d3">Payment</td>
        <td style="padding:14px 16px;font-size:13px;color:#171410;text-align:right;border-bottom:1px solid #eee6d3;font-weight:700">${escapeHtml(pm)}</td>
      </tr>
      <tr>
        <td style="padding:14px 16px;font-size:13px;color:#6b655b">Delivering to</td>
        <td style="padding:14px 16px;font-size:13px;color:#171410;text-align:right;font-weight:600">${escapeHtml(input.deliveryAddress)}</td>
      </tr>
    </table>

    <p style="margin:0 0 4px;font-size:13px;color:#6b655b">Expected delivery</p>
    <p style="margin:0 0 20px;font-size:20px;font-weight:900;color:${BRAND_ACCENT}">${escapeHtml(eta)}</p>

    <p style="margin:0;font-size:13px;color:#6b655b">Track this order in the app under <strong style="color:#171410">My orders</strong>. Reply to this email if anything looks wrong.</p>
    `,
    `Order #${input.orderNumber} · ₹${input.totalRupees} · ${pm}`
  );

  return { subject, text, html };
}

export interface StatusEmailInput {
  to: string;
  customerName?: string | null;
  orderNumber: string;
  status: "confirmed" | "packed" | "out_for_delivery" | "delivered" | "cancelled";
}

export function orderStatusEmail(input: StatusEmailInput) {
  const name = (input.customerName?.trim() || "there").split(" ")[0];
  const map = {
    confirmed:       { title: "Order confirmed",      copy: "The shop owner has your order and is starting to pack it." },
    packed:          { title: "Order packed",         copy: "Your order is packed and ready to head out the door." },
    out_for_delivery:{ title: "Out for delivery",     copy: "The shop owner is on the way with your order." },
    delivered:       { title: "Order delivered",      copy: "Thanks for shopping with us! Reply here if anything wasn't right." },
    cancelled:       { title: "Order cancelled",      copy: "Your order has been cancelled. Any pre-payment will be refunded to the original source." },
  }[input.status];

  const subject = `${map.title} · #${input.orderNumber}`;
  const text = `Hi ${name},\n\n${map.title} — #${input.orderNumber}.\n${map.copy}\n\n— ${BRAND}`;
  const html = shell(
    `
    <p style="margin:0 0 6px;font-size:14px;color:#6b655b">${escapeHtml(map.title)}</p>
    <h1 style="margin:0 0 12px;font-size:26px;font-weight:900;letter-spacing:-0.01em">#${escapeHtml(input.orderNumber)}</h1>
    <p style="margin:0;font-size:15px;line-height:1.55">${escapeHtml(map.copy)}</p>
    `,
    `${map.title} · #${input.orderNumber}`
  );
  return { subject, text, html };
}
