// Server-side loader for pricing settings (used by payment verification).
// Uses the public anon key — app_settings has a public SELECT policy — so the
// app does not require SUPABASE_SERVICE_ROLE_KEY at runtime.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { mergePricing, type PricingSettings } from "./settings-types";

export async function loadPricingServer(): Promise<PricingSettings> {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    // Fall back to defaults rather than crashing checkout.
    return mergePricing(undefined);
  }
  const supabase = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await supabase
    .from("app_settings")
    .select("data")
    .eq("id", "pricing")
    .maybeSingle();
  return mergePricing(data?.data);
}
