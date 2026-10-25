import type { ReactNode } from "react";
import "./globals.css";
import "./live.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Nexus — Agency workspace",
  description: "One place for your agency's projects, people, and progress.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
