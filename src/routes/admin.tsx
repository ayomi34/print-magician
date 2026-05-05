import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  Clock,
  Download,
  Package,
  Plus,
  Printer as PrinterIcon,
  Save,
  Search,
  Settings,
  Trash2,
  TrendingUp,
  Truck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { toast } from "sonner";
import {
  deleteOrder,
  fetchOrders,
  ORDER_STATUSES,
  STATUS_LABELS,
  subscribeOrders,
  updateOrderStatus,
  type OrderStatus,
  type StoredOrder,
} from "@/lib/orders";
import { formatNaira } from "@/lib/pricing";
import { useSettings, saveSetting, type PricingSettings, type SiteSettings, type ZoneSetting } from "@/lib/settings";
import { useAuth } from "@/hooks/useAuth";
import { Link, useNavigate } from "@tanstack/react-router";
import { Loader2, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — PrintFlow" },
      { name: "description", content: "Manage orders, update status, and view revenue analytics." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-secondary/30">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return null;

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col bg-secondary/30">
        <SiteHeader />
        <main className="flex-1 grid place-items-center px-4">
          <div className="max-w-md text-center rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
            <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 grid place-items-center mb-4">
              <ShieldAlert className="h-6 w-6 text-destructive" />
            </div>
            <h1 className="text-xl font-bold">Admin access required</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Your account doesn't have admin privileges. Contact the owner if you believe this is a mistake.
            </p>
            <Link to="/" className="inline-block mt-6 text-sm underline">← Back to home</Link>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-secondary/30">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-8 md:py-12">
        <Dashboard />
      </main>
      <SiteFooter />
    </div>
  );
}

function Dashboard() {
  const [orders, setOrders] = useState<StoredOrder[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const { pricing, site } = useSettings();

  async function refresh() {
    try {
      setOrders(await fetchOrders());
    } catch (e) {
      console.error(e);
      toast.error("Could not load orders");
    }
  }

  useEffect(() => {
    refresh();
    // Realtime: refresh whenever orders table changes anywhere.
    const unsubscribe = subscribeOrders(() => { refresh(); });
    return unsubscribe;
  }, []);

  const stats = useMemo(() => {
    const total = orders.length;
    const revenue = orders.reduce((s, o) => s + o.total, 0);
    const active = orders.filter((o) => o.status !== "completed").length;
    const completed = orders.filter((o) => o.status === "completed").length;
    const customers = new Set(orders.map((o) => o.customer.phone || o.customer.email)).size;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayRevenue = orders.filter((o) => o.createdAt >= today.getTime()).reduce((s, o) => s + o.total, 0);
    return { total, revenue, active, completed, customers, todayRevenue };
  }, [orders]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (!q) return true;
      return (
        o.id.toLowerCase().includes(q) ||
        o.customer.name.toLowerCase().includes(q) ||
        o.customer.phone.toLowerCase().includes(q) ||
        o.customer.email.toLowerCase().includes(q) ||
        o.fileName.toLowerCase().includes(q)
      );
    });
  }, [orders, query, statusFilter]);

  async function handleStatus(id: string, status: OrderStatus) {
    try {
      await updateOrderStatus(id, status);
      toast.success(`Order ${id} → ${STATUS_LABELS[status]}`);
    } catch (e) {
      console.error(e);
      toast.error("Update failed");
    }
  }
  async function handleDelete(id: string) {
    if (!confirm(`Delete order ${id}? This can't be undone.`)) return;
    try {
      await deleteOrder(id);
      toast.success("Order deleted");
    } catch (e) {
      console.error(e);
      toast.error("Delete failed");
    }
  }
  function exportCsv() {
    if (orders.length === 0) { toast.error("No orders to export"); return; }
    const header = ["Order ID", "Created", "Status", "Name", "Phone", "Email", "File", "Pages", "Copies", "Color", "Sides", "Paper", "Binding", "Cover", "Fulfillment", "Zone", "Total (NGN)"];
    const rows = orders.map((o) => [
      o.id,
      new Date(o.createdAt).toISOString(),
      o.status,
      o.customer.name,
      o.customer.phone,
      o.customer.email,
      o.fileName,
      String(o.config.pages),
      String(o.config.copies),
      o.config.color,
      o.config.sides,
      o.config.paper,
      o.config.binding,
      o.config.cover,
      o.config.delivery,
      o.config.zone ?? "",
      String(Math.round(o.total)),
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `printflow-orders-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage orders, update status, and track performance.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv}><Download className="mr-1 h-4 w-4" /> Export CSV</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Package} label="Total orders" value={stats.total.toString()} />
        <StatCard icon={TrendingUp} label="Total revenue" value={formatNaira(stats.revenue)} accent />
        <StatCard icon={Clock} label="Active" value={stats.active.toString()} />
        <StatCard icon={Users} label="Customers" value={stats.customers.toString()} />
      </div>

      <Tabs defaultValue="orders" className="w-full">
        <TabsList>
          <TabsTrigger value="orders"><Package className="h-4 w-4 mr-1" /> Orders</TabsTrigger>
          <TabsTrigger value="analytics"><BarChart3 className="h-4 w-4 mr-1" /> Analytics</TabsTrigger>
          <TabsTrigger value="pricing"><PrinterIcon className="h-4 w-4 mr-1" /> Pricing</TabsTrigger>
          <TabsTrigger value="settings"><Settings className="h-4 w-4 mr-1" /> Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="mt-6">
          <Card>
            <CardHeader className="gap-3">
              <div className="flex flex-wrap items-center gap-3 justify-between">
                <CardTitle>All orders ({filtered.length})</CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-8 w-56" placeholder="Search orders…" value={query} onChange={(e) => setQuery(e.target.value)} />
                  </div>
                  <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as OrderStatus | "all")}>
                    <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      {ORDER_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filtered.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="rounded-lg border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead className="hidden md:table-cell">Job</TableHead>
                        <TableHead className="hidden sm:table-cell">Fulfillment</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((o) => (
                        <TableRow key={o.id}>
                          <TableCell>
                            <div className="font-mono text-xs font-semibold">{o.id}</div>
                            <div className="text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleString()}</div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-sm">{o.customer.name}</div>
                            <div className="text-xs text-muted-foreground">{o.customer.phone}</div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <div className="text-sm truncate max-w-[200px]">{o.fileName}</div>
                            <div className="text-xs text-muted-foreground">{o.config.pages}p × {o.config.copies} · {o.config.color === "bw" ? "B&W" : "Color"} · {o.config.size}</div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {o.config.delivery === "delivery" ? (
                              <div className="text-xs">
                                <div className="font-medium">Delivery</div>
                                <div className="text-muted-foreground">{pricing.zones.find((z) => z.value === o.config.zone)?.label ?? "—"}</div>
                              </div>
                            ) : (
                              <div className="text-xs"><div className="font-medium">Pickup</div><div className="text-muted-foreground">In-store</div></div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Select value={o.status} onValueChange={(v) => handleStatus(o.id, v as OrderStatus)}>
                              <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {ORDER_STATUSES.map((s) => (
                                  <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">{formatNaira(o.total)}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(o.id)} aria-label="Delete order">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle>Revenue today</CardTitle></CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{formatNaira(stats.todayRevenue)}</div>
                <p className="text-xs text-muted-foreground mt-1">Across all orders placed today.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Status breakdown</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {ORDER_STATUSES.map((s) => {
                  const count = orders.filter((o) => o.status === s).length;
                  const pct = stats.total ? (count / stats.total) * 100 : 0;
                  return (
                    <div key={s}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">{STATUS_LABELS[s]}</span>
                        <span className="font-medium">{count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
            <Card className="md:col-span-2">
              <CardHeader><CardTitle>Top customers</CardTitle></CardHeader>
              <CardContent>
                <TopCustomers orders={orders} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="pricing" className="mt-6">
          <PricingEditor pricing={pricing} />
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <SiteSettingsEditor site={site} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; accent?: boolean }) {
  return (
    <Card className={accent ? "border-primary/30" : ""}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={["h-10 w-10 rounded-lg grid place-items-center shrink-0", accent ? "text-primary-foreground" : "bg-secondary text-foreground"].join(" ")} style={accent ? { background: "var(--gradient-primary)" } : undefined}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-lg font-bold truncate">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-16">
      <div className="mx-auto h-12 w-12 rounded-full bg-secondary grid place-items-center mb-3">
        <Package className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="font-medium">No orders yet</p>
      <p className="text-sm text-muted-foreground mt-1">Orders will appear here as customers check out.</p>
    </div>
  );
}

function TopCustomers({ orders }: { orders: StoredOrder[] }) {
  const map = new Map<string, { name: string; phone: string; count: number; total: number }>();
  for (const o of orders) {
    const key = o.customer.phone || o.customer.email || o.customer.name;
    const cur = map.get(key) ?? { name: o.customer.name, phone: o.customer.phone, count: 0, total: 0 };
    cur.count += 1; cur.total += o.total;
    map.set(key, cur);
  }
  const top = Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 5);
  if (top.length === 0) return <p className="text-sm text-muted-foreground">No data yet.</p>;
  return (
    <div className="space-y-2">
      {top.map((c) => (
        <div key={c.phone + c.name} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
          <div>
            <div className="font-medium">{c.name || "—"}</div>
            <div className="text-xs text-muted-foreground">{c.phone}</div>
          </div>
          <div className="text-right">
            <div className="font-semibold">{formatNaira(c.total)}</div>
            <div className="text-xs text-muted-foreground">{c.count} {c.count === 1 ? "order" : "orders"}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function RuleBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Badge variant="secondary">{title}</Badge>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        min={0}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </div>
  );
}

function PricingEditor({ pricing }: { pricing: PricingSettings }) {
  const [draft, setDraft] = useState<PricingSettings>(pricing);
  const [saving, setSaving] = useState(false);

  // Reset draft when settings reload from realtime updates
  useEffect(() => { setDraft(pricing); }, [pricing]);

  function up<K extends keyof PricingSettings>(k: K, v: PricingSettings[K]) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  function updateZone(idx: number, patch: Partial<ZoneSetting>) {
    setDraft((d) => ({ ...d, zones: d.zones.map((z, i) => (i === idx ? { ...z, ...patch } : z)) }));
  }
  function removeZone(idx: number) {
    setDraft((d) => ({ ...d, zones: d.zones.filter((_, i) => i !== idx) }));
  }
  function addZone() {
    setDraft((d) => ({
      ...d,
      zones: [...d.zones, { value: `zone_${Date.now().toString(36)}`, label: "New zone", fee: 1000, eta: "1 day", active: true }],
    }));
  }

  async function save() {
    setSaving(true);
    try {
      await saveSetting("pricing", draft);
      toast.success("Pricing updated — changes are live");
    } catch (e) {
      console.error(e);
      toast.error("Could not save pricing");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Pricing rules</CardTitle>
        <Button onClick={save} disabled={saving} size="sm">
          {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />} Save changes
        </Button>
      </CardHeader>
      <CardContent className="space-y-8">
        <section>
          <h3 className="text-sm font-semibold mb-3">Base per-page rate (₦)</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <NumField label="Black & white" value={draft.baseBW} onChange={(n) => up("baseBW", n)} />
            <NumField label="Full color" value={draft.baseColor} onChange={(n) => up("baseColor", n)} />
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold mb-3">Paper surcharge (₦ per sheet)</h3>
          <div className="grid sm:grid-cols-4 gap-3">
            {(Object.keys(draft.paperSurcharge) as Array<keyof PricingSettings["paperSurcharge"]>).map((k) => (
              <NumField key={k} label={k} value={draft.paperSurcharge[k]} onChange={(n) => up("paperSurcharge", { ...draft.paperSurcharge, [k]: n })} />
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold mb-3">Binding (₦ per copy)</h3>
          <div className="grid sm:grid-cols-4 gap-3">
            {(Object.keys(draft.bindingFlat) as Array<keyof PricingSettings["bindingFlat"]>).map((k) => (
              <NumField key={k} label={k} value={draft.bindingFlat[k]} onChange={(n) => up("bindingFlat", { ...draft.bindingFlat, [k]: n })} />
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold mb-3">Cover (₦ per copy)</h3>
          <div className="grid sm:grid-cols-4 gap-3">
            {(Object.keys(draft.coverFlat) as Array<keyof PricingSettings["coverFlat"]>).map((k) => (
              <NumField key={k} label={k} value={draft.coverFlat[k]} onChange={(n) => up("coverFlat", { ...draft.coverFlat, [k]: n })} />
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Delivery zones</h3>
            <Button size="sm" variant="outline" onClick={addZone}><Plus className="h-4 w-4 mr-1" /> Add zone</Button>
          </div>
          <div className="space-y-2">
            {draft.zones.map((z, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end rounded-md border border-border p-3">
                <div className="col-span-12 sm:col-span-4 space-y-1.5">
                  <Label className="text-xs">Label</Label>
                  <Input value={z.label} onChange={(e) => updateZone(idx, { label: e.target.value })} />
                </div>
                <div className="col-span-6 sm:col-span-2 space-y-1.5">
                  <Label className="text-xs">Fee (₦)</Label>
                  <Input type="number" min={0} value={z.fee} onChange={(e) => updateZone(idx, { fee: Number(e.target.value) || 0 })} />
                </div>
                <div className="col-span-6 sm:col-span-2 space-y-1.5">
                  <Label className="text-xs">ETA</Label>
                  <Input value={z.eta} onChange={(e) => updateZone(idx, { eta: e.target.value })} />
                </div>
                <div className="col-span-6 sm:col-span-2 space-y-1.5">
                  <Label className="text-xs">Key</Label>
                  <Input value={z.value} onChange={(e) => updateZone(idx, { value: e.target.value.replace(/\s+/g, "_") })} />
                </div>
                <div className="col-span-4 sm:col-span-1 flex flex-col items-center gap-1">
                  <Label className="text-xs">Active</Label>
                  <Switch checked={z.active} onCheckedChange={(v) => updateZone(idx, { active: v })} />
                </div>
                <div className="col-span-2 sm:col-span-1 flex justify-end">
                  <Button variant="ghost" size="icon" onClick={() => removeZone(idx)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </CardContent>
    </Card>
  );
}

function SiteSettingsEditor({ site }: { site: SiteSettings }) {
  const [draft, setDraft] = useState<SiteSettings>(site);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setDraft(site); }, [site]);

  async function save() {
    setSaving(true);
    try {
      await saveSetting("site", draft);
      toast.success("Site settings updated");
    } catch (e) {
      console.error(e);
      toast.error("Could not save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Site settings</CardTitle>
        <Button onClick={save} disabled={saving} size="sm">
          {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />} Save changes
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 max-w-xl">
        <div className="space-y-2">
          <Label>Hero badge text</Label>
          <Input value={draft.heroBadge} onChange={(e) => setDraft((d) => ({ ...d, heroBadge: e.target.value }))} />
          <p className="text-xs text-muted-foreground">Shown at the top of the homepage hero. e.g. "Active in Ibadan · Ekiti coming soon"</p>
        </div>
      </CardContent>
    </Card>
  );
}

// Suppress unused-import warnings for icons that exist for future use
void CheckCircle2; void Truck;
// Keep Rule symbol referenced even though it's not currently rendered
function Rule({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between rounded-md border border-border px-3 py-2 text-xs">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}
void Rule;
