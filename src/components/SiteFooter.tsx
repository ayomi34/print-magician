import { Printer } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { EMAIL, PHONE_DISPLAY, PHONE_TEL, WHATSAPP_URL } from "@/lib/contact";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border/60 bg-secondary/40">
      <div className="container mx-auto px-4 py-12 grid gap-8 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-md text-primary-foreground"
              style={{ background: "var(--gradient-primary)" }}
            >
              <Printer className="h-4 w-4" />
            </span>
            <span className="font-bold">PrintFlow</span>
          </div>
          <p className="text-sm text-muted-foreground max-w-xs">
            Professional web-to-print platform. Upload, configure, and we deliver.
          </p>
        </div>
        <div>
          <h4 className="font-semibold mb-3 text-sm">Product</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/order" className="hover:text-foreground">Place an order</Link></li>
            <li><Link to="/track" className="hover:text-foreground">Track order</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold mb-3 text-sm">Help</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/support" className="hover:text-foreground">Contact support</Link></li>
            <li><a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="hover:text-foreground">WhatsApp: {PHONE_DISPLAY}</a></li>
            <li><a href={PHONE_TEL} className="hover:text-foreground">Call {PHONE_DISPLAY}</a></li>
            <li><a href={`mailto:${EMAIL}`} className="hover:text-foreground">{EMAIL}</a></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold mb-3 text-sm">Trust</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Secure file uploads</li>
            <li>Files auto-deleted after 7 days</li>
            <li>Paystack & Flutterwave payments</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} PrintFlow. All rights reserved.
      </div>
    </footer>
  );
}
