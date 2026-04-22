// Local mock orders store (will move to Lovable Cloud later).
// Persists to localStorage so the admin dashboard, /track, and order history all share data.

import type { PrintConfig } from "./pricing";

export type OrderStatus =
  | "pending"
  | "processing"
  | "printing"
  | "ready"
  | "completed";

export const ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "processing",
  "printing",
  "ready",
  "completed",
];

export interface StoredOrder {
  id: string; // PF-XXXXXX
  createdAt: number;
  status: OrderStatus;
  customer: { name: string; phone: string; email: string; notes: string };
  config: PrintConfig;
  fileName: string;
  fileSize: number;
  total: number;
}

const KEY = "pf_orders";

export function loadOrders(): StoredOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as StoredOrder[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveOrders(orders: StoredOrder[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(orders));
}

export function addOrder(order: StoredOrder) {
  const all = loadOrders();
  all.unshift(order);
  saveOrders(all);
}

export function updateOrderStatus(id: string, status: OrderStatus) {
  const all = loadOrders();
  const idx = all.findIndex((o) => o.id === id);
  if (idx >= 0) {
    all[idx].status = status;
    saveOrders(all);
  }
}

export function deleteOrder(id: string) {
  const all = loadOrders().filter((o) => o.id !== id);
  saveOrders(all);
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(`pf_order_${id}`);
  }
}

export function generateOrderId(): string {
  return "PF-" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  printing: "Printing",
  ready: "Ready / Out for delivery",
  completed: "Completed",
};
