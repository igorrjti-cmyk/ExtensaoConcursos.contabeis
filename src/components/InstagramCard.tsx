"use client";
// src/components/InstagramCard.tsx — v9
// Melhorias: melhor distribuição vertical, tipografia escalada, espaçamento calibrado
// Feed 4:5: 480×600px preview → scale 2.25 = 1080×1350px real
// Stories 9:16: 270×480px preview → scale 4 = 1080×1920px real

import { Concurso, statusDisplay } from "@/lib/scraper";

interface Props {
  concurso: Concurso;
  handle?: string;
  formato?: "feed" | "stories";
}

const STATUS_STYLE: Record<string, { bg: string; color: string; glow: string; border: string }> = {
  "Inscricoes Abertas": { bg: "#00C896", color: "#002D1F", glow: "rgba(0,200,150,0.4)",  border: "rgba(0,200,150,0.3)"  },
  "Previsto":           { bg: "#FFB800", color: "#2D1F00", glow: "rgba(255,184,0,0.35)", border: "rgba(255,184,0,0.25)" },
  "Encerrado":          { bg: "#FF4B4B", color: "#fff",    glow: "rgba(255,75,75,0.35)", border: "rgba(255,75,75,0.25)" },
};

export default function InstagramCard({
  concurso: c,
  handle = "@concursos.contabeis",
  formato = "feed",
}: Props) {
  const st        = STATUS_STYLE[c.status] ?? STATUS_STYLE["Previsto"];
  const temProva  = c.dataProva     && c.dataProva     !== "-";
  const temRes    = c.dataResultado && c.dataResultado !== "-";
  const urgente   = c.diasRestantes >= 0 && c.diasRestantes <= 7;
  const isStories = formato === "stories";

  const W = isStories ? 270 : 480;
  const H = isStories ? 480 : 600;

  const SAFE_X     = isStories ? 0  : 15;
  const PAD_X      = isStories ? 18 : 28 + SAFE_X;
  const PAD_TOP    = isStories ? 18 : Math.round(H * 0.15);
  const PAD_BOTTOM = isStories ? 18 : 18;

  const MAX_CARGO    = isStories ? 26 : 36;
  const cargoDisplay = c.cargo.length > MAX_CARGO
    ? c.cargo.slice(0, MAX_CARGO - 1).trimEnd() + "…"
    : c.cargo;

  const titleSize = isStories
    ? 12
    : cargoDisplay.length > 30 ? 20
    : cargoDisplay.length > 20 ? 25
    : 30;

  const orgaoSize = isStories ? 9 : titleSize * 0.52;

  const campos = [
    { icon: "💰", label: "Salário",  value: c.salario },
    { icon: "🎯", label: "Vagas",    value: c.vagas   },
    {
      icon: "📅",
      label: c.status === "Inscricoes Abertas" ? "Inscrições até" : "Edital",
      value: c.inscricaoAte,
    },
    { icon: "🏦", label: "Banca", value: c.banca !== "-" ? c.banca : "A definir" },
  ];

  const gap             = isStories ? 6 : 10;
  const innerPad        = isStories ? "5px 8px" : "9px 13px";
  const fieldLabelSize  = isStories ? 7  : 8;
  const fieldValueSize  = isStories ? 10 : 13;
  const statusSize      = isStories ? 7  : 8.5;
  const brandLabelSize  = isStories ? 7  : 8;
  const provaLabelSize  = isStories ? 7  : 8;
  const provaValueSize  = isStories ? 14 : 22;
  const resValueSize    = isStories ? 11 : 16;
  const footerHandleSize = isStories ? 10 : 13;

  return (
    <div
      id={"card-" + c.id + "-" + formato}
      style={{
        width: W, height: H,
        background: "linear-gradient(160deg,#050D1E 0%,#091630 45%,#050D1E 100%)",
        borderRadius: 16,
        fontFamily: "'Sora',sans-serif",
        position: "relative", overflow: "hidden",
        boxSizing: "border-box",
        display: "flex", flexDirection: "column",
        justifyContent: "flex-start",
        gap: isStories ? 10 : 18,
        paddingTop: PAD_TOP, paddingBottom: PAD_BOTTOM,
        paddingLeft: PAD_X, paddingRight: PAD_X,
        flexShrink: 0,
      }}
    >
      {/* Faixa lateral */}
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0, width: 5,
        background: `linear-gradient(to bottom, ${st.bg} 55%, transparent)`,
        borderRadius: "16px 0 0 16px",
      }} />

      {/* Glow superior direito */}
      <div style={{
        position: "absolute", top: -70, right: -70, width: 220, height: 220,
        background: `radial-gradient(circle, ${st.glow} 0%, transparent 68%)`,
        pointerEvents: "none",
      }} />

      {/* Glow inferior esquerdo */}
      <div style={{
        position: "absolute", bottom: -60, left: -40, width: 180, height: 180,
        background: "radial-gradient(circle, rgba(0,100,200,0.12) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Grade */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage:
          "linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px)," +
          "linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px)",
        backgroundSize: "36px 36px", pointerEvents: "none",
      }} />

      {/* Guia zona segura */}
      {!isStories && (
        <div style={{
          position: "absolute", top: 0, bottom: 0,
          left: SAFE_X, right: SAFE_X,
          borderLeft: "1px dashed rgba(255,255,255,.04)",
          borderRight: "1px dashed rgba(255,255,255,.04)",
          pointerEvents: "none",
        }} />
      )}

      {/* ── BLOCO SUPERIOR ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: gap, position: "relative" }}>

        {/* Marca + Badge */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <svg width="13" height="13" viewBox="0 0 14 14" style={{ flexShrink: 0 }}>
              <circle cx="7" cy="7" r="6.5" fill="none" stroke="#00C896" strokeWidth="1.2"/>
              <text x="7" y="11" textAnchor="middle" fill="#00C896"
                style={{ fontSize: "9px", fontWeight: 800, fontFamily: "sans-serif" }}>$</text>
            </svg>
            <span style={{
              background: "linear-gradient(90deg,#00C896,#00E5A8)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              fontSize: brandLabelSize, fontWeight: 800, letterSpacing: 2.2,
              textTransform: "uppercase",
            }}>Concursos Contábeis</span>
          </div>
          <span style={{
            background: st.bg, color: st.color,
            fontSize: statusSize, fontWeight: 800,
            padding: "4px 11px", borderRadius: 20,
            letterSpacing: 0.8, textTransform: "uppercase",
            boxShadow: `0 0 14px ${st.glow}`,
          }}>{statusDisplay(c.status)}</span>
        </div>

        {/* Urgência */}
        {urgente && (
          <div style={{
            background: "linear-gradient(135deg,#FF4B4B,#FF2222)",
            borderRadius: 10, padding: isStories ? "5px 10px" : "8px 13px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            boxShadow: "0 4px 20px rgba(255,75,75,0.45)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ fontSize: isStories ? 13 : 16 }}>🚨</span>
              <div>
                <div style={{ color: "#fff", fontSize: isStories ? 8 : 9.5, fontWeight: 800, letterSpacing: 0.4 }}>
                  URGENTE — INSCRIÇÕES ENCERRAM EM
                </div>
                <div style={{ color: "rgba(255,255,255,.7)", fontSize: isStories ? 7 : 8 }}>
                  Corra para não perder!
                </div>
              </div>
            </div>
            <div style={{
              background: "rgba(0,0,0,0.28)", borderRadius: 8,
              padding: "4px 10px", textAlign: "center",
            }}>
              <div style={{ color: "#fff", fontSize: isStories ? 19 : 24, fontWeight: 900, lineHeight: 1 }}>
                {c.diasRestantes}
              </div>
              <div style={{ color: "rgba(255,255,255,.65)", fontSize: 7, fontWeight: 700, letterSpacing: 1 }}>
                DIAS
              </div>
            </div>
          </div>
        )}

        {/* Cargo + órgão + tags */}
        <div style={{ paddingTop: isStories ? 0 : 2 }}>
          <div style={{
            color: "#fff",
            fontSize: titleSize,
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: titleSize > 22 ? "-0.5px" : "-0.2px",
            marginBottom: isStories ? 3 : 5,
          }}>
            {cargoDisplay}
          </div>
          <div style={{
            color: "#00C896",
            fontSize: orgaoSize,
            fontWeight: 700,
            marginBottom: isStories ? 3 : 6,
            lineHeight: 1.3,
            opacity: 0.92,
          }}>
            {c.orgao}
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            <span style={{
              background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.09)",
              color: "rgba(255,255,255,.55)", fontSize: isStories ? 7 : 8.5,
              padding: "2px 7px", borderRadius: 5, fontWeight: 600,
            }}>📍 {c.estado}</span>
            <span style={{
              background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.09)",
              color: "rgba(255,255,255,.55)", fontSize: isStories ? 7 : 8.5,
              padding: "2px 7px", borderRadius: 5, fontWeight: 600,
            }}>🎓 {c.nivel}</span>
          </div>
        </div>
      </div>

      {/* ── BLOCO MEIO: Data da prova — destaque total ── */}
      {temProva && (
        <div style={{
          background: "linear-gradient(135deg,rgba(167,139,250,0.20),rgba(99,60,220,0.14))",
          border: "1.5px solid rgba(167,139,250,0.5)",
          borderRadius: 12,
          padding: isStories ? "10px 14px" : "14px 20px",
          display: "flex", alignItems: "center", gap: isStories ? 10 : 16,
          boxShadow: "0 4px 24px rgba(139,92,246,0.2)",
        }}>
          <span style={{ fontSize: isStories ? 18 : 28, flexShrink: 0 }}>📝</span>
          <div style={{ flex: 1 }}>
            <div style={{
              color: "rgba(196,181,253,0.7)",
              fontSize: isStories ? 7.5 : 9, fontWeight: 700,
              letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 4,
            }}>Data da Prova</div>
            <div style={{
              color: "#E9D5FF",
              fontSize: isStories ? 18 : 28, fontWeight: 900,
              letterSpacing: "-0.5px", lineHeight: 1,
              textShadow: "0 0 20px rgba(167,139,250,0.5)",
            }}>{c.dataProva}</div>
          </div>
        </div>
      )}

      {/* ── BLOCO INFERIOR: Grid + rodapé ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: gap, position: "relative" }}>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: isStories ? 5 : 8 }}>
          {campos.map(item => (
            <div key={item.label} style={{
              background: "rgba(255,255,255,.04)",
              border: "1px solid rgba(255,255,255,.08)",
              borderRadius: 10, padding: innerPad,
            }}>
              <div style={{
                color: "rgba(255,255,255,.3)",
                fontSize: fieldLabelSize, letterSpacing: 0.8,
                marginBottom: 4, textTransform: "uppercase", fontWeight: 600,
              }}>
                {item.icon} {item.label}
              </div>
              <div style={{
                color: "#fff",
                fontSize: fieldValueSize, fontWeight: 700, lineHeight: 1.25,
              }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>

        {isStories && (
          <div style={{
            background: "rgba(0,200,150,.07)",
            border: "1px solid rgba(0,200,150,.2)",
            borderRadius: 10, padding: "8px 12px", textAlign: "center",
          }}>
            <div style={{ color: "rgba(255,255,255,.3)", fontSize: 7.5, marginBottom: 2 }}>
              ARRASTE PARA CIMA
            </div>
            <div style={{ color: "#00C896", fontSize: 10.5, fontWeight: 800 }}>
              Ver edital completo →
            </div>
          </div>
        )}

        {/* Rodapé */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          borderTop: "1px solid rgba(255,255,255,.07)",
          paddingTop: isStories ? 8 : 11,
        }}>
          <div>
            <div style={{
              color: "rgba(255,255,255,.2)",
              fontSize: isStories ? 7 : 7.5,
              letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 2,
            }}>Siga no Instagram</div>
            <div style={{ color: "#00C896", fontSize: footerHandleSize, fontWeight: 800 }}>
              {handle}
            </div>
          </div>
          <div style={{
            background: "linear-gradient(135deg,#00C896,#00A87A)",
            color: "#002D1F", fontSize: isStories ? 8.5 : 9.5, fontWeight: 800,
            padding: isStories ? "5px 11px" : "7px 16px",
            borderRadius: 20, letterSpacing: 0.5,
            boxShadow: "0 3px 12px rgba(0,200,150,0.3)",
          }}>VER EDITAL</div>
        </div>
      </div>
    </div>
  );
}
