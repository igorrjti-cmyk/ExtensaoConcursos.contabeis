// src/app/api/historico/route.ts
// CRUD do historico de posts usando Supabase (tabela historico_posts)

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export interface PostHistorico {
  id: number;
  concurso_id: string;
  cargo: string;
  orgao: string;
  estado: string;
  cidade: string;
  uf: string;
  posted_at: string; // ISO
}

// GET - lista todos os posts, mais recentes primeiro
export async function GET() {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ ok: true, historico: [] });

  const { data, error } = await sb
    .from("historico_posts")
    .select("*")
    .order("posted_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("Erro ao buscar historico:", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, historico: data ?? [] });
}

// POST - registra um novo post
export async function POST(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ ok: false, error: "Supabase nao configurado" }, { status: 503 });

  const body = await req.json() as { id: string; cargo: string; orgao: string; estado: string };

  // Verifica se ja foi postado hoje
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const { data: jaExiste } = await sb
    .from("historico_posts")
    .select("id")
    .eq("concurso_id", body.id)
    .gte("posted_at", hoje.toISOString())
    .maybeSingle();

  if (jaExiste) {
    return NextResponse.json({ ok: false, error: "Ja postado hoje" }, { status: 409 });
  }

  const { error } = await sb.from("historico_posts").insert({
    concurso_id: body.id,
    cargo: body.cargo,
    orgao: body.orgao,
    estado: body.estado,
  });

  if (error) {
    console.error("Erro ao inserir historico:", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE - remove um registro pelo concurso_id
export async function DELETE(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ ok: false, error: "Supabase nao configurado" }, { status: 503 });

  const { id } = await req.json() as { id: string };

  const { error } = await sb
    .from("historico_posts")
    .delete()
    .eq("concurso_id", id);

  if (error) {
    console.error("Erro ao deletar historico:", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
