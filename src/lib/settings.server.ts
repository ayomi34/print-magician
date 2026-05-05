// Server-side loader for pricing settings (used by payment verification).
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { mergePricing, type PricingSettings } from "./settings-types";

export async function loadPricingServer(): Promise<PricingSettings> {
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("data")
    .eq("id", "pricing")
    .maybeSingle();
  return mergePricing(data?.data);
}
