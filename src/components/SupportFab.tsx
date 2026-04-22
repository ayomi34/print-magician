import { MessageCircle } from "lucide-react";

export function SupportFab() {
  return (
    <a
      href="https://wa.me/2348000000000"
      target="_blank"
      rel="noreferrer"
      aria-label="Chat with support on WhatsApp"
      className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-[var(--shadow-elegant)] transition-transform hover:scale-105"
      style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}
    >
      <MessageCircle className="h-6 w-6" />
    </a>
  );
}
