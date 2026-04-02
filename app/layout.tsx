import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Status-based WhatsApp SaaS",
  description: "Multi-tenant status-based communication platform"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
