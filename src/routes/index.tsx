import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Upload, Settings2, CreditCard, Truck, ShieldCheck, Clock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SupportFab } from "@/components/SupportFab";
import { useSettings } from "@/lib/settings";
import heroImg from "@/assets/hero-print.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PrintFlow — Web-to-Print Platform | Upload, Configure, Deliver" },
      { name: "description", content: "Upload documents, choose options, pay securely with Paystack. Fast printing & delivery across Nigeria. From ₦20/page in bulk." },
      { property: "og:title", content: "PrintFlow — Professional Web-to-Print" },
      { property: "og:description", content: "Upload, configure and order prints in minutes. Paystack & Flutterwave supported." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { site, pricing } = useSettings();
  const bulkPrice = Math.min(pricing.baseBW, 20);
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            className="absolute inset-0 -z-10"
            style={{ background: "var(--gradient-hero)" }}
          />
          <div className="absolute inset-0 -z-10 opacity-[0.07] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:24px_24px]" />
          <div className="container mx-auto px-4 py-20 md:py-28 grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-primary-foreground">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur px-3 py-1 text-xs font-medium ring-1 ring-white/20">
                <Sparkles className="h-3.5 w-3.5" /> {site.heroBadge}
              </span>
              <h1 className="mt-5 text-4xl md:text-6xl font-bold tracking-tight leading-[1.05]">
                Printing made <span className="text-transparent bg-clip-text" style={{ backgroundImage: "linear-gradient(135deg,#fff,#bcd3ff)" }}>effortless.</span>
              </h1>
              <p className="mt-5 text-lg text-white/80 max-w-xl">
                Upload your file, pick your options, pay securely. We handle the rest — from crisp B&W copies to premium hardcover bound books.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" variant="secondary" className="font-semibold shadow-[var(--shadow-elegant)]">
                  <Link to="/order">Start your order <ArrowRight className="ml-1 h-4 w-4" /></Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white">
                  <Link to="/track">Track an order</Link>
                </Button>
              </div>
              <div className="mt-10 flex flex-wrap gap-6 text-sm text-white/75">
                <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Secure file uploads</div>
                <div className="flex items-center gap-2"><Clock className="h-4 w-4" /> Same-day pickup available</div>
              </div>
            </div>
            <div className="relative">
              <div className="absolute -inset-4 rounded-3xl bg-white/10 blur-2xl" />
              <img
                src={heroImg}
                alt="High-end commercial printer producing color documents"
                width={1536}
                height={1024}
                className="relative w-full rounded-2xl shadow-[var(--shadow-elegant)] ring-1 ring-white/20"
              />
              <div className="absolute -bottom-5 -left-5 hidden md:block bg-card text-card-foreground rounded-xl shadow-[var(--shadow-elegant)] p-4 ring-1 ring-border">
                <div className="text-xs text-muted-foreground">Bulk price from</div>
                <div className="text-2xl font-bold">₦20<span className="text-sm font-normal text-muted-foreground">/page</span></div>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="container mx-auto px-4 py-20">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Order in 4 simple steps</h2>
            <p className="mt-3 text-muted-foreground">No accounts. No friction. Just printing.</p>
          </div>
          <div className="grid md:grid-cols-4 gap-5">
            {[
              { icon: Upload, title: "Upload", desc: "PDF, DOCX or images up to 50MB." },
              { icon: Settings2, title: "Configure", desc: "Color, sides, paper, binding & cover." },
              { icon: CreditCard, title: "Pay", desc: "Secure checkout with Paystack." },
              { icon: Truck, title: "Receive", desc: "Pickup or doorstep delivery." },
            ].map((s, i) => (
              <div key={s.title} className="relative rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] transition hover:-translate-y-1 hover:shadow-[var(--shadow-elegant)]">
                <div className="absolute -top-3 -right-3 h-8 w-8 rounded-full bg-primary text-primary-foreground text-sm font-bold grid place-items-center shadow-[var(--shadow-card)]">
                  {i + 1}
                </div>
                <div
                  className="h-11 w-11 rounded-xl grid place-items-center text-primary-foreground mb-4"
                  style={{ background: "var(--gradient-primary)" }}
                >
                  <s.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold">{s.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing teaser */}
        <section className="container mx-auto px-4 pb-20">
          <div className="rounded-3xl p-10 md:p-14 text-primary-foreground relative overflow-hidden" style={{ background: "var(--gradient-primary)" }}>
            <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:20px_20px]" />
            <div className="relative grid md:grid-cols-3 gap-8 items-center">
              <div className="md:col-span-2">
                <h2 className="text-3xl md:text-4xl font-bold">Transparent bulk pricing</h2>
                <p className="mt-3 text-white/85 max-w-xl">Pay less as you print more. From ₦30/page for B&W down to ₦20/page on orders of 1,000+ pages.</p>
              </div>
              <div className="flex md:justify-end">
                <Button asChild size="lg" variant="secondary" className="font-semibold">
                  <Link to="/order">Calculate your price <ArrowRight className="ml-1 h-4 w-4" /></Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
      <SupportFab />
    </div>
  );
}
