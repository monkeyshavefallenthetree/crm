import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MFT CRM — Lead Management",
  description: "CRM system for MFT Marketing Agency — manage leads, track status, and collaborate.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
