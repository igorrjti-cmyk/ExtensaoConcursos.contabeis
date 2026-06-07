// src/app/api/inspecionar-cache/route.ts
// Diagnóstico: lista todos os concursos do cache com seus campos de data
// Acesse: GET /api/inspecionar-cache

import { NextResponse } from "next/server";
import { getSupabase }  from "@/lib/supabase";
import type { Concurso } from "@/lib/scraper";

export const runtime     = "nodejs";
export const maxDuration = 10;

export async function GET() {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: "Supabase não configurado" }, { status: 503 });

  const hoje = new Date(); hoje.setHours(0,0,0,0);

  // Lê todas as chaves do cache
  const { data: rows } = await sb
    .from("cache_concursos")
    .select("chave, dados, atualizado");

  if (!rows) return NextResponse.json({ error: "Sem dados" }, { status: 404 });

  const result: Record<string, unknown> = {};

  for (const row of rows) {
    const concursos: Concurso[] = row.dados?.concursos ?? [];
    result[row.chave] = {
      total: concursos.length,
      atualizado: row.atualizado,
      concursos: concursos.map(c => {
        // Verifica se a prova passou
        let provaPassou = false;
        if (c.dataProva && c.dataProva !== "-") {
          const m = c.dataProva.match(/(\d{2})\/(\d{2})\/(\d{4})/);
          if (m) {
            const dt = new Date(parseInt(m[3]), parseInt(m[2])-1, parseInt(m[1]));
            provaPassou = dt < hoje;
          }
        }
        return {
          cargo: c.cargo,
          orgao: c.orgao,
          status: c.status,
          inscricaoAte: c.inscricaoAte,
          diasRestantes: c.diasRestantes,
          dataProva: c.dataProva,
          dataResultado: c.dataResultado,
          nivel: c.nivel,
          provaPassou,
        };
      }),
    };
  }

  return NextResponse.json(result, {
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
