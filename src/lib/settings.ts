// Browser-only settings access (uses supabase client + react hooks).
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_PRICING,
  DEFAULT_SITE,
  mergePricing,
  mergeSite,
  type PricingSettings,
  type SiteSettings,
} from "./settings-types";

export type { PricingSettings, SiteSettings, ZoneSetting } from "./settings-types";
export { DEFAULT_PRICING, DEFAULT_SITE } from "./settings-types";

export async function loadAllSettings(): Promise<{ pricing: PricingSettings; site: SiteSettings }> {
  const { data } = await supabase.from("app_settings").select("id, data").in("id", ["pricing", "site"]);
  return {
    pricing: mergePricing(data?.find((r) => r.id === "pricing")?.data),
    site: mergeSite(data?.find((r) => r.id === "site")?.data),
  };
}

export async function saveSetting(id: "pricing" | "site", data: unknown): Promise<void> {
  const { error } = await supabase
    .from("app_settings")
    .upsert({ id, data: data as never, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export function useSettings() {
  const [pricing, setPricing] = useState<PricingSettings>(DEFAULT_PRICING);
  const [site, setSite] = useState<SiteSettings>(DEFAULT_SITE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadAllSettings().then((s) => {
      if (cancelled) return;
      setPricing(s.pricing);
      setSite(s.site);
      setLoading(false);
    }).catch(() => { if (!cancelled) setLoading(false); });

    const channel = supabase
      .channel("app_settings_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "app_settings" }, () => {
        loadAllSettings().then((s) => {
          if (cancelled) return;
          setPricing(s.pricing);
          setSite(s.site);
        }).catch(() => {});
      })
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, []);

  return { pricing, site, loading };
}
