// Server-side loader for pricing settings (used by payment verification).
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { DEFAULT_PRICING, type PricingSettings } from "./settings";

export async function loadPricingServer(): Promise<PricingSettings> {
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("data")
    .eq("id", "pricing")
    .maybeSingle();
  const r = (data?.data && typeof data.data === "object" ? data.data : {}) as Partial<PricingSettings>;
  return {
    baseBW: typeof r.baseBW === "number" ? r.baseBW : DEFAULT_PRICING.baseBW,
    baseColor: typeof r.baseColor === "number" ? r.baseColor : DEFAULT_PRICING.baseColor,
    paperSurcharge: { ...DEFAULT_PRICING.paperSurcharge, ...(r.paperSurcharge ?? {}) },
    bindingFlat: { ...DEFAULT_PRICING.bindingFlat, ...(r.bindingFlat ?? {}) },
    coverFlat: { ...DEFAULT_PRICING.coverFlat, ...(r.coverFlat ?? {}) },
    zones: Array.isArray(r.zones) && r.zones.length > 0 ? (r.zones as PricingSettings["zones"]) : DEFAULT_PRICING.zones,
  };
}
