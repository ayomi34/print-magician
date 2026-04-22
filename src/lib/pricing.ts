// Print pricing engine — all amounts in NGN (₦)

export type ColorMode = "bw" | "color";
export type SideMode = "single" | "double";
export type PaperSize = "A4" | "A5" | "Letter" | "Legal" | "Custom";
export type PaperType = "plain" | "glossy" | "matte" | "cardstock";
export type Binding = "none" | "stapled" | "spiral" | "hardcover";
export type Cover = "none" | "transparent" | "card" | "custom";
export type Delivery = "pickup" | "delivery";

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
}

// Per-page base for B&W plain A4
const BASE_BW = 30;
const BASE_COLOR = 100;

// Bulk tiers (applied to base per-page)
function tieredPerPage(base: number, totalPages: number): number {
  if (totalPages >= 1000) return Math.min(base, 20);
  if (totalPages >= 500) return base * 0.75;
  if (totalPages >= 50) return base * 0.85;
  return base;
}

const PAPER_SURCHARGE: Record<PaperType, number> = {
  plain: 0,
  matte: 15,
  glossy: 25,
  cardstock: 40,
};

const SIZE_MULT: Record<PaperSize, number> = {
  A5: 0.7,
  A4: 1,
  Letter: 1,
  Legal: 1.2,
  Custom: 1.3,
};

const BINDING_FLAT: Record<Binding, number> = {
  none: 0,
  stapled: 100,
  spiral: 800,
  hardcover: 3500,
};

const COVER_FLAT: Record<Cover, number> = {
  none: 0,
  transparent: 200,
  card: 500,
  custom: 1000,
};

const DELIVERY_FEE = 1500;

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

export function calculatePrice(c: PrintConfig): PriceBreakdown {
  const sheetsPerCopy =
    c.sides === "double" ? Math.ceil(c.pages / 2) : c.pages;
  const effectiveSheets = sheetsPerCopy * Math.max(1, c.copies);
  const totalPagesPrinted = c.pages * Math.max(1, c.copies);

  const base = c.color === "color" ? BASE_COLOR : BASE_BW;
  const perPage = tieredPerPage(base, totalPagesPrinted) * SIZE_MULT[c.size];

  const pagesTotal = perPage * totalPagesPrinted;
  const paperSurcharge = PAPER_SURCHARGE[c.paper] * effectiveSheets;
  const bindingTotal = BINDING_FLAT[c.binding] * Math.max(1, c.copies);
  const coverTotal = COVER_FLAT[c.cover] * Math.max(1, c.copies);
  const deliveryFee = c.delivery === "delivery" ? DELIVERY_FEE : 0;

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
