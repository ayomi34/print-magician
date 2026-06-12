// Paystack server functions: initialize a transaction and verify it.
// Order is only inserted into the database AFTER payment is verified.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing Supabase env vars. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY (or VITE_ prefixed)."
    );
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
import type { PrintConfig } from "@/lib/pricing";
import { calculatePrice } from "@/lib/pricing";
import { loadPricingServer } from "@/lib/settings.server";

const PAYSTACK_BASE = "https://api.paystack.co";

function getPaystackSecret(): string {
  const k = process.env.PAYSTACK_SECRET_KEY;
  if (!k) throw new Error("PAYSTACK_SECRET_KEY is not configured");
  return k;
}

const ConfigSchema = z.object({
  pages: z.number().int().min(1).max(10000),
  copies: z.number().int().min(1).max(1000),
  color: z.enum(["bw", "color"]),
  sides: z.enum(["single", "double"]),
  size: z.enum(["A4", "A5", "Letter", "Legal", "Custom"]),
  paper: z.enum(["plain", "glossy", "matte", "cardstock"]),
  binding: z.enum(["none", "stapled", "spiral", "hardcover"]),
  cover: z.enum(["none", "transparent", "card", "custom"]),
  delivery: z.enum(["pickup", "delivery"]),
  zone: z.string().optional(),
});

const CustomerSchema = z.object({
  name: z.string().min(1).max(120),
  phone: z.string().min(5).max(40),
  email: z.string().email().max(200),
  notes: z.string().max(1000).optional().default(""),
});

const InitInput = z.object({
  config: ConfigSchema,
  customer: CustomerSchema,
  fileName: z.string().max(255).optional().default(""),
  fileSize: z.number().int().min(0).optional().default(0),
  callbackUrl: z.string().url().max(500).optional(),
});

function genOrderId(): string {
  return "PF-" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

/** Initialize a Paystack transaction. Returns reference + authorization_url. */
export const initPayment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InitInput.parse(input))
  .handler(async ({ data }) => {
    const pricing = await loadPricingServer();
    const breakdown = calculatePrice(data.config as PrintConfig, pricing);
    const amountKobo = Math.round(breakdown.total * 100);
    if (amountKobo < 100) {
      throw new Error("Order amount is too low");
    }

    const orderId = genOrderId();
    const reference = `${orderId}-${Date.now().toString(36)}`;

    const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getPaystackSecret()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: data.customer.email || `${data.customer.phone}@guest.printflow.local`,
        amount: amountKobo,
        currency: "NGN",
        reference,
        callback_url: data.callbackUrl,
        metadata: {
          orderId,
          customer: data.customer,
          config: data.config,
          fileName: data.fileName,
          fileSize: data.fileSize,
          expectedTotal: breakdown.total,
        },
      }),
    });

    const json = await res.json();
    if (!res.ok || !json?.status) {
      console.error("Paystack init failed:", json);
      throw new Error(json?.message || "Could not initialize payment");
    }

    return {
      orderId,
      reference,
      accessCode: json.data.access_code as string,
      authorizationUrl: json.data.authorization_url as string,
      publicKey: process.env.VITE_PAYSTACK_PUBLIC_KEY ?? "",
    };
  });

const VerifyInput = z.object({
  reference: z.string().min(5).max(200),
});

/** Verify with Paystack and INSERT the order only on success. Idempotent. */
export const verifyAndSaveOrder = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => VerifyInput.parse(input))
  .handler(async ({ data }) => {
    const supabase = getSupabase();

    const res = await fetch(
      `${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(data.reference)}`,
      {
        headers: { Authorization: `Bearer ${getPaystackSecret()}` },
      },
    );
    const json = await res.json();
    if (!res.ok || !json?.status) {
      console.error("Paystack verify failed:", json);
      throw new Error(json?.message || "Could not verify payment");
    }

    const tx = json.data;
    if (tx.status !== "success") {
      throw new Error(`Payment not successful (status: ${tx.status})`);
    }

    const meta = tx.metadata ?? {};
    const config = ConfigSchema.parse(meta.config);
    const customer = CustomerSchema.parse(meta.customer);
    const orderId = String(meta.orderId || `PF-${Date.now().toString(36).toUpperCase()}`);

    const pricing = await loadPricingServer();
    const breakdown = calculatePrice(config as PrintConfig, pricing);
    const expectedKobo = Math.round(breakdown.total * 100);
    if (Number(tx.amount) !== expectedKobo) {
      console.error("Amount mismatch", { paid: tx.amount, expected: expectedKobo });
      throw new Error("Payment amount mismatch — please contact support");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: saved, error } = await (supabase as any).rpc("save_paid_order", {
      p_id: orderId,
      p_customer_name: customer.name,
      p_customer_phone: customer.phone,
      p_customer_email: customer.email || null,
      p_customer_notes: customer.notes || null,
      p_config: config,
      p_file_name: meta.fileName || null,
      p_file_size: meta.fileSize ?? 0,
      p_total: breakdown.total,
      p_payment_reference: data.reference,
    });
    if (error) {
      console.error("Order save failed:", error);
      throw new Error("Could not save order");
    }
    const row = Array.isArray(saved) ? saved[0] : saved;
    return {
      ok: true,
      orderId: row?.id ?? orderId,
      alreadySaved: Boolean(row?.already_saved),
    };
  });
