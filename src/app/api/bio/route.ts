// src/app/api/bio/route.ts
// Retorna os concursos publicados no Instagram (histórico) cruzados com o cache,
// para exibir na página pública /bio (link da bio do Instagram).
// Ordena por: postados hoje primeiro, depois mais recentes.

import { NextResponse } from "next/server";
import { getSupabase }  from "@/lib/supabase";
import type { Concurso } from "@/lib/scraper";

export const runtime = "nodejs";

export interface BioItem {
  id: string;
  cargo: string;
  orgao: string;
  estado: string;
  salario: string;
  vagas: string;
  nivel: string;
  banca: string;
  status: string;
  inscricaoAte: string;
  diasRestantes: number;
  dataProva: string;
  linkEdital: string;
  linkNoticia: string;
  posted_at: string;
  ativo: boolean; // ainda aparece no cache (inscrições não encerradas)
}

export async function GET() {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ ok: false, error: "Supabase não configurado" }, { status: 503 });

  try {
    // 1. Busca histórico de posts (últimos 90 dias)
    const noventa = new Date(Date.now() - 90 * 86400000).toISOString();
    const { data: historico, error: errH } = await sb
      .from("historico_posts")
      .select("*")
      .gte("posted_at", noventa)
      .order("posted_at", { ascending: false })
      .limit(100);

    if (errH) throw errH;
    if (!historico || historico.length === 0) {
      return NextResponse.json({ ok: true, items: [], total: 0 });
    }

    // 2. Busca cache atual para cruzar dados (salário, vagas, links, status)
    const { data: cacheRow } = await sb
      .from("cache_concursos")
      .select("dados")
      .eq("chave", "concursos:v20")
      .single<{ dados: { concursos: Concurso[] } }>();

    const concursosAtivos: Concurso[] = cacheRow?.dados?.concursos ?? [];
    const mapaAtivos = new Map(concursosAtivos.map(c => [c.id, c]));

    // 3. Deduplica por concurso_id (mantém o post mais recente de cada concurso)
    const vistos = new Set<string>();
    const items: BioItem[] = [];

    for (const h of historico) {
      if (vistos.has(h.concurso_id)) continue;
      vistos.add(h.concurso_id);

      const ativo = mapaAtivos.get(h.concurso_id);

      items.push({
        id:            h.concurso_id,
        cargo:         ativo?.cargo         ?? h.cargo,
        orgao:         ativo?.orgao         ?? h.orgao,
        estado:        ativo?.estado        ?? h.estado,
        salario:       ativo?.salario       ?? "Ver edital",
        vagas:         ativo?.vagas         ?? "Ver edital",
        nivel:         ativo?.nivel         ?? "Superior",
        banca:         ativo?.banca         ?? "-",
        status:        ativo?.status        ?? "Encerrado",
        inscricaoAte:  ativo?.inscricaoAte  ?? "-",
        diasRestantes: ativo?.diasRestantes ?? -1,
        dataProva:     ativo?.dataProva     ?? "-",
        linkEdital:    ativo?.linkEdital    ?? ativo?.linkNoticia ?? "",
        linkNoticia:   ativo?.linkNoticia   ?? "",
        posted_at:     h.posted_at,
        ativo:         !!ativo,
      });
    }

    return NextResponse.json({ ok: true, items, total: items.length, atualizado: new Date().toISOString() });

  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
