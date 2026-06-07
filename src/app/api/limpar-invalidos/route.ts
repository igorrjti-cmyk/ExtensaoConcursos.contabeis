// src/app/api/limpar-invalidos/route.ts
import { NextResponse } from "next/server";
import { getSupabase }  from "@/lib/supabase";
import type { Concurso } from "@/lib/scraper";

export const runtime     = "nodejs";
export const maxDuration = 30;

const CACHE_KEY = "concursos:v20";

function provaPassou(dataProva: string, hoje: Date): boolean {
  if (!dataProva || dataProva === "-") return false;
  const m = dataProva.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return false;
  const dt = new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
  dt.setHours(0, 0, 0, 0);
  return dt < hoje;
}

function inscricaoEncerradaHaMuito(inscricaoAte: string, hoje: Date, diasMax = 90): boolean {
  if (!inscricaoAte || inscricaoAte === "Ver edital" || inscricaoAte === "-") return false;
  const m = inscricaoAte.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return false;
  const dt = new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
  dt.setHours(0, 0, 0, 0);
  const diasPassados = (hoje.getTime() - dt.getTime()) / 86400000;
  return diasPassados > diasMax;
}

export async function GET(req: Request) {
  const sb = getSupabase();
  if (!sb) {
    return NextResponse.json({ ok: false, error: "Supabase não configurado" }, { status: 503 });
  }

  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const { searchParams } = new URL(req.url);
  const soDiagnostico = searchParams.get("diagnostico") === "1";

  const { data, error } = await sb
    .from("cache_concursos")
    .select("dados, atualizado")
    .eq("chave", CACHE_KEY)
    .single();

  if (error || !data) {
    return NextResponse.json({ ok: false, error: "Cache não encontrado — chave: " + CACHE_KEY }, { status: 404 });
  }

  const concursosAntes: Concurso[] = data.dados?.concursos ?? [];

  // Diagnóstico completo de cada concurso
  const diagnostico = concursosAntes.map(c => ({
    cargo: c.cargo,
    orgao: c.orgao,
    status: c.status,
    inscricaoAte: c.inscricaoAte,
    diasRestantes: c.diasRestantes,
    dataProva: c.dataProva,
    nivel: c.nivel,
    provaPassou: provaPassou(c.dataProva, hoje),
    inscricaoVencidaHaMuito: inscricaoEncerradaHaMuito(c.inscricaoAte, hoje),
    motivo: provaPassou(c.dataProva, hoje)
      ? "REMOVER: prova passou"
      : c.status === "Encerrado"
        ? "REMOVER: encerrado"
        : inscricaoEncerradaHaMuito(c.inscricaoAte, hoje) && c.dataProva === "-"
          ? "REMOVER: inscrição encerrada há mais de 90 dias sem data de prova"
          : "MANTER",
  }));

  if (soDiagnostico) {
    return NextResponse.json({ total: concursosAntes.length, atualizado: data.atualizado, diagnostico });
  }

  const removidos: string[] = [];
  const seenIds = new Set<string>();

  // Termos genéricos que não são bancas reais
  const BANCAS_INVALIDAS = new Set([
    "ORGANIZADORA", "ORGANIZAÇÃO", "ORGANIZACAO", "EMPRESA", "COMISSÃO",
    "COMISSAO", "SECRETARIA", "A EMPRESA", "ENTIDADE", "CONTRATADA",
  ]);

  const concursosDepois = concursosAntes
    .map(c => {
      // Corrige banca genérica → "-"
      if (c.banca && BANCAS_INVALIDAS.has(c.banca.toUpperCase().trim())) {
        return { ...c, banca: "-" };
      }
      // Corrige dataResultado anterior à prova (erro de parsing do PDF)
      if (c.dataProva && c.dataProva !== "-" && c.dataResultado && c.dataResultado !== "-") {
        const toTs = (d: string) => {
          const p = d.match(/(\d{2})\/(\d{2})\/(\d{4})/);
          return p ? new Date(+p[3], +p[2]-1, +p[1]).getTime() : 0;
        };
        if (toTs(c.dataResultado) <= toTs(c.dataProva)) {
          return { ...c, dataResultado: "-" };
        }
      }
      return c;
    })
    .filter(c => {
      // Remove duplicatas por id
      if (seenIds.has(c.id)) {
        removidos.push(`${c.cargo} - ${c.orgao} (duplicata: ${c.id})`);
        return false;
      }
      seenIds.add(c.id);

      if (provaPassou(c.dataProva, hoje)) {
        removidos.push(`${c.cargo} - ${c.orgao} (prova: ${c.dataProva})`);
        return false;
      }
      if (c.status === "Encerrado") {
        removidos.push(`${c.cargo} - ${c.orgao} (status: Encerrado)`);
        return false;
      }
      if (inscricaoEncerradaHaMuito(c.inscricaoAte, hoje) && c.dataProva === "-") {
        removidos.push(`${c.cargo} - ${c.orgao} (inscrição vencida há >90 dias, sem data de prova)`);
        return false;
      }
      return true;
    });

  if (removidos.length === 0) {
    return NextResponse.json({
      ok: true,
      mensagem: "Nenhum concurso inválido encontrado no cache",
      total: concursosAntes.length,
      diagnostico,
    });
  }

  const atualizadoEm = new Date().toISOString();
  const { error: saveError } = await sb.from("cache_concursos").upsert({
    chave:      CACHE_KEY,
    dados:      { concursos: concursosDepois, atualizadoEm },
    atualizado: atualizadoEm,
  });

  if (saveError) {
    return NextResponse.json({ ok: false, error: saveError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    antes: concursosAntes.length,
    depois: concursosDepois.length,
    removidos,
    atualizadoEm,
  });
}
