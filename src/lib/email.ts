// src/lib/email.ts
// Helper de e-mail usando Resend (resend.com — grátis até 3.000/mês)

import type { Concurso } from "./scraper";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const NOTIFY_EMAIL   = process.env.NOTIFY_EMAIL || "";
const FROM_EMAIL     = process.env.FROM_EMAIL || "onboarding@resend.dev";

// ─── Envia e-mail via Resend ──────────────────────────────────────────────────
async function enviarEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) { console.warn("[EMAIL] RESEND_API_KEY não configurado"); return false; }
  if (!to)             { console.warn("[EMAIL] NOTIFY_EMAIL não configurado");   return false; }
  try {
    const res  = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error(`[EMAIL] Erro Resend (HTTP ${res.status}):`, JSON.stringify(data));
      console.error(`[EMAIL] FROM=${FROM_EMAIL} | TO=${to} | SUBJECT=${subject}`);
      return false;
    }
    console.log(`[EMAIL] Enviado com sucesso: id=${data.id} | to=${to}`);
    return true;
  } catch (e: unknown) {
    console.error("[EMAIL] Erro de rede:", e);
    return false;
  }
}

// ─── Base HTML ────────────────────────────────────────────────────────────────
function baseHtml(content: string, preheader = ""): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="color-scheme" content="light"/>
<title>Concursos Contábeis</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#0f1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;-webkit-font-smoothing:antialiased}
  a{color:inherit;text-decoration:none}
  img{display:block;border:0}
  .wrapper{background:#0f1117;padding:32px 16px}
  .card{background:#1a1d27;border-radius:16px;overflow:hidden;max-width:580px;margin:0 auto;border:1px solid #2a2d3a}
  .header{background:linear-gradient(135deg,#0d1f3c 0%,#0a3d2e 100%);padding:32px 32px 28px;position:relative;overflow:hidden}
  .header-accent{position:absolute;top:-40px;right:-40px;width:160px;height:160px;background:radial-gradient(circle,rgba(0,200,150,.18) 0%,transparent 70%);border-radius:50%}
  .header-accent2{position:absolute;bottom:-30px;left:20px;width:100px;height:100px;background:radial-gradient(circle,rgba(0,150,200,.12) 0%,transparent 70%);border-radius:50%}
  .logo-row{display:flex;align-items:center;gap:10px;margin-bottom:16px}
  .logo-dot{width:8px;height:8px;background:#00c896;border-radius:50%;box-shadow:0 0 8px rgba(0,200,150,.6)}
  .logo-text{font-size:11px;font-weight:700;color:rgba(255,255,255,.5);letter-spacing:2px;text-transform:uppercase}
  .header h1{font-size:22px;font-weight:800;color:#fff;line-height:1.3;margin-bottom:6px}
  .header p{font-size:13px;color:rgba(255,255,255,.55)}
  .body{padding:28px 32px}
  .concurso-card{background:#22263a;border:1px solid #2e3347;border-radius:12px;padding:20px;margin-bottom:12px}
  .concurso-card:last-child{margin-bottom:0}
  .concurso-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px}
  .concurso-info{}
  .cargo{font-size:17px;font-weight:800;color:#f0f2ff;line-height:1.2;margin-bottom:4px}
  .orgao{font-size:13px;font-weight:600;color:#00c896}
  .meta{font-size:11px;color:rgba(255,255,255,.4);margin-top:3px}
  .badge{display:inline-block;padding:5px 12px;border-radius:20px;font-size:10px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;white-space:nowrap;flex-shrink:0}
  .badge-aberto{background:rgba(0,200,150,.15);color:#00e6a8;border:1px solid rgba(0,200,150,.3)}
  .badge-urgente{background:rgba(255,75,75,.15);color:#ff7070;border:1px solid rgba(255,75,75,.3)}
  .badge-previsto{background:rgba(255,184,0,.15);color:#ffd44d;border:1px solid rgba(255,184,0,.3)}
  .tags{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px}
  .tag{display:flex;align-items:center;gap:5px;background:#1a1e2e;border:1px solid #2e3347;border-radius:8px;padding:6px 10px;font-size:12px;color:rgba(255,255,255,.7);font-weight:500}
  .tag-icon{font-size:13px}
  .btn-edital{display:inline-block;background:linear-gradient(135deg,#00c896,#00a87a);color:#002d1e;padding:11px 22px;border-radius:10px;font-weight:800;font-size:13px;letter-spacing:.3px}
  .divider{border:none;border-top:1px solid #2a2d3a;margin:20px 0}
  .section-title{font-size:13px;font-weight:700;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:14px;display:flex;align-items:center;gap:8px}
  .section-title span{display:inline-block;background:#2a2d3a;padding:3px 8px;border-radius:6px;font-size:11px;color:rgba(255,255,255,.4)}
  .stats-row{display:flex;gap:12px;margin-bottom:24px}
  .stat-box{flex:1;background:#22263a;border:1px solid #2e3347;border-radius:12px;padding:16px 12px;text-align:center}
  .stat-num{font-size:28px;font-weight:900;line-height:1;margin-bottom:4px}
  .stat-label{font-size:10px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:1px;font-weight:600}
  .mini-card{background:#22263a;border:1px solid #2e3347;border-radius:10px;padding:14px 16px;margin-bottom:8px}
  .mini-card:last-child{margin-bottom:0}
  .mini-cargo{font-size:14px;font-weight:700;color:#f0f2ff;margin-bottom:3px}
  .mini-orgao{font-size:12px;color:#00c896;font-weight:600;margin-bottom:8px}
  .mini-tags{display:flex;flex-wrap:wrap;gap:6px}
  .mini-tag{font-size:11px;color:rgba(255,255,255,.5);background:#1a1e2e;border:1px solid #2e3347;border-radius:6px;padding:3px 8px;font-weight:500}
  .cta-row{text-align:center;padding:8px 0 4px}
  .footer{padding:20px 32px;text-align:center;border-top:1px solid #2a2d3a}
  .footer p{font-size:11px;color:rgba(255,255,255,.25);line-height:1.8}
  .footer a{color:rgba(255,255,255,.35)}
  .urgente-bar{background:linear-gradient(90deg,rgba(255,75,75,.15),transparent);border-left:3px solid #ff4b4b;padding:10px 14px;border-radius:0 8px 8px 0;margin-bottom:16px;font-size:12px;color:#ff9090}
  @media(max-width:480px){
    .body{padding:20px 16px}
    .header{padding:24px 20px 20px}
    .stats-row{flex-direction:column;gap:8px}
    .concurso-top{flex-direction:column}
    .badge{align-self:flex-start}
  }
</style>
</head>
<body>
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${preheader}</div>
<div class="wrapper">
  <div class="card">
    ${content}
    <div class="footer">
      <p>
        <strong style="color:rgba(255,255,255,.4)">Concursos Contábeis</strong> · @concursos.contabeis<br/>
        Você está recebendo porque configurou alertas neste painel.<br/>
        <a href="${process.env.NEXT_PUBLIC_APP_URL || "#"}">Acessar painel →</a>
      </p>
    </div>
  </div>
</div>
</body>
</html>`;
}

// ─── Badge helper ─────────────────────────────────────────────────────────────
function badgeConcurso(c: Concurso): string {
  if (c.diasRestantes >= 0 && c.diasRestantes <= 3)
    return `<span class="badge badge-urgente">⚡ ${c.diasRestantes === 0 ? "Encerra HOJE" : c.diasRestantes + "d restantes"}</span>`;
  if (c.status === "Inscricoes Abertas")
    return `<span class="badge badge-aberto">● Inscrições Abertas</span>`;
  return `<span class="badge badge-previsto">◎ Previsto</span>`;
}

// ─── Card de concurso ─────────────────────────────────────────────────────────
function cardConcurso(c: Concurso, urgente = false): string {
  const tags = [
    c.salario !== "-"     ? `<span class="tag"><span class="tag-icon">💰</span>${c.salario}</span>` : "",
    c.vagas   !== "-"     ? `<span class="tag"><span class="tag-icon">🎯</span>${c.vagas}</span>` : "",
    c.inscricao !== "-"   ? `<span class="tag"><span class="tag-icon">📅</span>${c.inscricao}</span>` : "",
    c.dataProva !== "-"   ? `<span class="tag"><span class="tag-icon">📝</span>Prova: ${c.dataProva}</span>` : "",
    c.banca !== "-"       ? `<span class="tag"><span class="tag-icon">🏛</span>${c.banca}</span>` : "",
  ].filter(Boolean).join("");

  return `
    <div class="concurso-card">
      ${urgente ? `<div class="urgente-bar">⚡ Inscrições encerrando em ${c.diasRestantes === 0 ? "HOJE" : c.diasRestantes + " dias"} — não perca!</div>` : ""}
      <div class="concurso-top">
        <div class="concurso-info">
          <div class="cargo">${c.cargo}</div>
          <div class="orgao">${c.orgao}</div>
          <div class="meta">${c.estado}${c.nivel !== "-" ? " · " + c.nivel : ""}</div>
        </div>
        ${badgeConcurso(c)}
      </div>
      <div class="tags">${tags}</div>
      <a href="${c.linkEdital || c.linkNoticia}" class="btn-edital">Ver Edital →</a>
    </div>`;
}

// ─── Mini card (para listas no resumo) ───────────────────────────────────────
function miniCard(c: Concurso): string {
  const tags = [
    c.salario !== "-"       ? `<span class="mini-tag">💰 ${c.salario}</span>` : "",
    c.vagas !== "-"         ? `<span class="mini-tag">🎯 ${c.vagas}</span>` : "",
    c.diasRestantes >= 0    ? `<span class="mini-tag">📅 ${c.diasRestantes}d</span>` : "",
  ].filter(Boolean).join("");

  return `
    <div class="mini-card">
      <div class="mini-cargo">${c.cargo}</div>
      <div class="mini-orgao">${c.orgao} — ${c.estado}</div>
      ${tags ? `<div class="mini-tags">${tags}</div>` : ""}
    </div>`;
}

// ─── Template: novo concurso ──────────────────────────────────────────────────
export async function emailNovoConcurso(concurso: Concurso): Promise<boolean> {
  if (!NOTIFY_EMAIL) return false;

  const urgente = concurso.diasRestantes >= 0 && concurso.diasRestantes <= 7;
  const dataFormatada = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });

  const content = `
    <div class="header">
      <div class="header-accent"></div>
      <div class="header-accent2"></div>
      <div class="logo-row">
        <div class="logo-dot"></div>
        <span class="logo-text">Concursos Contábeis</span>
      </div>
      <h1>🆕 Novo Concurso Detectado</h1>
      <p>${dataFormatada}</p>
    </div>
    <div class="body">
      ${cardConcurso(concurso, urgente)}
      <p style="font-size:12px;color:rgba(255,255,255,.35);margin-top:16px;text-align:center;line-height:1.6">
        Acesse o painel para gerar o card do Instagram e a legenda completa com hashtags.
      </p>
    </div>`;

  return enviarEmail(
    NOTIFY_EMAIL,
    `🆕 ${concurso.cargo} — ${concurso.orgao} (${concurso.estado})`,
    baseHtml(content, `Novo concurso: ${concurso.cargo} em ${concurso.orgao} — ${concurso.estado}`)
  );
}

// ─── Template: alerta de prazo ────────────────────────────────────────────────
export async function emailAlertaPrazo(concursos: Concurso[]): Promise<boolean> {
  if (!NOTIFY_EMAIL || concursos.length === 0) return false;

  const content = `
    <div class="header">
      <div class="header-accent"></div>
      <div class="header-accent2"></div>
      <div class="logo-row">
        <div class="logo-dot"></div>
        <span class="logo-text">Concursos Contábeis</span>
      </div>
      <h1>⚡ Inscrições Encerrando</h1>
      <p>${concursos.length} concurso${concursos.length > 1 ? "s" : ""} com prazo nos próximos 3 dias</p>
    </div>
    <div class="body">
      <p style="font-size:13px;color:rgba(255,255,255,.5);margin-bottom:20px;line-height:1.6">
        Boa oportunidade para postar sobre esses concursos enquanto as inscrições ainda estão abertas!
      </p>
      ${concursos.map(c => cardConcurso(c, true)).join("")}
    </div>`;

  return enviarEmail(
    NOTIFY_EMAIL,
    `⚡ ${concursos.length} concurso${concursos.length > 1 ? "s" : ""} encerrando inscrições`,
    baseHtml(content, `${concursos.length} concursos com inscrições encerrando em breve`)
  );
}

// ─── Template: resumo semanal ─────────────────────────────────────────────────
export async function emailResumoSemanal(dados: {
  novos: Concurso[];
  encerrandoEssaSemana: Concurso[];
  comProvaEssaSemana: Concurso[];
  totalPostsEssaSemana: number;
  totalConcursosAtivos: number;
}): Promise<boolean> {
  if (!NOTIFY_EMAIL) return false;

  const { novos, encerrandoEssaSemana, comProvaEssaSemana, totalPostsEssaSemana, totalConcursosAtivos } = dados;
  const dataFormatada = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  function secao(emoji: string, titulo: string, count: number, cor: string, lista: Concurso[], limite = 5): string {
    if (lista.length === 0) return "";
    const mais = lista.length > limite ? `<p style="font-size:12px;color:rgba(255,255,255,.3);text-align:center;padding:8px 0">+${lista.length - limite} mais no painel</p>` : "";
    return `
      <div class="section-title">${emoji} ${titulo} <span>${count}</span></div>
      ${lista.slice(0, limite).map(c => miniCard(c)).join("")}
      ${mais}
      <div class="divider"></div>`;
  }

  const content = `
    <div class="header">
      <div class="header-accent"></div>
      <div class="header-accent2"></div>
      <div class="logo-row">
        <div class="logo-dot"></div>
        <span class="logo-text">Concursos Contábeis</span>
      </div>
      <h1>📊 Resumo Semanal</h1>
      <p>Semana de ${dataFormatada}</p>
    </div>
    <div class="body">

      <div class="stats-row">
        <div class="stat-box">
          <div class="stat-num" style="color:#a78bfa">${totalConcursosAtivos}</div>
          <div class="stat-label">Concursos ativos</div>
        </div>
        <div class="stat-box">
          <div class="stat-num" style="color:#60a5fa">${novos.length}</div>
          <div class="stat-label">Novos esta semana</div>
        </div>
        <div class="stat-box">
          <div class="stat-num" style="color:#fbbf24">${totalPostsEssaSemana}</div>
          <div class="stat-label">Posts publicados</div>
        </div>
      </div>

      ${secao("🆕", "Novos esta semana", novos.length, "#60a5fa", novos)}
      ${secao("⚡", "Encerrando esta semana", encerrandoEssaSemana.length, "#f87171", encerrandoEssaSemana)}
      ${secao("📝", "Provas esta semana", comProvaEssaSemana.length, "#a78bfa", comProvaEssaSemana)}

      <div class="cta-row">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || "#"}"
           style="display:inline-block;background:linear-gradient(135deg,#00c896,#00a87a);color:#002d1e;padding:12px 28px;border-radius:10px;font-weight:800;font-size:13px">
          Acessar painel completo →
        </a>
      </div>
    </div>`;

  return enviarEmail(
    NOTIFY_EMAIL,
    `📊 Resumo Semanal — ${novos.length} novos · ${totalConcursosAtivos} ativos`,
    baseHtml(content, `${novos.length} novos concursos esta semana, ${encerrandoEssaSemana.length} encerrando`)
  );
}
