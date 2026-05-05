// Editable site settings (pricing, zones, hero copy) backed by the `app_settings` table.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ZoneSetting {
  value: string;
  label: string;
  fee: number;
  eta: string;
  active: boolean;
}

export interface PricingSettings {
  baseBW: number;
  baseColor: number;
  paperSurcharge: { plain: number; matte: number; glossy: number; cardstock: number };
  bindingFlat: { none: number; stapled: number; spiral: number; hardcover: number };
  coverFlat: { none: number; transparent: number; card: number; custom: number };
  zones: ZoneSetting[];
}

export interface SiteSettings {
  heroBadge: string;
}

export const DEFAULT_PRICING: PricingSettings = {
  baseBW: 30,
  baseColor: 100,
  paperSurcharge: { plain: 0, matte: 15, glossy: 25, cardstock: 40 },
  bindingFlat: { none: 0, stapled: 100, spiral: 800, hardcover: 3500 },
  coverFlat: { none: 0, transparent: 200, card: 500, custom: 1000 },
  zones: [
    { value: "ibadan_dugbe",     label: "Ibadan — Dugbe / Adamasingba",   fee: 1200, eta: "Same day", active: true },
    { value: "ibadan_mokola",    label: "Ibadan — Mokola / Sango",        fee: 1200, eta: "Same day", active: true },
    { value: "ibadan_bodija",    label: "Ibadan — Bodija / Agbowo",       fee: 1500, eta: "Same day", active: true },
    { value: "ibadan_ui",        label: "Ibadan — UI / Ajibode",          fee: 1500, eta: "Same day", active: true },
    { value: "ibadan_ringroad",  label: "Ibadan — Ring Road / Molete",    fee: 1800, eta: "1 day",    active: true },
    { value: "ibadan_challenge", label: "Ibadan — Challenge / Felele",    fee: 1800, eta: "1 day",    active: true },
    { value: "ibadan_iworoad",   label: "Ibadan — Iwo Road / New Garage", fee: 2000, eta: "1 day",    active: true },
    { value: "ibadan_akobo",     label: "Ibadan — Akobo / Basorun",       fee: 2000, eta: "1 day",    active: true },
    { value: "ibadan_apata",     label: "Ibadan — Apata / Odo Ona",       fee: 2200, eta: "1–2 days", active: true },
    { value: "ibadan_egbeda",    label: "Ibadan — Egbeda / Olodo",        fee: 2200, eta: "1–2 days", active: true },
    { value: "ibadan_ojoo",      label: "Ibadan — Ojoo / Sasa",           fee: 2500, eta: "1–2 days", active: true },
    { value: "ibadan_moniya",    label: "Ibadan — Moniya / Akinyele",     fee: 2800, eta: "1–2 days", active: true },
    { value: "ekiti",            label: "Ekiti (coming soon)",            fee: 0,    eta: "Coming soon", active: false },
  ],
};

export const DEFAULT_SITE: SiteSettings = {
  heroBadge: "Active in Ibadan · Ekiti coming soon",
};

function mergePricing(raw: unknown): PricingSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<PricingSettings>;
  return {
    baseBW: typeof r.baseBW === "number" ? r.baseBW : DEFAULT_PRICING.baseBW,
    baseColor: typeof r.baseColor === "number" ? r.baseColor : DEFAULT_PRICING.baseColor,
    paperSurcharge: { ...DEFAULT_PRICING.paperSurcharge, ...(r.paperSurcharge ?? {}) },
    bindingFlat: { ...DEFAULT_PRICING.bindingFlat, ...(r.bindingFlat ?? {}) },
    coverFlat: { ...DEFAULT_PRICING.coverFlat, ...(r.coverFlat ?? {}) },
    zones: Array.isArray(r.zones) && r.zones.length > 0 ? r.zones as ZoneSetting[] : DEFAULT_PRICING.zones,
  };
}

function mergeSite(raw: unknown): SiteSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<SiteSettings>;
  return {
    heroBadge: typeof r.heroBadge === "string" && r.heroBadge.trim() ? r.heroBadge : DEFAULT_SITE.heroBadge,
  };
}

export async function loadAllSettings(): Promise<{ pricing: PricingSettings; site: SiteSettings }> {
  const { data } = await supabase.from("app_settings").select("id, data").in("id", ["pricing", "site"]);
  const pricingRow = data?.find((r) => r.id === "pricing");
  const siteRow = data?.find((r) => r.id === "site");
  return {
    pricing: mergePricing(pricingRow?.data),
    site: mergeSite(siteRow?.data),
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
