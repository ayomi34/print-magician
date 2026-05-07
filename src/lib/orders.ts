// Orders persistence layer — backed by Lovable Cloud (Supabase) with realtime sync.
import { supabase } from "@/integrations/supabase/client";
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

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  printing: "Printing",
  ready: "Ready / Out for delivery",
  completed: "Completed",
};

interface DbRow {
  id: string;
  created_at: string;
  status: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  customer_notes: string | null;
  config: PrintConfig;
  file_name: string | null;
  file_size: number | null;
  total: number;
}

function rowToOrder(r: DbRow): StoredOrder {
  return {
    id: r.id,
    createdAt: new Date(r.created_at).getTime(),
    status: r.status as OrderStatus,
    customer: {
      name: r.customer_name,
      phone: r.customer_phone,
      email: r.customer_email ?? "",
      notes: r.customer_notes ?? "",
    },
    config: r.config,
    fileName: r.file_name ?? "—",
    fileSize: Number(r.file_size ?? 0),
    total: Number(r.total),
  };
}

export async function fetchOrders(): Promise<StoredOrder[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as unknown as DbRow[]).map(rowToOrder);
}

export interface PublicOrderStatus {
  id: string;
  status: OrderStatus;
  total: number;
  createdAt: number;
}

export async function fetchOrder(id: string): Promise<PublicOrderStatus | null> {
  // Uses a SECURITY DEFINER RPC that only returns non-PII fields,
  // so anonymous customers can track their own order without exposing other rows.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("track_order", { p_id: id });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    id: row.id,
    status: row.status as OrderStatus,
    total: Number(row.total),
    createdAt: new Date(row.created_at).getTime(),
  };
}

export async function addOrder(order: StoredOrder): Promise<void> {
  const payload = {
    id: order.id,
    status: order.status,
    customer_name: order.customer.name,
    customer_phone: order.customer.phone,
    customer_email: order.customer.email || null,
    customer_notes: order.customer.notes || null,
    config: order.config as unknown as Record<string, unknown>,
    file_name: order.fileName,
    file_size: order.fileSize,
    total: order.total,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase.from("orders").insert(payload as any);
  if (error) throw error;
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<void> {
  const { error } = await supabase.from("orders").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function deleteOrder(id: string): Promise<void> {
  const { error } = await supabase.from("orders").delete().eq("id", id);
  if (error) throw error;
}

/** Subscribe to realtime changes on the orders table. Returns unsubscribe fn. */
export function subscribeOrders(onChange: () => void): () => void {
  const channel = supabase
    .channel("orders-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
      onChange();
    })
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

export function generateOrderId(): string {
  return "PF-" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

/** Upload print file to Lovable Cloud storage. Returns public URL or null on failure. */
export async function uploadPrintFile(orderId: string, file: File): Promise<string | null> {
  const path = `${orderId}/${file.name}`;
  const { error } = await supabase.storage.from("print-files").upload(path, file, {
    upsert: true,
    contentType: file.type,
  });
  if (error) {
    console.error("Upload error:", error);
    return null;
  }
  const { data } = supabase.storage.from("print-files").getPublicUrl(path);
  return data.publicUrl;
}
