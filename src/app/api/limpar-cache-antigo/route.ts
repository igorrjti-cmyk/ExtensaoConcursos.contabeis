// src/app/api/limpar-cache-antigo/route.ts
// Remove TODAS as chaves de cache antigas do Supabase, mantendo apenas v20.
// Chamar: GET /api/limpar-cache-antigo
// Resolve o problema de caches obsoletos (v2, v5, v7..v19) ainda sendo servidos.

import { NextResponse } from "next/server";
import { getSupabase }  from "@/lib/supabase";

export const runtime     = "nodejs";
export const maxDuration = 30;

const CHAVE_ATUAL = "concursos:v20";

export async function GET() {
  const sb = getSupabase();
  if (!sb) {
    return NextResponse.json({ ok: false, error: "Supabase não configurado" }, { status: 503 });
  }

  // 1. Lista todas as chaves existentes
  const { data: rows, error: listError } = await sb
    .from("cache_concursos")
    .select("chave");

  if (listError || !rows) {
    return NextResponse.json({ ok: false, error: "Erro ao listar chaves" }, { status: 500 });
  }

  const todasChaves = rows.map((r: { chave: string }) => r.chave);
  const chavesAnteriores = todasChaves.filter(c => c !== CHAVE_ATUAL && c !== "scrape-lote:progresso");

  if (chavesAnteriores.length === 0) {
    return NextResponse.json({
      ok: true,
      mensagem: "Nenhuma chave antiga encontrada. Supabase já está limpo.",
      chavesExistentes: todasChaves,
    });
  }

  // 2. Remove cada chave antiga
  const removidas: string[] = [];
  const erros: string[] = [];

  for (const chave of chavesAnteriores) {
    const { error } = await sb
      .from("cache_concursos")
      .delete()
      .eq("chave", chave);

    if (error) {
      erros.push(`${chave}: ${error.message}`);
    } else {
      removidas.push(chave);
    }
  }

  return NextResponse.json({
    ok: erros.length === 0,
    removidas,
    mantidas: [CHAVE_ATUAL],
    erros: erros.length > 0 ? erros : undefined,
  });
}
