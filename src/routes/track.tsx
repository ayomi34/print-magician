import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search, Package, CheckCircle2, Truck, Printer as PrinterIcon, Clock, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SupportFab } from "@/components/SupportFab";
import { toast } from "sonner";
import {
  fetchOrder,
  ORDER_STATUSES,
  STATUS_LABELS,
  subscribeOrders,
  type OrderStatus,
  type PublicOrderStatus,
} from "@/lib/orders";
import { formatNaira } from "@/lib/pricing";

export const Route = createFileRoute("/track")({
  head: () => ({
    meta: [
      { title: "Track Order — PrintSmart" },
      { name: "description", content: "Track your PrintSmart order using your Order ID." },
    ],
  }),
  component: TrackPage,
});

const STAGE_META: Record<OrderStatus, { icon: typeof Clock; desc: string }> = {
  pending: { icon: Clock, desc: "We received your order. Awaiting processing." },
  processing: { icon: Package, desc: "Our team is preparing your file." },
  printing: { icon: PrinterIcon, desc: "Your job is on the press." },
  ready: { icon: Truck, desc: "Packed and on the way / ready for pickup." },
  completed: { icon: CheckCircle2, desc: "Delivered. Thanks for choosing PrintSmart!" },
};

function TrackPage() {
  const [orderId, setOrderId] = useState("");
  const [order, setOrder] = useState<PublicOrderStatus | null>(null);
  const [loading, setLoading] = useState(false);

  // Realtime: when this specific order changes in the DB, refresh it.
  useEffect(() => {
    if (!order) return;
    const unsubscribe = subscribeOrders(async () => {
      const fresh = await fetchOrder(order.id);
      if (fresh) setOrder(fresh);
    });
    return unsubscribe;
  }, [order?.id]);

  async function lookup() {
    const raw = orderId.trim();
    const isOrderId = raw.toUpperCase().startsWith("PF-");
    const digits = raw.replace(/\D/g, "");
    const isPhone = !isOrderId && digits.length >= 7;
    if (!isOrderId && !isPhone) {
      toast.error("Enter an Order ID (PF-XXXXXX) or your phone number");
      return;
    }
    const query = isOrderId ? raw.toUpperCase() : digits;
    setLoading(true);
    try {
      const found = await fetchOrder(query);
      if (!found) {
        toast.error("Order not found. Double-check your ID or phone.");
        setOrder(null);
      } else {
        setOrder(found);
      }
    } catch (e) {
      console.error(e);
      toast.error("Could not load order.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setOrder(null);
    setOrderId("");
  }

  const currentIndex = order ? ORDER_STATUSES.indexOf(order.status) : -1;
  const overallProgress = order ? ((currentIndex + 1) / ORDER_STATUSES.length) * 100 : 0;
  const isComplete = order?.status === "completed";

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-2xl">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Track your order</h1>
        <p className="text-muted-foreground mt-2">
          Enter the Order ID we sent you (starts with <code className="font-mono">PF-</code>) or the phone number you used to place the order. Status updates in real time as our team works on your job.
        </p>

        <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
            <div className="space-y-2">
              <Label htmlFor="oid">Order ID</Label>
              <Input
                id="oid"
                placeholder="PF-XXXXXX"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && lookup()}
              />
            </div>
            <Button onClick={lookup} disabled={loading}>
              {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Search className="mr-1 h-4 w-4" />}
              Track
            </Button>
          </div>
        </div>

        {order && (
          <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Order</div>
                <div className="font-mono text-lg font-semibold">{order.id}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Placed {new Date(order.createdAt).toLocaleString()} · {formatNaira(order.total)}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={reset} aria-label="Reset">
                <RotateCcw className="h-4 w-4 mr-1" /> Reset
              </Button>
            </div>

            {/* Progress bar based on real status */}
            <div className="mt-5">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                <span>{isComplete ? "Completed" : `Current status: ${STATUS_LABELS[order.status as OrderStatus]}`}</span>
                <span className="tabular-nums">{Math.round(overallProgress)}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-[width] duration-500 ease-out"
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
            </div>

            <ol className="mt-6 space-y-4">
              {ORDER_STATUSES.map((s, i) => {
                const done = i < currentIndex || isComplete;
                const active = i === currentIndex && !isComplete;
                const Icon = STAGE_META[s].icon;
                return (
                  <li key={s} className="flex items-start gap-4">
                    <div
                      className={[
                        "h-10 w-10 rounded-full grid place-items-center shrink-0 transition relative",
                        done || active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                      ].join(" ")}
                    >
                      <Icon className="h-5 w-5" />
                      {active && (
                        <span className="absolute inset-0 rounded-full ring-2 ring-primary/40 animate-ping" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={["font-medium", done || active ? "" : "text-muted-foreground"].join(" ")}>
                        {STATUS_LABELS[s]}
                      </div>
                      <div className="text-xs text-muted-foreground">{STAGE_META[s].desc}</div>
                      {active && <div className="text-xs text-primary mt-1">In progress…</div>}
                    </div>
                  </li>
                );
              })}
            </ol>

            <p className="mt-6 text-xs text-muted-foreground text-center">
              ✨ This page updates live — leave it open and you'll see status changes the moment we make them.
            </p>
          </div>
        )}
      </main>
      <SiteFooter />
      <SupportFab />
    </div>
  );
}
