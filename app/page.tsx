import Link from "next/link";

/**
 * T001 — Landing page.
 *
 * Server-rendered. The game itself lives at /play and mounts Phaser client-side only
 * (research R-013); nothing on this page may import Phaser.
 */
export default function Home() {
  return (
    <main
      style={{
        minHeight: "100%",
        display: "grid",
        placeItems: "center",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: "42rem" }}>
        <h1 style={{ fontSize: "clamp(1.5rem, 5vw, 2.5rem)", marginBottom: "1.5rem" }}>
          Vocab Krub
        </h1>
        <p style={{ color: "var(--ink-dim)", marginBottom: "0.75rem" }}>
          คำที่ถูกลืมกำลังกลายเป็นปีศาจ — คุณคือผู้พิทักษ์คำ
        </p>
        <p style={{ color: "var(--ink-dim)", marginBottom: "2rem" }}>
          The forgotten words are turning into monsters. You are a Word Keeper. Your knowledge
          is your weapon.
        </p>
        <Link href="/play" style={{ fontFamily: "var(--font-display)", fontSize: "0.75rem" }}>
          ▶ เริ่มเกม / Start
        </Link>
      </div>
    </main>
  );
}
