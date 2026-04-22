import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
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
  IBADAN_ZONES,
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
import { countPages } from "@/lib/countPages";
import { toast } from "sonner";

export const Route = createFileRoute("/order")({
  head: () => ({
    meta: [
      { title: "Place an Order — PrintFlow" },
      { name: "description", content: "Upload your file, configure print options, and check out securely." },
      { property: "og:title", content: "Place an Order — PrintFlow" },
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
}

interface CustomerInfo {
  name: string;
  phone: string;
  email: string;
  notes: string;
}

function OrderPage() {
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<UploadedFile | null>(null);
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

  const breakdown = useMemo(() => calculatePrice(config), [config]);

  function next() {
    if (step === 0) {
      if (!file) { toast.error("Please upload a file first"); return; }
      if (file.detecting) { toast.error("Still detecting page count…"); return; }
      if (!file.pages) { toast.error(file.countError || "Could not detect page count"); return; }
    }
    if (step === 3) { return submitOrder(); }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }
  function prev() { setStep((s) => Math.max(s - 1, 0)); }

  function submitOrder() {
    if (!customer.name || !customer.phone) { toast.error("Name and phone are required"); return; }
    if (config.delivery === "delivery" && !config.zone) { toast.error("Please pick a delivery zone in Ibadan"); return; }
    setSubmitting(true);
    setTimeout(() => {
      const orderId = "PF-" + Math.random().toString(36).slice(2, 8).toUpperCase();
      toast.success("Order placed! ID: " + orderId);
      setSubmitting(false);
    }, 1200);
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-secondary/40 to-background">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-8 md:py-12">
        <div className="max-w-5xl mx-auto">
          <Stepper step={step} />

          <div className="mt-8 grid lg:grid-cols-[1fr_360px] gap-8 items-start">
            <div className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-[var(--shadow-card)]">
              {step === 0 && <StepUpload file={file} setFile={setFile} setConfig={setConfig} />}
              {step === 1 && <StepConfigure config={config} setConfig={setConfig} />}
              {step === 2 && <StepReview file={file} config={config} />}
              {step === 3 && <StepCheckout customer={customer} setCustomer={setCustomer} delivery={config.delivery} setDelivery={(d) => setConfig((c) => ({ ...c, delivery: d, zone: d === "delivery" ? c.zone : undefined }))} zone={config.zone} setZone={(z) => setConfig((c) => ({ ...c, zone: z }))} />}

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

            <SummaryCard config={config} file={file} />
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

function StepUpload({ file, setFile, setConfig }: { file: UploadedFile | null; setFile: (f: UploadedFile | null) => void; setConfig: React.Dispatch<React.SetStateAction<PrintConfig>>; }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  async function handleFiles(files: FileList | null) {
    const f = files?.[0]; if (!f) return;
    const allowed = ["application/pdf", "image/png", "image/jpeg", "image/webp", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword"];
    if (!allowed.includes(f.type) && !f.name.match(/\.(pdf|docx?|png|jpe?g|webp)$/i)) { toast.error("Unsupported file type"); return; }
    if (f.size > 50 * 1024 * 1024) { toast.error("Max 50MB"); return; }
    const previewUrl = f.type.startsWith("image/") || f.type === "application/pdf" ? URL.createObjectURL(f) : undefined;

    // Show file immediately with detecting state
    setFile({ name: f.name, size: f.size, type: f.type, previewUrl, pages: null, detecting: true });

    const result = await countPages(f);
    if (result.ok) {
      setFile({ name: f.name, size: f.size, type: f.type, previewUrl, pages: result.pages, detecting: false, countMethod: result.method });
      setConfig((c) => ({ ...c, pages: result.pages }));
      toast.success(`Detected ${result.pages} page${result.pages > 1 ? "s" : ""}`);
    } else {
      setFile({ name: f.name, size: f.size, type: f.type, previewUrl, pages: null, detecting: false, countError: result.reason });
      toast.error(result.reason);
    }
  }

  return (
    <div>
      <h2 className="text-xl font-bold">Upload your file</h2>
      <p className="text-sm text-muted-foreground mt-1">PDF, DOCX or images up to 50MB.</p>

      {!file ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
          className={["mt-6 w-full rounded-2xl border-2 border-dashed p-10 text-center transition", dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-secondary/40"].join(" ")}
        >
          <div className="mx-auto h-14 w-14 rounded-xl grid place-items-center text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>
            <UploadIcon className="h-6 w-6" />
          </div>
          <div className="mt-4 font-semibold">Drag & drop or click to upload</div>
          <div className="mt-1 text-xs text-muted-foreground">PDF, DOCX, PNG, JPG · Max 50MB</div>
        </button>
      ) : (
        <div className="mt-6 rounded-2xl border border-border p-4 flex gap-4 items-center">
          <div className="h-20 w-20 rounded-lg overflow-hidden bg-muted grid place-items-center shrink-0">
            {file.previewUrl && file.type.startsWith("image/") ? (
              <img src={file.previewUrl} alt={file.name} className="h-full w-full object-cover" />
            ) : (
              <FileText className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium truncate">{file.name}</div>
            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
              <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
              <span>·</span>
              {file.detecting ? (
                <span className="inline-flex items-center gap-1 text-primary"><Loader2 className="h-3 w-3 animate-spin" /> Detecting pages…</span>
              ) : file.pages ? (
                <span><strong className="text-foreground">{file.pages}</strong> page{file.pages > 1 ? "s" : ""} detected{file.countMethod === "pdf" ? " (exact)" : ""}</span>
              ) : (
                <span className="text-destructive">{file.countError}</span>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setFile(null)} aria-label="Remove file">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <input ref={inputRef} type="file" hidden accept=".pdf,.doc,.docx,image/*" onChange={(e) => handleFiles(e.target.files)} />
    </div>
  );
}

function StepConfigure({ config, setConfig }: { config: PrintConfig; setConfig: React.Dispatch<React.SetStateAction<PrintConfig>>; }) {
  function update<K extends keyof PrintConfig>(k: K, v: PrintConfig[K]) { setConfig((c) => ({ ...c, [k]: v })); }
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
        { value: "bw", label: "Black & White", hint: "₦30/page" },
        { value: "color", label: "Full Color", hint: "₦100/page" },
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
              <SelectItem value="matte">Matte (+₦15/sheet)</SelectItem>
              <SelectItem value="glossy">Glossy (+₦25/sheet)</SelectItem>
              <SelectItem value="cardstock">Cardstock (+₦40/sheet)</SelectItem>
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
              <SelectItem value="stapled">Stapled (+₦100)</SelectItem>
              <SelectItem value="spiral">Spiral (+₦800)</SelectItem>
              <SelectItem value="hardcover">Hardcover (+₦3,500)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Cover</Label>
          <Select value={config.cover} onValueChange={(v) => update("cover", v as Cover)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No cover</SelectItem>
              <SelectItem value="transparent">Transparent (+₦200)</SelectItem>
              <SelectItem value="card">Card cover (+₦500)</SelectItem>
              <SelectItem value="custom">Custom upload (+₦1,000)</SelectItem>
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

function StepReview({ file, config }: { file: UploadedFile | null; config: PrintConfig }) {
  const b = calculatePrice(config);
  const rows: [string, string][] = [
    ["File", file?.name ?? "—"],
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

function StepCheckout({ customer, setCustomer, delivery, setDelivery }: { customer: CustomerInfo; setCustomer: React.Dispatch<React.SetStateAction<CustomerInfo>>; delivery: Delivery; setDelivery: (d: Delivery) => void; }) {
  function up<K extends keyof CustomerInfo>(k: K, v: CustomerInfo[K]) { setCustomer((c) => ({ ...c, [k]: v })); }
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
        { value: "delivery", label: "Home delivery", hint: "+₦1,500 · 1–2 days" },
      ]} />

      {delivery === "delivery" && (
        <div className="space-y-2">
          <Label>Delivery address *</Label>
          <Textarea value={customer.address} onChange={(e) => up("address", e.target.value)} placeholder="Street, area, city, state" rows={3} />
        </div>
      )}

      <div className="space-y-2">
        <Label>Notes (optional)</Label>
        <Textarea value={customer.notes} onChange={(e) => up("notes", e.target.value)} placeholder="Any special instructions?" rows={2} />
      </div>

      <div className="rounded-xl border border-border bg-secondary/40 p-4 text-xs text-muted-foreground">
        🔒 Payments are processed securely via Paystack. We auto-delete your files 7 days after fulfillment.
      </div>
    </div>
  );
}

function SummaryCard({ config, file }: { config: PrintConfig; file: UploadedFile | null }) {
  const b = calculatePrice(config);
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
