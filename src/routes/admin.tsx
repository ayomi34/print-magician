import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  Clock,
  Download,
  Package,
  Printer as PrinterIcon,
  Search,
  Trash2,
  TrendingUp,
  Truck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { formatNaira, IBADAN_ZONES } from "@/lib/pricing";

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

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [orders, setOrders] = useState<StoredOrder[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");

  function refresh() { setOrders(loadOrders()); }
  useEffect(() => { refresh(); }, []);

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

  function handleStatus(id: string, status: OrderStatus) {
    updateOrderStatus(id, status);
    refresh();
    toast.success(`Order ${id} → ${STATUS_LABELS[status]}`);
  }
  function handleDelete(id: string) {
    if (!confirm(`Delete order ${id}? This can't be undone.`)) return;
    deleteOrder(id);
    refresh();
    toast.success("Order deleted");
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
          <Button variant="ghost" size="sm" onClick={onLogout}><LogOut className="mr-1 h-4 w-4" /> Sign out</Button>
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
          <TabsTrigger value="pricing"><PrinterIcon className="h-4 w-4 mr-1" /> Pricing rules</TabsTrigger>
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
                                <div className="text-muted-foreground">{IBADAN_ZONES.find((z) => z.value === o.config.zone)?.label ?? "—"}</div>
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
          <Card>
            <CardHeader>
              <CardTitle>Pricing rules</CardTitle>
              <p className="text-xs text-muted-foreground">Read-only preview. Editing rules will be enabled with Lovable Cloud.</p>
            </CardHeader>
            <CardContent className="space-y-6 text-sm">
              <RuleBlock title="Base per-page rate">
                <Rule k="Black & white" v="₦30 / page" />
                <Rule k="Full color" v="₦100 / page" />
              </RuleBlock>
              <RuleBlock title="Bulk discounts">
                <Rule k="50–499 pages" v="15% off per page" />
                <Rule k="500–999 pages" v="25% off per page" />
                <Rule k="1000+ pages" v="Flat ₦20 / page" />
              </RuleBlock>
              <RuleBlock title="Surcharges">
                <Rule k="Matte paper" v="+₦15 / sheet" />
                <Rule k="Glossy paper" v="+₦25 / sheet" />
                <Rule k="Cardstock" v="+₦40 / sheet" />
                <Rule k="Stapled" v="+₦100" />
                <Rule k="Spiral binding" v="+₦800" />
                <Rule k="Hardcover" v="+₦3,500" />
              </RuleBlock>
              <RuleBlock title="Ibadan delivery zones">
                <div className="grid sm:grid-cols-2 gap-2">
                  {IBADAN_ZONES.map((z) => (
                    <div key={z.value} className="flex justify-between rounded-md border border-border px-3 py-2 text-xs">
                      <span>{z.label}</span>
                      <span className="font-medium">{formatNaira(z.fee)} · {z.eta}</span>
                    </div>
                  ))}
                </div>
              </RuleBlock>
            </CardContent>
          </Card>
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

function Rule({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between rounded-md border border-border px-3 py-2 text-xs">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}

// Suppress unused-import warnings for icons that exist for future use
void CheckCircle2; void Truck;
