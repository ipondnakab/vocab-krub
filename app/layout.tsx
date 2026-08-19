import type { Metadata } from "next";
import { Press_Start_2P, Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

/**
 * T010 — Fonts, per research R-016.
 *
 * Two faces, deliberately:
 *
 *   display — pixel face for headings, RPG chrome, and numbers. Latin only.
 *   text    — everything the player reads. MUST carry complete Thai coverage
 *             (U+0E00–U+0E7F) including combining vowels and tone marks.
 *
 * Noto Sans Thai is used for body text because no pixel font we could find stacks Thai
 * marks correctly, and the asset contract is explicit that broken glyphs are never an
 * acceptable trade for style. This is the documented fallback in
 * contracts/asset-contract.md § 8, not an oversight.
 *
 * Thai stacks a tone mark ABOVE an upper vowel ABOVE the base glyph. Verify rendering with
 * a word that actually stacks (เพื่อน, ครับ, ที่) — a plain Thai string will look fine even
 * when mark positioning is broken.
 */
const display = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const text = Noto_Sans_Thai({
  weight: ["400", "600", "700"],
  subsets: ["thai", "latin"],
  variable: "--font-text",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Vocab Krub",
  description:
    "A 2D JRPG where your knowledge is your weapon. Restore the forgotten words and discover the truth behind The Silence.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${display.variable} ${text.variable}`}>
      <body>{children}</body>
    </html>
  );
}
