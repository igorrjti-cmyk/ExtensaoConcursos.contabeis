// src/app/api/cron/resumo-semanal/route.ts
// Cron semanal (domingo 08:00) — envia resumo da semana
// Configurado em vercel.json: "0 8 * * 0"

import { NextResponse }             from "next/server";
import { getSupabase }              from "@/lib/supabase";
import { emailResumoSemanal }       from "@/lib/email";
import type { Concurso }            from "@/lib/scraper";

export const runtime    = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (
    process.env.NODE_ENV === "production" &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const sb = getSupabase();
  if (!sb) return NextResponse.json({ ok: false, error: "Supabase não configurado" });

  try {
    // Concursos ativos do cache
    const { data: cacheRow } = await sb
      .from("cache_concursos")
      .select("dados")
      .eq("chave", "concursos:v20")
      .single<{ dados: { concursos: Concurso[] } }>();

    const concursos: Concurso[] = cacheRow?.dados?.concursos ?? [];

    const hoje     = new Date();
    const semanaAtras = new Date(hoje.getTime() - 7 * 86400000);

    // Novos esta semana
    const novos = concursos.filter(c =>
      c.dataCaptura && new Date(c.dataCaptura) >= semanaAtras
    );

    // Encerrando nos próximos 7 dias
    const encerrandoEssaSemana = concursos.filter(c =>
      c.status === "Inscricoes Abertas" &&
      c.diasRestantes >= 0 &&
      c.diasRestantes <= 7
    );

    // Com prova esta semana
    const comProvaEssaSemana = concursos.filter(c => {
      if (!c.dataProva || c.dataProva === "-") return false;
      const [d, m, y] = c.dataProva.split("/").map(Number);
      const dataProva = new Date(y, m - 1, d);
      return dataProva >= hoje && dataProva <= new Date(hoje.getTime() + 7 * 86400000);
    });

    // Posts da semana
    const { count: totalPosts } = await sb
      .from("historico_posts")
      .select("id", { count: "exact", head: true })
      .gte("posted_at", semanaAtras.toISOString());

    await emailResumoSemanal({
      novos,
      encerrandoEssaSemana,
      comProvaEssaSemana,
      totalPostsEssaSemana: totalPosts ?? 0,
      totalConcursosAtivos: concursos.length,
    });

    // Registra envio
    await sb.from("notificacoes_enviadas").insert({
      tipo: "resumo_semanal",
      concurso_id: null,
    });

    return NextResponse.json({ ok: true, novos: novos.length, encerrando: encerrandoEssaSemana.length });

  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
