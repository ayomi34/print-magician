import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Search, Package, CheckCircle2, Truck, Printer as PrinterIcon, Clock, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SupportFab } from "@/components/SupportFab";
import { toast } from "sonner";

export const Route = createFileRoute("/track")({
  head: () => ({
    meta: [
      { title: "Track Order — PrintFlow" },
      { name: "description", content: "Track your PrintFlow order using your Order ID." },
    ],
  }),
  component: TrackPage,
});

const STAGES = [
  { key: "pending", label: "Pending", icon: Clock, desc: "We received your order and payment." },
  { key: "processing", label: "Processing", icon: Package, desc: "Our team is preparing your file." },
  { key: "printing", label: "Printing", icon: PrinterIcon, desc: "Your job is on the press." },
  { key: "ready", label: "Ready / Out for delivery", icon: Truck, desc: "Packed and on the way / ready for pickup." },
  { key: "completed", label: "Completed", icon: CheckCircle2, desc: "Delivered. Thanks for choosing PrintFlow!" },
] as const;

// Total simulated time across all stages (ms)
const TOTAL_MS = 60_000;
const STAGE_MS = TOTAL_MS / STAGES.length;

interface OrderState {
  id: string;
  startedAt: number; // epoch ms
}

function TrackPage() {
  const [orderId, setOrderId] = useState("");
  const [order, setOrder] = useState<OrderState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const tickRef = useRef<number | null>(null);

  // Live ticker — updates every second while an order is loaded
  useEffect(() => {
    if (!order) return;
    setNow(Date.now());
    tickRef.current = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [order]);

  function lookup() {
    const id = orderId.trim().toUpperCase();
    if (!id.startsWith("PF-") || id.length < 6) {
      toast.error("Enter a valid Order ID (e.g. PF-XXXXXX)");
      return;
    }
    // Persist per-order start time so the same ID resumes correctly.
    const key = `pf_order_${id}`;
    let startedAt: number;
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
    if (saved) {
      startedAt = parseInt(saved, 10);
    } else {
      // Seed start time slightly in the past so progress is visible immediately.
      startedAt = Date.now() - Math.floor(Math.random() * STAGE_MS);
      window.localStorage.setItem(key, String(startedAt));
    }
    setOrder({ id, startedAt });
  }

  function reset() {
    if (order) window.localStorage.removeItem(`pf_order_${order.id}`);
    setOrder(null);
    setOrderId("");
  }

  // Derive live stage + within-stage progress
  const elapsed = order ? Math.max(0, now - order.startedAt) : 0;
  const rawStage = Math.floor(elapsed / STAGE_MS);
  const stage = Math.min(STAGES.length - 1, rawStage);
  const stageProgress = Math.min(1, (elapsed - stage * STAGE_MS) / STAGE_MS);
  const overallProgress = Math.min(1, elapsed / TOTAL_MS);
  const isComplete = stage >= STAGES.length - 1;

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-2xl">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Track your order</h1>
        <p className="text-muted-foreground mt-2">
          Enter the Order ID we sent you (starts with <code className="font-mono">PF-</code>). Status updates live.
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
            <Button onClick={lookup}>
              <Search className="mr-1 h-4 w-4" /> Track
            </Button>
          </div>
        </div>

        {order && (
          <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Order</div>
                <div className="font-mono text-lg font-semibold">{order.id}</div>
              </div>
              <Button variant="ghost" size="sm" onClick={reset} aria-label="Reset">
                <RotateCcw className="h-4 w-4 mr-1" /> Reset
              </Button>
            </div>

            {/* Live overall progress bar */}
            <div className="mt-5">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                <span>{isComplete ? "Completed" : "In progress"}</span>
                <span className="tabular-nums">{Math.round(overallProgress * 100)}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-[width] duration-1000 ease-linear"
                  style={{ width: `${overallProgress * 100}%` }}
                />
              </div>
              {!isComplete && (
                <div className="mt-2 text-xs text-muted-foreground">
                  ETA to next stage: <span className="tabular-nums font-medium text-foreground">{formatRemaining(STAGE_MS - (elapsed - stage * STAGE_MS))}</span>
                </div>
              )}
            </div>

            <ol className="mt-6 space-y-4">
              {STAGES.map((s, i) => {
                const done = i < stage || isComplete;
                const active = i === stage && !isComplete;
                const Icon = s.icon;
                return (
                  <li key={s.key} className="flex items-start gap-4">
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
                        {s.label}
                      </div>
                      <div className="text-xs text-muted-foreground">{s.desc}</div>
                      {active && (
                        <div className="mt-2 h-1 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-primary transition-[width] duration-1000 ease-linear"
                            style={{ width: `${stageProgress * 100}%` }}
                          />
                        </div>
                      )}
                      {active && <div className="text-xs text-primary mt-1">In progress…</div>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </main>
      <SiteFooter />
      <SupportFab />
    </div>
  );
}

function formatRemaining(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${r}s`;
}
