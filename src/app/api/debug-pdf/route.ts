// src/app/api/debug-pdf/route.ts
// Rota de diagnóstico: dado o link de uma notícia do PCI (ou diretamente um PDF),
// baixa o edital, extrai o texto completo e retorna análise detalhada.
//
// Uso:
//   /api/debug-pdf?url=/noticias/prefeitura-de-itatuba-pb-...
//   /api/debug-pdf?pdf=https://arq.pciconcursos.com.br/.../edital.pdf
//
// Retorna JSON com:
//   - textoBruto: primeiros 8000 chars do PDF
//   - linhas: todas as linhas do PDF
//   - datasEncontradas: todas as datas dd/mm/yyyy no PDF
//   - dataProvaExtraida: o que o extrator atual retornaria
//   - cargosEncontrados: cargos contábeis detectados
//   - cronograma: seção do cronograma identificada

import { NextResponse } from "next/server";

const TIMEOUT_MS = 25000;

async function fetchHtml(url: string): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: ctrl.signal,
    });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchPDF(url: string): Promise<ArrayBuffer | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36",
        Accept: "application/pdf,*/*",
        Referer: "https://www.pciconcursos.com.br/",
      },
      signal: ctrl.signal,
    });
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function extrairTextoPDF(buffer: ArrayBuffer): Promise<string> {
  try {
    const { extractText } = await import("unpdf");
    const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });
    return text ?? "";
  } catch (e) {
    return `[ERRO unpdf: ${String(e)}]`;
  }
}

const MESES: Record<string, string> = {
  janeiro: "01", fevereiro: "02", março: "03", marco: "03",
  abril: "04", maio: "05", junho: "06", julho: "07",
  agosto: "08", setembro: "09", outubro: "10",
  novembro: "11", dezembro: "12",
};

function normalizarDatas(texto: string): string {
  return texto.replace(
    /(\d{1,2})\s+de\s+([a-záéíóúâêîôûãõç]+)\s+de\s+(\d{4})/gi,
    (orig, d, mes, y) => {
      const m = MESES[mes.toLowerCase()];
      return m ? d.padStart(2, "0") + "/" + m + "/" + y : orig;
    }
  );
}

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const urlParam = searchParams.get("url");
  const pdfParam = searchParams.get("pdf");

  let pdfUrl = pdfParam || "";
  const resultado: Record<string, unknown> = { timestamp: new Date().toISOString() };

  // ── 1. Se recebeu URL de notícia, extrai o link do PDF ────────────────────
  if (!pdfUrl && urlParam) {
    const noticiaUrl = urlParam.startsWith("http")
      ? urlParam
      : "https://www.pciconcursos.com.br" + urlParam;

    resultado.noticiaUrl = noticiaUrl;
    const html = await fetchHtml(noticiaUrl);

    if (!html) {
      return NextResponse.json({ erro: "Não foi possível baixar a notícia", noticiaUrl });
    }

    const cheerio = await import("cheerio");
    const $ = cheerio.load(html);

    // Procura link PDF
    $("a[href]").each((_, el) => {
      if (pdfUrl) return;
      const h = ($(el).attr("href") || "").trim();
      if (h.match(/\.pdf$/i)) {
        pdfUrl = h.startsWith("http") ? h : "https://arq.pciconcursos.com.br" + h;
      }
    });

    resultado.pdfEncontradoNaNoticia = pdfUrl || "NÃO ENCONTRADO";

    // Também retorna o texto do HTML da notícia (primeiros 3000 chars)
    resultado.textoHtmlNoticia = $("body").text()
      .replace(/\s+/g, " ")
      .trim()
      .substring(0, 3000);
  }

  if (!pdfUrl) {
    return NextResponse.json({
      ...resultado,
      erro: "Nenhum PDF encontrado. Passe ?pdf=URL_DO_PDF ou ?url=/noticias/slug",
    });
  }

  resultado.pdfUrl = pdfUrl;

  // ── 2. Baixa o PDF ────────────────────────────────────────────────────────
  const buffer = await fetchPDF(pdfUrl);
  if (!buffer) {
    return NextResponse.json({ ...resultado, erro: "Falha ao baixar o PDF" });
  }
  resultado.pdfTamanhoKB = Math.round(buffer.byteLength / 1024);

  // ── 3. Extrai texto ───────────────────────────────────────────────────────
  const textoRaw = await extrairTextoPDF(buffer);
  const textoNorm = normalizarDatas(textoRaw);

  resultado.totalChars = textoRaw.length;
  resultado.textoBruto = textoRaw.substring(0, 8000); // primeiros 8000 chars
  resultado.textoNormalizado = textoNorm.substring(0, 8000);

  // ── 4. Todas as linhas ────────────────────────────────────────────────────
  const linhas = textoNorm.split("\n").map(l => l.trim()).filter(Boolean);
  resultado.totalLinhas = linhas.length;
  resultado.todasAsLinhas = linhas; // lista completa

  // ── 5. Todas as datas dd/mm/yyyy encontradas ──────────────────────────────
  const todasDatas = [...textoNorm.matchAll(/\d{2}\/\d{2}\/\d{4}/g)].map(m => ({
    data: m[0],
    contexto: textoNorm.substring(Math.max(0, m.index! - 80), m.index! + 80).replace(/\n/g, " "),
  }));
  resultado.todasAsDatas = todasDatas;

  // ── 6. Seção do cronograma ────────────────────────────────────────────────
  const idxCrono = textoNorm.search(/cronograma/i);
  resultado.cronograma = idxCrono !== -1
    ? textoNorm.substring(idxCrono, idxCrono + 2000)
    : "NÃO ENCONTRADO";

  // ── 7. Linhas com palavras-chave de prova ─────────────────────────────────
  resultado.linhasComProva = linhas
    .filter(l => /prova|aplica[cç]|realiza[cç]/i.test(l))
    .map(l => l.substring(0, 200));

  // ── 8. Linhas com palavras-chave contábeis ────────────────────────────────
  resultado.linhasContabeis = linhas
    .filter(l => /contador|contabil|contábil|auditor|fiscal|tribut/i.test(l))
    .map(l => l.substring(0, 200));

  // ── 9. Linhas com datas ───────────────────────────────────────────────────
  resultado.linhasComData = linhas
    .filter(l => /\d{2}\/\d{2}\/\d{4}/.test(l))
    .map(l => l.substring(0, 200));

  // ── 10. Simula o extrator atual ───────────────────────────────────────────
  const { extrairDetalhesDoPDF } = await import("@/lib/pdf-extractor");
  const detalhes = await extrairDetalhesDoPDF(pdfUrl);
  resultado.extraitorAtual = detalhes;

  return NextResponse.json(resultado, {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
