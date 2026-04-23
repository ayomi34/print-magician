import { createFileRoute } from "@tanstack/react-router";
import { Mail, MessageCircle, Phone } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SupportFab } from "@/components/SupportFab";
import { EMAIL, PHONE_DISPLAY, PHONE_TEL, WHATSAPP_URL } from "@/lib/contact";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Support — PrintFlow" },
      { name: "description", content: "Reach the PrintFlow team via WhatsApp, email or phone." },
    ],
  }),
  component: SupportPage,
});

function SupportPage() {
  const channels = [
    { icon: MessageCircle, title: "WhatsApp chat", desc: "Fastest replies, 8am–8pm.", href: WHATSAPP_URL, cta: "Open WhatsApp" },
    { icon: Mail, title: "Email", desc: "We reply within 1 business day.", href: `mailto:${EMAIL}`, cta: EMAIL },
    { icon: Phone, title: "Phone", desc: "Mon–Sat, 9am–6pm.", href: PHONE_TEL, cta: PHONE_DISPLAY },
  ];
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-3xl">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">We're here to help</h1>
        <p className="text-muted-foreground mt-2">Pick the channel that works best for you.</p>

        <div className="mt-8 grid sm:grid-cols-3 gap-4">
          {channels.map((c) => (
            <a key={c.title} href={c.href} target={c.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] transition hover:-translate-y-1 hover:shadow-[var(--shadow-elegant)]">
              <div className="h-11 w-11 rounded-xl grid place-items-center text-primary-foreground mb-3" style={{ background: "var(--gradient-primary)" }}>
                <c.icon className="h-5 w-5" />
              </div>
              <div className="font-semibold">{c.title}</div>
              <div className="text-sm text-muted-foreground mt-1">{c.desc}</div>
              <div className="mt-3 text-sm font-medium text-primary">{c.cta}</div>
            </a>
          ))}
        </div>
      </main>
      <SiteFooter />
      <SupportFab />
    </div>
  );
}
