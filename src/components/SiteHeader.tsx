import { Link, useNavigate } from "@tanstack/react-router";
import { Printer, LogOut, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export function SiteHeader() {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    void navigate({ to: "/" });
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 group">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-lg text-primary-foreground shadow-[var(--shadow-card)]"
            style={{ background: "var(--gradient-primary)" }}
          >
            <Printer className="h-5 w-5" />
          </span>
          <span className="font-bold text-lg tracking-tight">PrintSmart</span>
        </Link>
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-muted-foreground">
          <Link to="/" className="hover:text-foreground transition-colors" activeOptions={{ exact: true }} activeProps={{ className: "text-foreground" }}>
            Home
          </Link>
          <Link to="/order" className="hover:text-foreground transition-colors" activeProps={{ className: "text-foreground" }}>
            Order
          </Link>
          <Link to="/track" className="hover:text-foreground transition-colors" activeProps={{ className: "text-foreground" }}>
            Track
          </Link>
          <Link to="/support" className="hover:text-foreground transition-colors" activeProps={{ className: "text-foreground" }}>
            Support
          </Link>
          {isAdmin && (
            <Link to="/admin" className="hover:text-foreground transition-colors inline-flex items-center gap-1" activeProps={{ className: "text-foreground" }}>
              <Shield className="h-3.5 w-3.5" /> Admin
            </Link>
          )}
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="hidden sm:inline-flex">
              <LogOut className="h-4 w-4 mr-1" /> Sign out
            </Button>
          ) : (
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link to="/auth">Sign in</Link>
            </Button>
          )}
          <Button asChild size="sm" className="shadow-[var(--shadow-card)]">
            <Link to="/order">Start order</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
