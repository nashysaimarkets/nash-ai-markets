import Image from "next/image";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

const CONCEPTS = [
  {
    id: "current-mark",
    title: "Current production mark",
    path: "/brand/logo-mark.svg",
    width: 160,
    height: 160,
    note: "Live BrandLogo compact mark.",
  },
  {
    id: "command-mark",
    title: "Command reticle concept",
    path: "/brand/logo-mark-command.svg",
    width: 160,
    height: 160,
    note: "Bullseye command motif with emerald reticle and gold diamond.",
  },
  {
    id: "candle-mark",
    title: "Candle pulse concept",
    path: "/brand/logo-mark-candle.svg",
    width: 160,
    height: 160,
    note: "Market-structure mark built from verified candle language.",
  },
  {
    id: "current-wordmark",
    title: "Current production wordmark",
    path: "/brand/logo-horizontal.svg",
    width: 420,
    height: 72,
    note: "Live BrandLogo horizontal wordmark.",
  },
  {
    id: "command-wordmark",
    title: "Command wordmark concept",
    path: "/brand/logo-horizontal-command.svg",
    width: 420,
    height: 72,
    note: "Command-brand horizontal lockup for review only.",
  },
] as const;

/** Non-production brand review harness for command / candle logo concepts. */
export default function LogoConceptsReviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="foxtrotTerminal customerTerminal" style={{ padding: "28px 24px 64px", maxWidth: 1100, margin: "0 auto" }}>
      <p className="ctEyebrow">DEV · BRAND REVIEW · NOT LIVE ROUTING</p>
      <h1 style={{ fontSize: "40px", margin: "12px 0 10px", letterSpacing: "-0.03em" }}>Logo concept review</h1>
      <p style={{ maxWidth: 720, color: "#98a3ad", fontSize: 16, lineHeight: 1.6, marginBottom: 28 }}>
        Compare the live BrandLogo assets with the command and candle concepts shipped for review.
        Nothing on this page changes production branding until an owner selects a direction.
      </p>
      <div style={{ display: "grid", gap: 18 }}>
        {CONCEPTS.map((concept) => (
          <article
            key={concept.id}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(180px, 240px) 1fr",
              gap: 20,
              alignItems: "center",
              padding: "18px 20px",
              border: "1px solid #243038",
              background: "#0b1015",
            }}
          >
            <div style={{ display: "grid", placeItems: "center", minHeight: 120, background: "#050b0a" }}>
              <Image src={concept.path} alt={concept.title} width={concept.width} height={concept.height} unoptimized />
            </div>
            <div>
              <span style={{ color: "#8f99a3", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase" }}>{concept.id}</span>
              <h2 style={{ margin: "6px 0 8px", fontSize: 22 }}>{concept.title}</h2>
              <p style={{ margin: 0, color: "#9da8b2", fontSize: 15, lineHeight: 1.5 }}>{concept.note}</p>
              <code style={{ display: "inline-block", marginTop: 10, color: "#68d7b4", fontSize: 13 }}>{concept.path}</code>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
