// src/lib/legenda.ts
import { Concurso, statusDisplay, UF_NOMES } from "./scraper";

const EMOJI_BANCA: Record<string, string> = {
  CESPE: "⚡", CEBRASPE: "⚡", FGV: "🏛", FCC: "📘",
  VUNESP: "📗", IBFC: "📙", IDECAN: "📕", AOCP: "📔",
  FUNDATEC: "📒", FEPESE: "📓", IADES: "📃", QUADRIX: "🗂",
  IMESO: "📋", CONSULPLAN: "📑", FAFIPA: "📌", OBJETIVA: "🎯",
};

const ESTADO_HASHTAG: Record<string, string> = {
  SP: "#concursosp", MG: "#concursomg", RJ: "#concursorj", RS: "#concursors",
  PR: "#concursopr", SC: "#concursosc", BA: "#concursoba", GO: "#concursogo",
  DF: "#concursodf", PE: "#concursope", CE: "#concursoce", AM: "#concursoam",
  MT: "#concursomato", MS: "#concursoms", PA: "#concursopa", ES: "#concursoes",
  RN: "#concursorn", PB: "#concursopb", AL: "#concursoal", SE: "#concursose",
  PI: "#concursopi", MA: "#concursoma", TO: "#concursoto", AC: "#concursoac",
  RO: "#concursoro", RR: "#concursorr", AP: "#concursoap",
  Nacional: "#concursonacional",
};

function categoriaPost(c: Concurso): "federal" | "estadual" | "municipal" {
  const org = c.orgao.toUpperCase();
  if (
    org.includes("FEDERAL") || org.includes("TCU") || org.includes("CGU") ||
    org.includes("STF") || org.includes("STJ") || org.includes("RECEITA FEDERAL") ||
    org.includes("INSS") || c.estado === "Nacional"
  ) return "federal";
  if (
    org.includes("SEFAZ") || org.includes("ESTADO") || org.includes("GOVERNO DO") ||
    org.includes("TRIBUNAL DE JUSTICA") || org.includes("TJ") || org.includes("TRF") ||
    org.includes("TCE") || org.includes("MP ") || org.includes("MINISTERIO PUBLICO")
  ) return "estadual";
  return "municipal";
}

function chamadaParaAcao(c: Concurso): string {
  const cat   = categoriaPost(c);
  const cargo = c.cargo.toLowerCase();
  const dias  = c.diasRestantes;

  if (cargo.includes("auditor") || cargo.includes("fiscal tribut") || cargo.includes("fiscal de tribut")) {
    return "Auditor Fiscal é um dos cargos mais cobiçados da Contabilidade. Não perca esse edital!";
  }
  if (cat === "federal") {
    return "Concurso Federal com excelente remuneração e estabilidade. Vale muito a preparação!";
  }
  if (dias >= 0 && dias <= 3) {
    return "🚨 ATENÇÃO! Apenas " + dias + " dia(s) para encerrar as inscrições. Corra!";
  }
  if (dias >= 0 && dias <= 7) {
    return "⚡ Faltam apenas " + dias + " dias para encerrar as inscrições. Não deixe para depois!";
  }
  if (cat === "estadual") {
    return "Oportunidade estadual com boa remuneração. Confira os requisitos no edital!";
  }
  if (cargo.includes("técnico") || cargo.includes("tecnico")) {
    return "Vaga para Técnico em Contabilidade com CRC ativo. Compartilhe com quem se encaixa!";
  }
  return "Boa oportunidade para quem tem formação em Ciências Contábeis. Compartilhe com quem precisa!";
}

/** Normaliza texto para hashtag: remove acentos, espaços e caracteres especiais */
function toHashtag(texto: string): string {
  return "#" + texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")   // remove diacríticos
    .replace(/[^a-z0-9]/g, "");           // remove tudo que não é letra/número
}

function gerarHashtags(c: Concurso): string {
  const tags = new Set<string>([
    "#concursospublicos", "#contabilidade", "#contador", "#contadora",
    "#cienciascontabeis", "#concursocontabilidade",
  ]);

  // ── Cargo ─────────────────────────────────────────────────────────────────
  const cargo = c.cargo.toLowerCase();
  if (cargo.includes("tecnico") || cargo.includes("técnico")) tags.add("#tecnicoemcontabilidade");
  if (cargo.includes("auditor"))   tags.add("#auditorfiscal");
  if (cargo.includes("fiscal"))    tags.add("#fiscaldetributos");
  if (cargo.includes("analista"))  tags.add("#analistacontabil");
  if (cargo.includes("perito"))    tags.add("#peritocontabil");
  if (cargo.includes("controller")) tags.add("#controller");
  if (cargo.includes("contador"))  tags.add("#contador");

  // ── Banca ─────────────────────────────────────────────────────────────────
  if (c.banca !== "-") tags.add("#" + c.banca.toLowerCase().replace(/[^a-z0-9]/g, ""));

  // ── Estado: hashtag genérica de concurso + hashtag do nome do estado ──────
  if (ESTADO_HASHTAG[c.estado]) tags.add(ESTADO_HASHTAG[c.estado]);

  // Ex: estado = "GO" → "#goias", "#concursogoias"
  const nomeEstado = UF_NOMES[c.estado];
  if (nomeEstado && c.estado !== "Nacional") {
    tags.add(toHashtag(nomeEstado));                    // #goias #saopaulo etc
    tags.add(toHashtag("concurso " + nomeEstado));      // #concursogoias etc
  }

  // ── Cidade: hashtag de concurso na cidade + apenas nome da cidade ─────────
  if (c.cidade && c.cidade.trim().length >= 2) {
    tags.add(toHashtag(c.cidade));                      // #mararosa #saopaulo etc
    tags.add(toHashtag("concurso " + c.cidade));        // #concursomararosa etc
    // Combina cidade + UF para maior alcance local: #concursomararosago
    tags.add(toHashtag("concurso " + c.cidade + c.estado)); // #concursomararosago
  }

  // ── Categoria do órgão ────────────────────────────────────────────────────
  const cat = categoriaPost(c);
  if (cat === "federal")   tags.add("#concursofederal");
  if (cat === "estadual")  tags.add("#concursoestadual");
  if (cat === "municipal") tags.add("#concursomunicipal");

  // ── Vagas e oportunidade ──────────────────────────────────────────────────
  const ano = new Date().getFullYear();
  tags.add("#aprovado");
  tags.add("#servidorpublico");
  tags.add("#estudandoparaconcurso");
  tags.add("#concurso" + ano);
  tags.add("#vagas" + ano);
  tags.add("#oportunidade");

  // ── Branding fixo ─────────────────────────────────────────────────────────
  tags.add("#debitoecredito");      // marca do site
  tags.add("#simuladorcontabil");   // volume de busca em estudos contábeis
  tags.add("#estudocontabil");      // complementar

  return Array.from(tags).join(" ");
}

export function gerarLegenda(c: Concurso): string {
  const bancaEmoji = Object.entries(EMOJI_BANCA)
    .find(([k]) => c.banca.toUpperCase().includes(k))?.[1] ?? "";

  const urgente      = c.diasRestantes >= 0 && c.diasRestantes <= 7;
  const temProva     = c.dataProva     && c.dataProva     !== "-";
  const temResultado = c.dataResultado && c.dataResultado !== "-";

  // ── Cabeçalho: STATUS | CARGO (em maiúsculas) ─────────────────────────────
  // Formato pedido: "PREVISTO | CONTADOR" ou "INSCRIÇÕES ABERTAS | CONTADOR"
  const statusStr = urgente
    ? `URGENTE — ${c.diasRestantes}d RESTANTES`
    : statusDisplay(c.status).toUpperCase();

  const cabecalho = `${statusStr} | ${c.cargo.toUpperCase()}`;

  // ── Linha de data da prova — SEMPRE visível quando disponível ─────────────
  const linhaProva = temProva
    ? `\n📝 DATA DA PROVA: ${c.dataProva}`
    : "";

  const linhaResultado = temResultado
    ? `\n🏆 Resultado: ${c.dataResultado}`
    : "";

  // ── Corpo ─────────────────────────────────────────────────────────────────
  return (
    cabecalho +
    "\n\n" +
    `📍 Órgão: ${c.orgao}\n` +
    `🗺 Estado: ${c.cidade ? c.cidade + "/" : ""}${c.estado}\n` +
    `🎓 Nível: ${c.nivel}\n` +
    `🎯 Vagas: ${c.vagas}\n` +
    `💰 Salário: ${c.salario}\n` +
    `${bancaEmoji ? bancaEmoji + " " : ""}🏦 Banca: ${c.banca}\n` +
    `📅 Inscrições: ${c.inscricao !== "-" ? c.inscricao : "até " + c.inscricaoAte}` +
    linhaProva +
    linhaResultado +
    "\n\n" +
    chamadaParaAcao(c) +
    "\n\n" +
    `🔗 Edital no link da bio ou:\n${c.linkEdital || c.linkNoticia}` +
    "\n\n" +
    "💾 SALVE para não perder o prazo!\n" +
    "🏷️ MARQUE um colega da Contabilidade!\n" +
    "🔔 ATIVE as notificações!\n\n" +
    gerarHashtags(c)
  );
}
