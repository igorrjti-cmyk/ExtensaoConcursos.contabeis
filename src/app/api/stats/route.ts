// src/app/api/stats/route.ts
// Estatísticas de posts baseadas no histórico do Supabase

import { NextResponse } from "next/server";
import { getSupabase }  from "@/lib/supabase";

export async function GET() {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ ok: true, stats: gerarStatsVazias() });

  // Busca todos os posts dos últimos 90 dias
  const noventa = new Date();
  noventa.setDate(noventa.getDate() - 90);

  const { data: posts, error } = await sb
    .from("historico_posts")
    .select("*")
    .gte("posted_at", noventa.toISOString())
    .order("posted_at", { ascending: false });

  if (error || !posts) {
    return NextResponse.json({ ok: true, stats: gerarStatsVazias() });
  }

  // ── Por semana ────────────────────────────────────────────────────────────
  const porSemana: Record<string, number> = {};
  for (const p of posts) {
    const d = new Date(p.posted_at);
    // Início da semana (segunda-feira)
    const diaSemana = d.getDay() === 0 ? 6 : d.getDay() - 1;
    const segunda   = new Date(d);
    segunda.setDate(d.getDate() - diaSemana);
    const chave = segunda.toISOString().slice(0, 10);
    porSemana[chave] = (porSemana[chave] || 0) + 1;
  }

  // Últimas 8 semanas
  const semanasData = Object.entries(porSemana)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([semana, total]) => ({
      semana,
      label: new Date(semana).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
      total,
    }));

  // ── Por estado ────────────────────────────────────────────────────────────
  const porEstado: Record<string, number> = {};
  for (const p of posts) {
    porEstado[p.estado] = (porEstado[p.estado] || 0) + 1;
  }
  const topEstados = Object.entries(porEstado)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([estado, total]) => ({ estado, total }));

  // ── Por cargo ─────────────────────────────────────────────────────────────
  const porCargo: Record<string, number> = {};
  for (const p of posts) {
    // Normaliza cargo
    const cargo = p.cargo.split(" e ")[0].trim();
    porCargo[cargo] = (porCargo[cargo] || 0) + 1;
  }
  const topCargos = Object.entries(porCargo)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([cargo, total]) => ({ cargo, total }));

  // ── Totais ────────────────────────────────────────────────────────────────
  const hoje  = new Date();
  const semanaAtras = new Date(hoje.getTime() - 7  * 86400000);
  const mesAtras    = new Date(hoje.getTime() - 30 * 86400000);

  const totalSemana = posts.filter(p => new Date(p.posted_at) >= semanaAtras).length;
  const totalMes    = posts.filter(p => new Date(p.posted_at) >= mesAtras).length;
  const totalGeral  = posts.length;

  return NextResponse.json({
    ok: true,
    stats: {
      totalGeral,
      totalSemana,
      totalMes,
      semanasData,
      topEstados,
      topCargos,
    },
  });
}

function gerarStatsVazias() {
  return {
    totalGeral:  0,
    totalSemana: 0,
    totalMes:    0,
    semanasData: [],
    topEstados:  [],
    topCargos:   [],
  };
}
