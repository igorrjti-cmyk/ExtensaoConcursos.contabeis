// src/lib/card-renderer.ts
// Renderiza o card do Instagram direto no Canvas, sem precisar do elemento no DOM.
// Usado pelo botão "Publicar" na aba Lista — evita o erro "Card não encontrado".

import type { Concurso } from "./scraper";

const STATUS_BG: Record<string, string> = {
  "Inscricoes Abertas": "#00C896",
  "Aguardando Prova":   "#A78BFA",
  "Previsto":           "#FFB800",
  "Encerrado":          "#FF4B4B",
};
const STATUS_COLOR: Record<string, string> = {
  "Inscricoes Abertas": "#002D1F",
  "Aguardando Prova":   "#1A0050",
  "Previsto":           "#2D1F00",
  "Encerrado":          "#fff",
};
const STATUS_GLOW: Record<string, string> = {
  "Inscricoes Abertas": "rgba(0,200,150,0.4)",
  "Aguardando Prova":   "rgba(167,139,250,0.35)",
  "Previsto":           "rgba(255,184,0,0.35)",
  "Encerrado":          "rgba(255,75,75,0.35)",
};
const STATUS_LABEL: Record<string, string> = {
  "Inscricoes Abertas": "INSCRIÇÕES ABERTAS",
  "Aguardando Prova":   "AGUARDANDO PROVA",
  "Previsto":           "PREVISTO",
  "Encerrado":          "ENCERRADO",
};

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// Aguarda a fonte Sora estar carregada
async function garantirFonte(): Promise<void> {
  if (typeof document === "undefined") return;
  try {
    await document.fonts.load("800 20px Sora");
    await document.fonts.load("700 14px Sora");
    await document.fonts.load("600 12px Sora");
  } catch { /* ignora — usa fallback */ }
}

export async function renderCardCanvas(
  c: Concurso,
  formato: "feed" | "stories" = "feed"
): Promise<HTMLCanvasElement> {
  await garantirFonte();

  // Dimensões reais de saída
  const W = formato === "feed" ? 1080 : 1080;
  const H = formato === "feed" ? 1350 : 1920;

  const canvas = document.createElement("canvas");
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const stBg    = STATUS_BG[c.status]    ?? "#FFB800";
  const stColor = STATUS_COLOR[c.status] ?? "#000";
  const stGlow  = STATUS_GLOW[c.status]  ?? "rgba(255,184,0,0.35)";
  const stLabel = STATUS_LABEL[c.status] ?? c.status;

  const urgente = c.diasRestantes >= 0 && c.diasRestantes <= 7;
  const temProva = c.dataProva && c.dataProva !== "-";
  const isStories = formato === "stories";

  // ── Fundo gradiente ──────────────────────────────────────────────────────
  const bgGrad = ctx.createLinearGradient(0, 0, W * 0.7, H);
  bgGrad.addColorStop(0,   "#050D1E");
  bgGrad.addColorStop(0.45,"#091630");
  bgGrad.addColorStop(1,   "#050D1E");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // ── Grade sutil ──────────────────────────────────────────────────────────
  ctx.strokeStyle = "rgba(255,255,255,0.025)";
  ctx.lineWidth = 1;
  const GRID = 72;
  for (let x = 0; x < W; x += GRID) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += GRID) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // ── Glow superior direito ────────────────────────────────────────────────
  const glowR = ctx.createRadialGradient(W - 60, 60, 0, W - 60, 60, 480);
  glowR.addColorStop(0, stGlow);
  glowR.addColorStop(1, "transparent");
  ctx.fillStyle = glowR;
  ctx.fillRect(0, 0, W, H);

  // ── Faixa lateral esquerda ───────────────────────────────────────────────
  const faixaGrad = ctx.createLinearGradient(0, 0, 0, H * 0.7);
  faixaGrad.addColorStop(0, stBg);
  faixaGrad.addColorStop(1, "transparent");
  ctx.fillStyle = faixaGrad;
  ctx.fillRect(0, 0, 10, H);

  const PAD   = isStories ? 72 : 80;
  // Se urgente, reduz o PAD_T para compensar o banner de 120px
  const PAD_T = isStories
    ? (urgente ? 60  : 180)
    : (urgente ? 80  : 200);
  let Y = PAD_T;
  const FONT = "Sora, -apple-system, sans-serif";

  // ── Marca "CONCURSOS CONTÁBEIS" ──────────────────────────────────────────
  ctx.font = `800 28px ${FONT}`;
  ctx.fillStyle = "#00C896";
  ctx.fillText("CONCURSOS CONTÁBEIS", PAD, Y);
  Y += 60;

  // ── Badge de status ──────────────────────────────────────────────────────
  const badgeW = 340; const badgeH = 52; const badgeX = W - PAD - badgeW;
  const badgeY = PAD_T - 46;
  roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 26);
  ctx.fillStyle = stBg;
  ctx.fill();
  ctx.font = `800 22px ${FONT}`;
  ctx.fillStyle = stColor;
  ctx.textAlign = "center";
  ctx.fillText(stLabel, badgeX + badgeW / 2, badgeY + 35);
  ctx.textAlign = "left";

  // ── Banner urgente ───────────────────────────────────────────────────────
  if (urgente) {
    const urgGrad = ctx.createLinearGradient(PAD, Y, PAD + W - PAD * 2, Y);
    urgGrad.addColorStop(0, "#FF4B4B");
    urgGrad.addColorStop(1, "#FF2222");
    roundRect(ctx, PAD, Y, W - PAD * 2, 100, 16);
    ctx.fillStyle = urgGrad;
    ctx.fill();
    ctx.font = `800 24px ${FONT}`;
    ctx.fillStyle = "#fff";
    ctx.fillText("🚨  URGENTE — INSCRIÇÕES ENCERRAM EM", PAD + 24, Y + 42);
    ctx.font = `900 48px ${FONT}`;
    ctx.fillStyle = "#fff";
    ctx.textAlign = "right";
    ctx.fillText(`${c.diasRestantes} DIAS`, W - PAD - 20, Y + 82);
    ctx.textAlign = "left";
    Y += 120;
  }

  // ── Cargo ────────────────────────────────────────────────────────────────
  const cargoTxt = truncate(c.cargo, isStories ? 28 : 36);
  const cargoSize = cargoTxt.length > 28 ? 64 : cargoTxt.length > 20 ? 76 : 90;
  ctx.font = `800 ${cargoSize}px ${FONT}`;
  ctx.fillStyle = "#fff";
  ctx.fillText(cargoTxt, PAD, Y + cargoSize * 0.85);
  Y += cargoSize * 1.1;

  // ── Órgão ────────────────────────────────────────────────────────────────
  ctx.font = `700 38px ${FONT}`;
  ctx.fillStyle = "#00C896";
  ctx.fillText(truncate(c.orgao, 44), PAD, Y + 38);
  Y += 60;

  // ── Tags estado + nível ──────────────────────────────────────────────────
  const tags = [`📍 ${(c as { cidade?: string }).cidade ? (c as { cidade?: string }).cidade + "/" : ""}${c.estado}`, `🎓 ${c.nivel}`];
  let tagX = PAD;
  for (const tag of tags) {
    ctx.font = `600 24px ${FONT}`;
    const tw = ctx.measureText(tag).width;
    roundRect(ctx, tagX, Y, tw + 28, 44, 8);
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.09)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillText(tag, tagX + 14, Y + 31);
    tagX += tw + 48;
  }
  Y += 70;

  // ── Bloco data da prova ──────────────────────────────────────────────────
  if (temProva) {
    const provaH = 130;
    roundRect(ctx, PAD, Y, W - PAD * 2, provaH, 20);
    const provaBg = ctx.createLinearGradient(PAD, Y, W - PAD, Y + provaH);
    provaBg.addColorStop(0, "rgba(167,139,250,0.20)");
    provaBg.addColorStop(1, "rgba(99,60,220,0.14)");
    ctx.fillStyle = provaBg;
    ctx.fill();
    ctx.strokeStyle = "rgba(167,139,250,0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();
    // Label
    ctx.font = `700 22px ${FONT}`;
    ctx.fillStyle = "rgba(196,181,253,0.7)";
    ctx.fillText("📝  DATA DA PROVA", PAD + 30, Y + 44);
    // Data
    ctx.font = `900 62px ${FONT}`;
    ctx.fillStyle = "#E9D5FF";
    ctx.fillText(c.dataProva, PAD + 30, Y + 110);
    Y += provaH + 32;
  }

  // ── Grid de campos ───────────────────────────────────────────────────────
  const campos = [
    { icon: "💰", label: "Salário",  value: truncate(c.salario, 18) },
    { icon: "🎯", label: "Vagas",    value: truncate(c.vagas,   18) },
    { icon: "📅", label: c.status === "Inscricoes Abertas" ? "Inscrições até" : "Edital",
                  value: truncate(c.inscricaoAte, 18) },
    { icon: "🏦", label: "Banca",    value: truncate(c.banca !== "-" ? c.banca : "A definir", 18) },
  ];

  const cW = (W - PAD * 2 - 16) / 2;
  const cH = 120;
  const cGap = 16;

  for (let i = 0; i < campos.length; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx = PAD + col * (cW + cGap);
    const cy = Y + row * (cH + cGap);
    roundRect(ctx, cx, cy, cW, cH, 14);
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.stroke();
    // Label
    ctx.font = `600 20px ${FONT}`;
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillText(`${campos[i].icon} ${campos[i].label.toUpperCase()}`, cx + 18, cy + 34);
    // Value
    ctx.font = `700 32px ${FONT}`;
    ctx.fillStyle = "#fff";
    ctx.fillText(campos[i].value, cx + 18, cy + 82);
  }
  Y += 2 * cH + 2 * cGap + 32;

  // ── Rodapé ───────────────────────────────────────────────────────────────
  // Linha divisória
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(PAD, Y); ctx.lineTo(W - PAD, Y); ctx.stroke();
  Y += 36;

  // Handle
  ctx.font = `600 24px ${FONT}`;
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.fillText("SIGA NO INSTAGRAM", PAD, Y);
  Y += 42;
  ctx.font = `800 36px ${FONT}`;
  ctx.fillStyle = "#00C896";
  ctx.fillText("@concursos.contabeis", PAD, Y);

  // Botão "Ver Edital"
  const btnW = 240; const btnH = 60;
  const btnX = W - PAD - btnW;
  const btnY = Y - 46;
  roundRect(ctx, btnX, btnY, btnW, btnH, 30);
  const btnGrad = ctx.createLinearGradient(btnX, btnY, btnX + btnW, btnY);
  btnGrad.addColorStop(0, "#00C896");
  btnGrad.addColorStop(1, "#00A87A");
  ctx.fillStyle = btnGrad;
  ctx.fill();
  ctx.font = `800 24px ${FONT}`;
  ctx.fillStyle = "#002D1F";
  ctx.textAlign = "center";
  ctx.fillText("VER EDITAL", btnX + btnW / 2, btnY + 40);
  ctx.textAlign = "left";

  // ── Stories: envolve o feed centralizado num canvas 9:16 ─────────────────
  if (isStories) {
    // CTA rodapé: "Link na bio" (sem swipe up para contas sem 10k seguidores)
    const ctaY = H - 130;
    roundRect(ctx, PAD, ctaY, W - PAD * 2, 90, 18);
    ctx.fillStyle = "rgba(0,200,150,0.08)";
    ctx.fill();
    ctx.strokeStyle = "rgba(0,200,150,0.25)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.font = `600 22px ${FONT}`;
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.textAlign = "center";
    ctx.fillText("ACESSE O LINK", W / 2, ctaY + 34);
    ctx.font = `800 32px ${FONT}`;
    ctx.fillStyle = "#00C896";
    ctx.fillText("🔗  Link na bio →", W / 2, ctaY + 74);
    ctx.textAlign = "left";
  }

  return canvas;
}
