import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { ServiceWorker } from "@/components/ServiceWorker";

export const metadata: Metadata = {
  title: "Moonvault — your cycle, privately",
  description: "A private period tracker. Your health data is encrypted on your device before it goes anywhere.",
  referrer: "no-referrer",
  robots: { index: true, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0d0a18",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
