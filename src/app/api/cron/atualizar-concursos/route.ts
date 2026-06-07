// src/app/api/cron/atualizar-concursos/route.ts
// Cron diário (06:00) — chama /api/scrape-lote em sequência para atualizar o cache.
// Usa o endpoint de lote em vez de scrapeAllConcursos() direto para não estourar timeout.

import { NextResponse } from "next/server";

export const runtime     = "nodejs";
export const maxDuration = 300;

export async function GET(req: Request) {
  // Segurança: Vercel injeta este header nos cron jobs
  const authHeader = req.headers.get("authorization");
  if (
    process.env.NODE_ENV === "production" &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
    (req.headers.get("x-forwarded-host")
      ? `https://${req.headers.get("x-forwarded-host")}`
      : "https://concursoscontabeis.com.br");

  const inicio = Date.now();
  let totalAcumulado = 0;
  let lotesOk = 0;
  // Bug fix: TOTAL_LOTES era hardcoded — descobre o valor real no lote 0
  let totalLotes = 22; // fallback seguro
  const erros: string[] = [];

  for (let lote = 0; lote < totalLotes; lote++) {
    const isFim = lote === totalLotes - 1;
    const params = new URLSearchParams({
      lote: String(lote),
      ...(isFim ? { fim: "1" } : {}),
    });

    try {
      const res = await fetch(`${baseUrl}/api/scrape-lote?${params}`, {
        headers: { authorization: authHeader || "" },
      });
      const data = await res.json();
      // Atualiza totalLotes com o valor real retornado pela API
      if (lote === 0 && data.totalLotes) totalLotes = data.totalLotes;
      if (data.ok) {
        lotesOk++;
        totalAcumulado = data.totalAcumulado ?? totalAcumulado;
      } else {
        erros.push(`lote ${lote}: ${data.error ?? "falhou"}`);
      }
      if (data.fim) break;
    } catch (e: unknown) {
      erros.push(`lote ${lote}: ${String(e)}`);
    }
  }

  const duracaoMs = Date.now() - inicio;
  console.log(`[CRON] ${lotesOk}/${totalLotes} lotes OK | ${totalAcumulado} concursos | ${duracaoMs}ms`);

  return NextResponse.json({
    ok: erros.length === 0,
    lotesOk,
    totalLotes,
    totalAcumulado,
    duracaoMs,
    erros: erros.length > 0 ? erros : undefined,
  });
}
