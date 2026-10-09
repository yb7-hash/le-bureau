import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Le Bureau",
  description: "Une équipe d'agents IA qui cherche un emploi, en pixel art.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
