import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ ok: false, error: "Supabase nao configurado" });

  const { data, error } = await sb
    .from("agendamentos_posts")
    .select("feed_base64, stories_base64, legenda, modo")
    .eq("id", id)
    .single();

  if (error || !data) return NextResponse.json({ ok: false, error: "Agendamento nao encontrado" }, { status: 404 });

  return NextResponse.json({
    ok:             true,
    feed_base64:    data.feed_base64    ?? null,
    stories_base64: data.stories_base64 ?? null,
    legenda:        data.legenda        ?? null,
    modo:           data.modo,
  });
}
