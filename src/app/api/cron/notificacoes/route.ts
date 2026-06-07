// src/app/api/cron/notificacoes/route.ts
// Cron diário (08:00) — verifica concursos novos e prazos encerrando
// Configurado em vercel.json: "0 8 * * *"

import { NextResponse }         from "next/server";
import { getSupabase }          from "@/lib/supabase";
import { emailNovoConcurso, emailAlertaPrazo } from "@/lib/email";
import type { Concurso }        from "@/lib/scraper";

export const runtime = "nodejs";
export const maxDuration = 300; // Cron jobs suportam até 300s no Vercel Pro

export async function GET(req: Request) {
  // Segurança: Vercel injeta este header nos cron jobs
  const authHeader = req.headers.get("authorization");
  if (
    process.env.NODE_ENV === "production" &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const sb = getSupabase();
  if (!sb) return NextResponse.json({ ok: false, error: "Supabase não configurado" });

  const resultados = { novos: 0, alertas: 0, erros: [] as string[] };

  try {
    // Busca concursos do cache
    const { data: cacheRow } = await sb
      .from("cache_concursos")
      .select("dados")
      .eq("chave", "concursos:v20")
      .single<{ dados: { concursos: Concurso[] } }>();

    if (!cacheRow?.dados?.concursos) {
      return NextResponse.json({ ok: true, message: "Cache vazio — nada a notificar" });
    }

    const concursos = cacheRow.dados.concursos;
    const hoje      = new Date();
    hoje.setHours(0, 0, 0, 0);

    // ── 1. Notificação de concursos NOVOS ──────────────────────────────────
    // "Novo" = concurso presente no cache que NUNCA foi publicado, agendado
    // ou notificado por e-mail. Independe de dataCaptura ou limpeza de cache.
    //
    // Fontes de verdade (consultadas em paralelo):
    //   • historico_posts      — já publicado no feed/stories do Instagram
    //   • agendamentos_posts   — já agendado para publicação (publicado ou não)
    //   • notificacoes_enviadas — já gerou e-mail de notificação
    //
    // Qualquer concurso_id presente nessas tabelas é "já visto" e não gera
    // novo e-mail, mesmo após limpeza de cache ou re-scraping completo.

    const LIMITE_POR_EXECUCAO = 5;

    // 3 queries em paralelo — monta o set de IDs já vistos
    const [resHistorico, resAgendamentos, resNotificados] = await Promise.all([
      sb.from("historico_posts").select("concurso_id"),
      sb.from("agendamentos_posts").select("concurso_id"),
      sb.from("notificacoes_enviadas").select("concurso_id").eq("tipo", "novo_concurso"),
    ]);

    const idsJaVistos = new Set<string>([
      ...(resHistorico.data    ?? []).map(r => r.concurso_id).filter(Boolean),
      ...(resAgendamentos.data ?? []).map(r => r.concurso_id).filter(Boolean),
      ...(resNotificados.data  ?? []).map(r => r.concurso_id).filter(Boolean),
    ]);

    for (const c of concursos) {
      if (resultados.novos >= LIMITE_POR_EXECUCAO) break;

      // Pula se já foi publicado, agendado ou notificado alguma vez
      if (idsJaVistos.has(c.id)) continue;

      const ok = await emailNovoConcurso(c);
      if (ok) {
        await sb.from("notificacoes_enviadas").insert({
          tipo: "novo_concurso",
          concurso_id: c.id,
        });
        idsJaVistos.add(c.id); // evita reprocessar no mesmo loop
        resultados.novos++;
      }
    }

    // ── 2. Alerta de prazo (encerrando em até 3 dias) ──────────────────────
    const encerrando = concursos.filter(c =>
      c.status === "Inscricoes Abertas" &&
      c.diasRestantes >= 0 &&
      c.diasRestantes <= 3
    );

    if (encerrando.length > 0) {
      // Verifica se já enviamos alerta hoje
      const inicioHoje = hoje.toISOString();
      const { data: alertaHoje } = await sb
        .from("notificacoes_enviadas")
        .select("id")
        .eq("tipo", "prazo_3dias")
        .gte("enviado_em", inicioHoje)
        .maybeSingle();

      if (!alertaHoje) {
        const ok = await emailAlertaPrazo(encerrando);
        if (ok) {
          await sb.from("notificacoes_enviadas").insert({
            tipo: "prazo_3dias",
            concurso_id: null,
          });
          resultados.alertas++;
        }
      }
    }

  } catch (e: unknown) {
    resultados.erros.push(String(e));
  }

  return NextResponse.json({ ok: true, ...resultados });
}
