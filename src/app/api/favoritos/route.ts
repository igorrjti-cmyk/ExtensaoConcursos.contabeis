// src/app/api/favoritos/route.ts

import { NextResponse } from "next/server";
import { getSupabase }  from "@/lib/supabase";

export interface Favorito {
  id: number;
  concurso_id: string;
  cargo: string;
  orgao: string;
  estado: string;
  cidade: string;
  uf: string;
  nota: string | null;
  criado_em: string;
}

export async function GET() {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ ok: true, favoritos: [] });

  const { data, error } = await sb
    .from("favoritos")
    .select("*")
    .order("criado_em", { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, favoritos: data ?? [] });
}

export async function POST(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ ok: false, error: "Supabase não configurado" }, { status: 503 });

  const body = await req.json() as {
    concurso_id: string; cargo: string; orgao: string; estado: string; cidade?: string; uf?: string; nota?: string;
  };

  // Upsert — se já favorito, atualiza nota
  const { data, error } = await sb
    .from("favoritos")
    .upsert({
      concurso_id: body.concurso_id,
      cargo:       body.cargo,
      orgao:       body.orgao,
      estado:      body.estado,
      cidade:      body.cidade ?? "",
      uf:          body.uf ?? body.estado,
      nota:        body.nota ?? null,
    }, { onConflict: "concurso_id" })
    .select()
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, favorito: data });
}

export async function DELETE(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ ok: false, error: "Supabase não configurado" }, { status: 503 });

  const { concurso_id } = await req.json() as { concurso_id: string };

  const { error } = await sb
    .from("favoritos")
    .delete()
    .eq("concurso_id", concurso_id);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
