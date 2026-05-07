import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, FileText, Loader2, Upload as UploadIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SupportFab } from "@/components/SupportFab";
import {
  calculatePrice,
  formatNaira,
  type Binding,
  type ColorMode,
  type Cover,
  type Delivery,
  type IbadanZone,
  type PaperSize,
  type PaperType,
  type PrintConfig,
  type SideMode,
} from "@/lib/pricing";
import { useSettings, type ZoneSetting } from "@/lib/settings";
import { countPages } from "@/lib/countPages";
import { uploadPrintFile } from "@/lib/orders";
import { initPayment, verifyAndSaveOrder } from "@/lib/payments.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/order")({
  head: () => ({
    meta: [
      { title: "Place an Order — PrintSmart" },
      { name: "description", content: "Upload your file, configure print options, and check out securely." },
      { property: "og:title", content: "Place an Order — PrintSmart" },
      { property: "og:description", content: "Upload, configure and pay in minutes." },
    ],
  }),
  component: OrderPage,
});

const STEPS = ["Upload", "Configure", "Review", "Checkout"] as const;

interface UploadedFile {
  name: string;
  size: number;
  type: string;
  previewUrl?: string;
  pages: number | null; // null while detecting
  detecting: boolean;
  countMethod?: "pdf" | "image";
  countError?: string;
  raw?: File; // keep original for upload
}

interface CustomerInfo {
  name: string;
  phone: string;
  email: string;
  notes: string;
}

function OrderPage() {
  const [step, setStep] = useState(0);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [config, setConfig] = useState<PrintConfig>({
    pages: 10,
    copies: 1,
    color: "bw",
    sides: "single",
    size: "A4",
    paper: "plain",
    binding: "none",
    cover: "none",
    delivery: "pickup",
  });

  const [customer, setCustomer] = useState<CustomerInfo>({
    name: "",
    phone: "",
    email: "",
    notes: "",
  });

  const { pricing } = useSettings();
  const activeZones = useMemo(() => pricing.zones.filter((z) => z.active), [pricing.zones]);
  const breakdown = useMemo(() => calculatePrice(config, pricing), [config, pricing]);
  const navigate = useNavigate();

  // Handle Paystack callback: verify payment & save order on success
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const reference = url.searchParams.get("reference") || url.searchParams.get("trxref");
    if (!reference) return;

    let cancelled = false;
    (async () => {
      const t = toast.loading("Verifying your payment…");
      try {
        const res = await verifyAndSaveOrder({ data: { reference } });
        if (cancelled) return;
        toast.dismiss(t);
        toast.success(`Payment confirmed! Order ${res.orderId}`);
        sessionStorage.removeItem("printflow:pendingRef");
        sessionStorage.removeItem("printflow:returnTo");
        // Clean URL and route to track page
        void navigate({ to: "/track", search: { id: res.orderId } as never });
      } catch (e) {
        if (cancelled) return;
        toast.dismiss(t);
        const msg = e instanceof Error ? e.message : "Verification failed";
        toast.error(msg);
        // Clean reference from URL so the user can retry
        url.searchParams.delete("reference");
        url.searchParams.delete("trxref");
        window.history.replaceState({}, "", url.pathname + (url.search || ""));
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalPages = useMemo(() => files.reduce((sum, f) => sum + (f.pages ?? 0), 0), [files]);
  const anyDetecting = files.some((f) => f.detecting);
  const anyError = files.some((f) => !f.detecting && !f.pages);

  function next() {
    if (step === 0) {
      if (files.length === 0) { toast.error("Please upload at least one file"); return; }
      if (anyDetecting) { toast.error("Still detecting page count…"); return; }
      if (anyError) { toast.error("Some files have no detected page count. Remove them or wait."); return; }
    }
    if (step === 3) { return submitOrder(); }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }
  function prev() { setStep((s) => Math.max(s - 1, 0)); }

  async function submitOrder() {
    if (!customer.name || !customer.phone) { toast.error("Name and phone are required"); return; }
    if (!customer.email) { toast.error("Email is required for Paystack receipt"); return; }
    if (config.delivery === "delivery" && !config.zone) { toast.error("Please pick a delivery zone in Ibadan"); return; }
    setSubmitting(true);
    try {
      const combinedName =
        files.length === 0 ? "" :
        files.length === 1 ? files[0].name :
        `${files[0].name} (+${files.length - 1} more)`;
      const combinedSize = files.reduce((s, f) => s + f.size, 0);

      // 1) Initialize Paystack transaction on the server
      const init = await initPayment({
        data: {
          config,
          customer,
          fileName: combinedName,
          fileSize: combinedSize,
        },
      });

      // 2) Upload all files to storage (best-effort) using the orderId from init
      await Promise.all(
        files.map(async (f) => {
          if (!f.raw) return;
          try { await uploadPrintFile(init.orderId, f.raw); } catch (e) { console.error("Upload failed:", e); }
        }),
      );

      // 3) Open Paystack checkout (redirect to authorization_url)
      // We use the authorization_url returned by Paystack for a hosted checkout
      // — works on all browsers, no inline script needed.
      const verifyUrl = `${window.location.origin}/order?reference=${encodeURIComponent(init.reference)}`;
      sessionStorage.setItem("printflow:pendingRef", init.reference);
      sessionStorage.setItem("printflow:returnTo", verifyUrl);
      window.location.href = init.authorizationUrl;
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "Could not start payment";
      toast.error(msg);
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-secondary/40 to-background">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-8 md:py-12">
        <div className="max-w-5xl mx-auto">
          <Stepper step={step} />

          <div className="mt-8 grid lg:grid-cols-[1fr_360px] gap-8 items-start">
            <div className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-[var(--shadow-card)]">
              {step === 0 && <StepUpload files={files} setFiles={setFiles} setConfig={setConfig} totalPages={totalPages} />}
              {step === 1 && <StepConfigure config={config} setConfig={setConfig} pricing={pricing} />}
              {step === 2 && <StepReview files={files} config={config} pricing={pricing} />}
              {step === 3 && <StepCheckout customer={customer} setCustomer={setCustomer} delivery={config.delivery} setDelivery={(d) => setConfig((c) => ({ ...c, delivery: d, zone: d === "delivery" ? c.zone : undefined }))} zone={config.zone} setZone={(z) => setConfig((c) => ({ ...c, zone: z }))} zones={activeZones} />}

              <div className="mt-8 flex items-center justify-between">
                <Button variant="ghost" onClick={prev} disabled={step === 0}>
                  <ArrowLeft className="mr-1 h-4 w-4" /> Back
                </Button>
                {step < 3 ? (
                  <Button onClick={next} size="lg">
                    Continue <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                ) : (
                  <Button onClick={next} size="lg" disabled={submitting}>
                    {submitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…</>) : (<>Pay {formatNaira(breakdown.total)}</>)}
                  </Button>
                )}
              </div>
            </div>

            <SummaryCard config={config} files={files} pricing={pricing} />
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            Need help? <Link to="/support" className="underline underline-offset-2 hover:text-foreground">Talk to us</Link>
          </p>
        </div>
      </main>
      <SiteFooter />
      <SupportFab />
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <ol className="flex items-center justify-between gap-2">
      {STEPS.map((label, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <li key={label} className="flex-1 flex items-center gap-3 min-w-0">
            <div className={[
              "h-9 w-9 rounded-full grid place-items-center text-sm font-semibold shrink-0 transition",
              done ? "bg-primary text-primary-foreground" : active ? "bg-primary text-primary-foreground ring-4 ring-primary/15" : "bg-muted text-muted-foreground",
            ].join(" ")}>
              {done ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span className={["truncate text-sm font-medium", active ? "text-foreground" : "text-muted-foreground"].join(" ")}>{label}</span>
            {i < STEPS.length - 1 && <div className="hidden sm:block flex-1 h-px bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}

function StepUpload({ files, setFiles, setConfig, totalPages }: { files: UploadedFile[]; setFiles: React.Dispatch<React.SetStateAction<UploadedFile[]>>; setConfig: React.Dispatch<React.SetStateAction<PrintConfig>>; totalPages: number; }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  async function handleFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const allowed = ["application/pdf", "image/png", "image/jpeg", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword"];
    const accepted: File[] = [];
    for (const f of Array.from(list)) {
      if (!allowed.includes(f.type) && !f.name.match(/\.(pdf|docx?|png|jpe?g)$/i)) {
        toast.error(`${f.name}: unsupported type`);
        continue;
      }
      if (f.size > 50 * 1024 * 1024) {
        toast.error(`${f.name}: exceeds 50MB`);
        continue;
      }
      accepted.push(f);
    }
    if (accepted.length === 0) return;

    // Add all in detecting state
    const placeholders: UploadedFile[] = accepted.map((f) => ({
      name: f.name,
      size: f.size,
      type: f.type,
      previewUrl: f.type.startsWith("image/") || f.type === "application/pdf" ? URL.createObjectURL(f) : undefined,
      pages: null,
      detecting: true,
      raw: f,
    }));
    setFiles((prev) => [...prev, ...placeholders]);

    // Detect each file's pages and update by name+size match
    await Promise.all(
      accepted.map(async (f) => {
        const result = await countPages(f);
        setFiles((prev) =>
          prev.map((entry) => {
            if (entry.raw !== f) return entry;
            return result.ok
              ? { ...entry, pages: result.pages, detecting: false, countMethod: result.method }
              : { ...entry, pages: null, detecting: false, countError: result.reason };
          }),
        );
      }),
    );
  }

  // Sync detected total pages into the print config (sum of all files)
  useEffect(() => {
    if (totalPages > 0) {
      setConfig((c) => (c.pages === totalPages ? c : { ...c, pages: totalPages }));
    }
  }, [totalPages, setConfig]);

  function removeAt(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  return (
    <div>
      <h2 className="text-xl font-bold">Upload your files</h2>
      <p className="text-sm text-muted-foreground mt-1">PDF, DOCX, PNG or JPG up to 50MB each. You can select multiple files at once.</p>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        className={["mt-6 w-full rounded-2xl border-2 border-dashed p-8 text-center transition", dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-secondary/40"].join(" ")}
      >
        <div className="mx-auto h-14 w-14 rounded-xl grid place-items-center text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>
          <UploadIcon className="h-6 w-6" />
        </div>
        <div className="mt-4 font-semibold">{files.length === 0 ? "Drag & drop or click to upload" : "Add more files"}</div>
        <div className="mt-1 text-xs text-muted-foreground">PDF, DOCX, PNG, JPG · Multiple files allowed · Max 50MB each</div>
      </button>

      {files.length > 0 && (
        <div className="mt-4 space-y-3">
          {files.map((file, idx) => (
            <div key={idx} className="rounded-xl border border-border p-3 flex gap-3 items-center">
              <div className="h-14 w-14 rounded-lg overflow-hidden bg-muted grid place-items-center shrink-0">
                {file.previewUrl && file.type.startsWith("image/") ? (
                  <img src={file.previewUrl} alt={file.name} className="h-full w-full object-cover" />
                ) : (
                  <FileText className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate text-sm">{file.name}</div>
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                  <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                  <span>·</span>
                  {file.detecting ? (
                    <span className="inline-flex items-center gap-1 text-primary"><Loader2 className="h-3 w-3 animate-spin" /> Detecting…</span>
                  ) : file.pages ? (
                    <span><strong className="text-foreground">{file.pages}</strong> page{file.pages > 1 ? "s" : ""}{file.countMethod === "pdf" ? " (exact)" : ""}</span>
                  ) : (
                    <span className="text-destructive">{file.countError}</span>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeAt(idx)} aria-label="Remove file">
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <div className="flex justify-between rounded-xl bg-secondary/60 px-4 py-3 text-sm">
            <span className="text-muted-foreground">{files.length} file{files.length > 1 ? "s" : ""}</span>
            <span className="font-medium">{totalPages} page{totalPages === 1 ? "" : "s"} total</span>
          </div>
        </div>
      )}

      <input ref={inputRef} type="file" hidden multiple accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg" onChange={(e) => handleFiles(e.target.files)} />
    </div>
  );
}

function StepConfigure({ config, setConfig, pricing }: { config: PrintConfig; setConfig: React.Dispatch<React.SetStateAction<PrintConfig>>; pricing: import("@/lib/settings").PricingSettings; }) {
  function update<K extends keyof PrintConfig>(k: K, v: PrintConfig[K]) { setConfig((c) => ({ ...c, [k]: v })); }
  const ps = pricing.paperSurcharge;
  const bf = pricing.bindingFlat;
  const cf = pricing.coverFlat;
  const fmt = (n: number) => "₦" + Math.round(n).toLocaleString("en-NG");
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Configure your print</h2>
        <p className="text-sm text-muted-foreground mt-1">Adjust to match exactly what you need.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <div className="space-y-2">
          <Label>Pages per copy</Label>
          <Input type="number" min={1} value={config.pages} onChange={(e) => update("pages", Math.max(1, parseInt(e.target.value || "1")))} />
        </div>
        <div className="space-y-2">
          <Label>Copies</Label>
          <Input type="number" min={1} value={config.copies} onChange={(e) => update("copies", Math.max(1, parseInt(e.target.value || "1")))} />
        </div>
      </div>

      <ChoiceGroup label="Color mode" value={config.color} onChange={(v) => update("color", v as ColorMode)} options={[
        { value: "bw", label: "Black & White", hint: `₦${pricing.baseBW}/page` },
        { value: "color", label: "Full Color", hint: `₦${pricing.baseColor}/page` },
      ]} />

      <ChoiceGroup label="Printing type" value={config.sides} onChange={(v) => update("sides", v as SideMode)} options={[
        { value: "single", label: "Single-sided" },
        { value: "double", label: "Double-sided", hint: "Saves paper" },
      ]} />

      <div className="grid sm:grid-cols-2 gap-5">
        <div className="space-y-2">
          <Label>Paper size</Label>
          <Select value={config.size} onValueChange={(v) => update("size", v as PaperSize)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="A4">A4</SelectItem>
              <SelectItem value="A5">A5</SelectItem>
              <SelectItem value="Letter">Letter</SelectItem>
              <SelectItem value="Legal">Legal</SelectItem>
              <SelectItem value="Custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Paper type</Label>
          <Select value={config.paper} onValueChange={(v) => update("paper", v as PaperType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="plain">Plain</SelectItem>
              <SelectItem value="matte">Matte (+{fmt(ps.matte)}/sheet)</SelectItem>
              <SelectItem value="glossy">Glossy (+{fmt(ps.glossy)}/sheet)</SelectItem>
              <SelectItem value="cardstock">Cardstock (+{fmt(ps.cardstock)}/sheet)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <div className="space-y-2">
          <Label>Binding</Label>
          <Select value={config.binding} onValueChange={(v) => update("binding", v as Binding)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="stapled">Stapled (+{fmt(bf.stapled)})</SelectItem>
              <SelectItem value="spiral">Spiral (+{fmt(bf.spiral)})</SelectItem>
              <SelectItem value="hardcover">Hardcover (+{fmt(bf.hardcover)})</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Cover</Label>
          <Select value={config.cover} onValueChange={(v) => update("cover", v as Cover)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No cover</SelectItem>
              <SelectItem value="transparent">Transparent (+{fmt(cf.transparent)})</SelectItem>
              <SelectItem value="card">Card cover (+{fmt(cf.card)})</SelectItem>
              <SelectItem value="custom">Custom upload (+{fmt(cf.custom)})</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

function ChoiceGroup({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string; hint?: string }[] }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <RadioGroup value={value} onValueChange={onChange} className="grid sm:grid-cols-2 gap-3">
        {options.map((o) => (
          <Label key={o.value} htmlFor={`${label}-${o.value}`} className={[
            "flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition",
            value === o.value ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:bg-secondary/50",
          ].join(" ")}>
            <RadioGroupItem id={`${label}-${o.value}`} value={o.value} />
            <span className="flex-1">
              <span className="block font-medium text-sm">{o.label}</span>
              {o.hint && <span className="block text-xs text-muted-foreground">{o.hint}</span>}
            </span>
          </Label>
        ))}
      </RadioGroup>
    </div>
  );
}

function StepReview({ files, config, pricing }: { files: UploadedFile[]; config: PrintConfig; pricing: import("@/lib/settings").PricingSettings }) {
  const b = calculatePrice(config, pricing);
  const fileLabel =
    files.length === 0 ? "—" :
    files.length === 1 ? files[0].name :
    `${files.length} files (${files.map((f) => f.name).join(", ").slice(0, 80)}${files.map((f) => f.name).join(", ").length > 80 ? "…" : ""})`;
  const rows: [string, string][] = [
    ["Files", fileLabel],
    ["Pages × Copies", `${config.pages} × ${config.copies}`],
    ["Color", config.color === "bw" ? "Black & White" : "Full Color"],
    ["Sides", config.sides === "single" ? "Single-sided" : "Double-sided"],
    ["Paper", `${config.size} · ${config.paper}`],
    ["Binding", config.binding],
    ["Cover", config.cover],
  ];
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Review your order</h2>
        <p className="text-sm text-muted-foreground mt-1">Make sure everything looks right.</p>
      </div>
      <dl className="rounded-xl border border-border divide-y divide-border">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between px-4 py-3 text-sm">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-medium capitalize text-right max-w-[60%] truncate">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="rounded-xl bg-secondary/60 p-4">
        <div className="flex justify-between text-sm"><span>Pages cost</span><span>{formatNaira(b.pagesTotal)}</span></div>
        {b.paperSurcharge > 0 && <div className="flex justify-between text-sm mt-1"><span>Paper upgrade</span><span>{formatNaira(b.paperSurcharge)}</span></div>}
        {b.bindingTotal > 0 && <div className="flex justify-between text-sm mt-1"><span>Binding</span><span>{formatNaira(b.bindingTotal)}</span></div>}
        {b.coverTotal > 0 && <div className="flex justify-between text-sm mt-1"><span>Cover</span><span>{formatNaira(b.coverTotal)}</span></div>}
        {b.deliveryFee > 0 && <div className="flex justify-between text-sm mt-1"><span>Delivery</span><span>{formatNaira(b.deliveryFee)}</span></div>}
        <Separator className="my-3" />
        <div className="flex justify-between font-bold text-base"><span>Total</span><span>{formatNaira(b.total)}</span></div>
      </div>
    </div>
  );
}

function StepCheckout({ customer, setCustomer, delivery, setDelivery, zone, setZone, zones }: { customer: CustomerInfo; setCustomer: React.Dispatch<React.SetStateAction<CustomerInfo>>; delivery: Delivery; setDelivery: (d: Delivery) => void; zone: IbadanZone | undefined; setZone: (z: IbadanZone) => void; zones: ZoneSetting[] }) {
  function up<K extends keyof CustomerInfo>(k: K, v: CustomerInfo[K]) { setCustomer((c) => ({ ...c, [k]: v })); }
  const selectedZone = zones.find((z) => z.value === zone);
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Your details</h2>
        <p className="text-sm text-muted-foreground mt-1">No account needed — guest checkout.</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Full name *</Label><Input value={customer.name} onChange={(e) => up("name", e.target.value)} placeholder="Ada Lovelace" /></div>
        <div className="space-y-2"><Label>Phone *</Label><Input type="tel" value={customer.phone} onChange={(e) => up("phone", e.target.value)} placeholder="0801 234 5678" /></div>
        <div className="space-y-2 sm:col-span-2"><Label>Email</Label><Input type="email" value={customer.email} onChange={(e) => up("email", e.target.value)} placeholder="you@example.com" /></div>
      </div>

      <ChoiceGroup label="Fulfillment" value={delivery} onChange={(v) => setDelivery(v as Delivery)} options={[
        { value: "pickup", label: "Store pickup", hint: "Free · Ready in 2–4h" },
        { value: "delivery", label: "Delivery (Ibadan only)", hint: "Fee depends on zone" },
      ]} />

      {delivery === "delivery" && (
        <div className="space-y-2">
          <Label>Delivery zone *</Label>
          <Select value={zone ?? ""} onValueChange={(v) => setZone(v as IbadanZone)}>
            <SelectTrigger><SelectValue placeholder="Select your area" /></SelectTrigger>
            <SelectContent>
              {zones.map((z) => (
                <SelectItem key={z.value} value={z.value}>
                  {z.label} — {formatNaira(z.fee)} · {z.eta}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedZone ? (
            <p className="text-xs text-muted-foreground">Fee: <span className="font-medium text-foreground">{formatNaira(selectedZone.fee)}</span> · ETA: {selectedZone.eta}</p>
          ) : (
            <p className="text-xs text-muted-foreground">Pick a delivery area to see the fee.</p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label>Notes (optional)</Label>
        <Textarea value={customer.notes} onChange={(e) => up("notes", e.target.value)} placeholder="Landmark, gate code, special instructions?" rows={2} />
      </div>

      <div className="rounded-xl border border-border bg-secondary/40 p-4 text-xs text-muted-foreground">
        🔒 Payments are processed securely via Paystack. We auto-delete your files 7 days after fulfillment.
      </div>
    </div>
  );
}

function SummaryCard({ config, file, pricing }: { config: PrintConfig; file: UploadedFile | null; pricing: import("@/lib/settings").PricingSettings }) {
  const b = calculatePrice(config, pricing);
  return (
    <aside className="lg:sticky lg:top-24 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <h3 className="font-semibold">Order summary</h3>
      {file && <p className="mt-1 text-xs text-muted-foreground truncate">{file.name}</p>}
      <Separator className="my-4" />
      <dl className="space-y-2 text-sm">
        <Row label={`${config.pages} pages × ${config.copies} ${config.copies === 1 ? "copy" : "copies"}`} value={formatNaira(b.pagesTotal)} />
        {b.paperSurcharge > 0 && <Row label="Paper upgrade" value={formatNaira(b.paperSurcharge)} />}
        {b.bindingTotal > 0 && <Row label="Binding" value={formatNaira(b.bindingTotal)} />}
        {b.coverTotal > 0 && <Row label="Cover" value={formatNaira(b.coverTotal)} />}
        {b.deliveryFee > 0 && <Row label="Delivery" value={formatNaira(b.deliveryFee)} />}
      </dl>
      <Separator className="my-4" />
      <div className="flex items-end justify-between">
        <span className="text-sm text-muted-foreground">Total</span>
        <span className="text-2xl font-bold">{formatNaira(b.total)}</span>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Per-page rate: {formatNaira(b.perPage)} · auto-discounted for bulk orders.</p>
    </aside>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground truncate">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
