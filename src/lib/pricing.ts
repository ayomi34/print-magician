// Print pricing engine — all amounts in NGN (₦)
// The pricing tables can be overridden at runtime via PricingSettings (admin-edited).

import { DEFAULT_PRICING, type PricingSettings, type ZoneSetting } from "./settings-types";

export type ColorMode = "bw" | "color";
export type SideMode = "single" | "double";
export type PaperSize = "A4" | "A5" | "Letter" | "Legal" | "Custom";
export type PaperType = "plain" | "glossy" | "matte" | "cardstock";
export type Binding = "none" | "stapled" | "spiral" | "hardcover";
export type Cover = "none" | "transparent" | "card" | "custom";
export type Delivery = "pickup" | "delivery";
// Zone is now a free-form string (admin can add/remove zones).
export type ZoneId = string;
// Backward compatibility for old code paths.
export type IbadanZone = string;

/** @deprecated Use settings.zones from useSettings() — kept as fallback for legacy imports. */
export const IBADAN_ZONES: { value: string; label: string; fee: number; eta: string }[] =
  DEFAULT_PRICING.zones.filter((z) => z.active).map((z) => ({ value: z.value, label: z.label, fee: z.fee, eta: z.eta }));

export interface PrintConfig {
  pages: number;
  copies: number;
  color: ColorMode;
  sides: SideMode;
  size: PaperSize;
  paper: PaperType;
  binding: Binding;
  cover: Cover;
  delivery: Delivery;
  zone?: ZoneId;
}

function tieredPerPage(base: number, totalPages: number): number {
  if (totalPages >= 1000) return Math.min(base, 20);
  if (totalPages >= 500) return base * 0.75;
  if (totalPages >= 50) return base * 0.85;
  return base;
}

const SIZE_MULT: Record<PaperSize, number> = {
  A5: 0.7,
  A4: 1,
  Letter: 1,
  Legal: 1.2,
  Custom: 1.3,
};

export function getZoneFee(zone: string | undefined, zones: ZoneSetting[] = DEFAULT_PRICING.zones): number {
  if (!zone) return 0;
  return zones.find((z) => z.value === zone)?.fee ?? 0;
}

export interface PriceBreakdown {
  perPage: number;
  pagesTotal: number;
  paperSurcharge: number;
  bindingTotal: number;
  coverTotal: number;
  deliveryFee: number;
  subtotal: number;
  total: number;
  effectiveSheets: number;
}

export function calculatePrice(c: PrintConfig, settings: PricingSettings = DEFAULT_PRICING): PriceBreakdown {
  const sheetsPerCopy = c.sides === "double" ? Math.ceil(c.pages / 2) : c.pages;
  const effectiveSheets = sheetsPerCopy * Math.max(1, c.copies);
  const totalPagesPrinted = c.pages * Math.max(1, c.copies);

  const base = c.color === "color" ? settings.baseColor : settings.baseBW;
  const perPage = tieredPerPage(base, totalPagesPrinted) * SIZE_MULT[c.size];

  const pagesTotal = perPage * totalPagesPrinted;
  const paperSurcharge = (settings.paperSurcharge[c.paper] ?? 0) * effectiveSheets;
  const bindingTotal = (settings.bindingFlat[c.binding] ?? 0) * Math.max(1, c.copies);
  const coverTotal = (settings.coverFlat[c.cover] ?? 0) * Math.max(1, c.copies);
  const deliveryFee = c.delivery === "delivery" ? getZoneFee(c.zone, settings.zones) : 0;

  const subtotal = pagesTotal + paperSurcharge + bindingTotal + coverTotal;
  const total = subtotal + deliveryFee;

  return {
    perPage,
    pagesTotal,
    paperSurcharge,
    bindingTotal,
    coverTotal,
    deliveryFee,
    subtotal,
    total,
    effectiveSheets,
  };
}

export function formatNaira(n: number): string {
  return "₦" + Math.round(n).toLocaleString("en-NG");
}
