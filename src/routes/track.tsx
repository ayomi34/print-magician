import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Package, CheckCircle2, Truck, Printer as PrinterIcon, Clock } from "lucide-react";
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
  { key: "pending", label: "Pending", icon: Clock },
  { key: "processing", label: "Processing", icon: Package },
  { key: "printing", label: "Printing", icon: PrinterIcon },
  { key: "ready", label: "Ready / Out for delivery", icon: Truck },
  { key: "completed", label: "Completed", icon: CheckCircle2 },
] as const;

function TrackPage() {
  const [orderId, setOrderId] = useState("");
  const [result, setResult] = useState<{ id: string; stage: number } | null>(null);

  function lookup() {
    const id = orderId.trim().toUpperCase();
    if (!id.startsWith("PF-") || id.length < 6) { toast.error("Enter a valid Order ID (e.g. PF-XXXXXX)"); return; }
    // mock: pseudo-random stage from the id
    const stage = Math.abs(hash(id)) % STAGES.length;
    setResult({ id, stage });
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-2xl">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Track your order</h1>
        <p className="text-muted-foreground mt-2">Enter the Order ID we sent you (starts with <code className="font-mono">PF-</code>).</p>

        <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
            <div className="space-y-2">
              <Label htmlFor="oid">Order ID</Label>
              <Input id="oid" placeholder="PF-XXXXXX" value={orderId} onChange={(e) => setOrderId(e.target.value)} onKeyDown={(e) => e.key === "Enter" && lookup()} />
            </div>
            <Button onClick={lookup}><Search className="mr-1 h-4 w-4" /> Track</Button>
          </div>
        </div>

        {result && (
          <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <div className="text-sm text-muted-foreground">Order</div>
            <div className="font-mono text-lg font-semibold">{result.id}</div>
            <ol className="mt-6 space-y-4">
              {STAGES.map((s, i) => {
                const done = i <= result.stage;
                const Icon = s.icon;
                return (
                  <li key={s.key} className="flex items-center gap-4">
                    <div className={["h-10 w-10 rounded-full grid place-items-center shrink-0 transition", done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"].join(" ")}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className={["font-medium", done ? "" : "text-muted-foreground"].join(" ")}>{s.label}</div>
                      {i === result.stage && <div className="text-xs text-primary">Current stage</div>}
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

function hash(s: string) {
  let h = 0; for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}
