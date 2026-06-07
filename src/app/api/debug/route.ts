// src/app/api/debug/route.ts
// Endpoint de diagnostico - scrapa uma URL e retorna os dados brutos
// para inspecionar no console do browser (F12)

import { NextResponse } from "next/server";

const BASE_URL = "https://www.pciconcursos.com.br";
const TIMEOUT_MS = 8000;

async function fetchComTimeout(url: string) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "pt-BR,pt;q=0.9",
      },
      cache: "no-store",
      signal: ctrl.signal,
    });
    if (!res.ok) return { ok: false, status: res.status, html: null };
    return { ok: true, status: res.status, html: await res.text() };
  } catch (e: unknown) {
    return { ok: false, status: 0, html: null, error: String(e) };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const urlParam = searchParams.get("url") || "/vagas/contador";

  const log: Record<string, unknown> = {
    url: BASE_URL + urlParam,
    timestamp: new Date().toISOString(),
  };

  // 1. Fetch
  const fetchResult = await fetchComTimeout(BASE_URL + urlParam);
  log.fetch = { ok: fetchResult.ok, status: fetchResult.status, error: fetchResult.error ?? null };

  if (!fetchResult.html) {
    return NextResponse.json({ ...log, erro: "Fetch falhou" });
  }

  // 2. Parse com cheerio
  const cheerio = await import("cheerio");
  const $ = cheerio.load(fetchResult.html);

  // 3. Coleta links de noticias
  const todosLinks: { href: string; texto: string; title: string; slugLen: number; valido: boolean }[] = [];
  $("a[href*='/noticias/']").each((_, el) => {
    const href  = $(el).attr("href") || "";
    const title = $(el).attr("title") || "";
    const texto = $(el).text().trim();
    const slugMatch = href.match(/\/noticias\/([a-z0-9][a-z0-9-]+)/);
    const slugLen = slugMatch ? slugMatch[1].length : 0;
    const valido  = slugLen >= 10 && title.includes(" - ") && texto.length >= 4 && texto.length <= 80 && texto !== title;
    todosLinks.push({ href, texto, title, slugLen, valido });
  });

  log.links_total = todosLinks.length;
  log.links_validos = todosLinks.filter(l => l.valido).length;
  log.links_amostra = todosLinks.slice(0, 20); // primeiros 20 para analise

  // 4. Extrai texto da pagina em linhas
  const $conteudo = $("main, #content, .content, article, #main").first();
  const textoCompleto = ($conteudo.length ? $conteudo : $("body"))
    .text()
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const linhas = textoCompleto.split("\n").map(l => l.trim()).filter(Boolean);
  log.total_linhas = linhas.length;
  log.seletor_conteudo_encontrado = $conteudo.length > 0;

  // 5. Para os primeiros 3 links validos, mostra o bloco extraido
  const linksValidos = todosLinks.filter(l => l.valido).slice(0, 3);
  const blocos: Record<string, unknown>[] = [];

  for (const link of linksValidos) {
    const orgao  = link.texto;
    const ufDoTitle = link.title.match(/\s+-\s+([A-Z]{2})\s+/)?.[1] ?? "nao encontrado";
    const idxOrgao  = linhas.findIndex(l => l === orgao);
    const bloco     = idxOrgao >= 0 ? linhas.slice(idxOrgao, idxOrgao + 8) : [];
    const blocoTexto = bloco.join(" ");

    // Testa regex de cargo no title
    const cargoMatch = link.title.match(/\b(?:para|ao cargo de|vaga(?:s)? (?:de|para))\s+([^,.(]+?)(?:\s+e\s+[A-Z][^,.(]+?)?(?:\s+em\s+|\s+com\s+|\s+n[ao]\s+|[,.(]|$)/i);

    // Testa regex de data
    const periodoMatch = blocoTexto.match(/(\d{2}\/\d{2}(?:\/\d{4})?)\s+a\s+(\d{2}\/\d{2}\/\d{4})/);
    const dataUnica    = blocoTexto.match(/(\d{2}\/\d{2}\/\d{4})/);

    // Testa regex de vagas
    const vagasMatch = blocoTexto.match(/(\d+\s+vagas?(?:\s*[+]\s*CR)?|cadastro\s+reserva)[^R]+R[$]\s*([\d.,]+)/i);

    blocos.push({
      orgao,
      title: link.title,
      uf_extraido: ufDoTitle,
      idx_orgao_no_texto: idxOrgao,
      bloco_linhas: bloco,
      cargo_do_title: cargoMatch ? cargoMatch[1].trim() : "NAO ENCONTRADO - regex falhou",
      vagas_match: vagasMatch ? vagasMatch[0] : "NAO ENCONTRADO",
      data_periodo: periodoMatch ? `${periodoMatch[1]} a ${periodoMatch[2]}` : "NAO ENCONTRADO",
      data_unica: dataUnica ? dataUnica[1] : "NAO ENCONTRADO",
    });
  }

  log.debug_primeiros_3_concursos = blocos;

  // 6. Linhas ao redor do primeiro concurso para diagnostico visual
  const primeiroOrgao = linksValidos[0]?.texto;
  const idxPrimeiro   = primeiroOrgao ? linhas.findIndex(l => l === primeiroOrgao) : -1;
  if (idxPrimeiro >= 0) {
    log.linhas_ao_redor_primeiro_concurso = {
      indice: idxPrimeiro,
      linhas: linhas.slice(Math.max(0, idxPrimeiro - 2), idxPrimeiro + 12).map((l, i) => `[${idxPrimeiro - 2 + i}] ${l}`),
    };
  }

  return NextResponse.json(log, {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
