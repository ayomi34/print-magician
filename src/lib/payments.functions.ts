// Paystack server functions: initialize a transaction and verify it.
// Order is only inserted into the database AFTER payment is verified.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { PrintConfig } from "@/lib/pricing";
import { calculatePrice } from "@/lib/pricing";

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
});

function genOrderId(): string {
  return "PF-" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

/** Initialize a Paystack transaction. Returns reference + authorization_url. */
export const initPayment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InitInput.parse(input))
  .handler(async ({ data }) => {
    const breakdown = calculatePrice(data.config as PrintConfig);
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
    // Idempotency: if order with this reference already saved, return it
    const { data: existing } = await supabaseAdmin
      .from("orders")
      .select("id, status, payment_status")
      .eq("payment_reference", data.reference)
      .maybeSingle();
    if (existing) {
      return { ok: true, orderId: existing.id, alreadySaved: true };
    }

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

    // Re-compute price server-side; reject if Paystack amount doesn't match.
    const breakdown = calculatePrice(config as PrintConfig);
    const expectedKobo = Math.round(breakdown.total * 100);
    if (Number(tx.amount) !== expectedKobo) {
      console.error("Amount mismatch", { paid: tx.amount, expected: expectedKobo });
      throw new Error("Payment amount mismatch — please contact support");
    }

    const { error } = await supabaseAdmin.from("orders").insert({
      id: orderId,
      status: "pending",
      customer_name: customer.name,
      customer_phone: customer.phone,
      customer_email: customer.email || null,
      customer_notes: customer.notes || null,
      config: config as unknown as Record<string, unknown>,
      file_name: meta.fileName || null,
      file_size: meta.fileSize ?? 0,
      total: breakdown.total,
      payment_reference: data.reference,
      payment_status: "paid",
    });
    if (error) {
      console.error("Order insert failed:", error);
      throw new Error("Could not save order");
    }

    return { ok: true, orderId, alreadySaved: false };
  });
