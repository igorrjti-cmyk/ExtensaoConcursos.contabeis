// src/app/api/cron/publicar-agendados/route.ts
// Cron job a cada 5 minutos — publica agendamentos vencidos via Instagram Graph API
// Os cards base64 foram gerados no navegador do usuário ao agendar e estão salvos no banco
// Sem dependência de serviço externo de screenshot!

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime     = "nodejs";
export const maxDuration = 60;

const IG_TOKEN = process.env.IG_ACCESS_TOKEN || "";
const IG_ID    = process.env.IG_ACCOUNT_ID   || "17841459409972261";
const IG_VER   = "v19.0";

// Faz upload do base64 para o Imgur e retorna a URL pública
async function uploadBase64(base64: string, label = ""): Promise<{ url: string | null; erro?: string }> {
  try {
    const b64 = base64.includes(",") ? base64.split(",")[1] : base64;
    const tamanhoKB = Math.round(b64.length * 0.75 / 1024);

    const res = await fetch("https://api.imgur.com/3/image", {
      method: "POST",
      headers: { "Authorization": "Client-ID 546c25a59c58ad7", "Content-Type": "application/json" },
      body: JSON.stringify({ image: b64, type: "base64" }),
    });

    const httpStatus = res.status;
    const data = await res.json() as { success: boolean; data?: { link: string }; error?: { message?: string; code?: number } | string };

    if (data.success && data.data?.link) {
      return { url: data.data.link };
    }

    const errMsg = typeof data.error === "string"
      ? data.error
      : data.error?.message ?? `HTTP ${httpStatus}`;

    return { url: null, erro: `Imgur [${label}] ${tamanhoKB}KB: ${errMsg}` };
  } catch (e: unknown) {
    return { url: null, erro: `Upload exception [${label}]: ${String(e)}` };
  }
}

// Cria container, aguarda FINISHED e publica — retorna id e erro detalhado
async function publicarViaAPI(imageUrl: string, tipo: "IMAGE" | "STORIES", legenda?: string): Promise<{ id: string | null; erro?: string }> {
  try {
    const bodyContainer: Record<string, unknown> = {
      image_url: imageUrl, media_type: tipo, access_token: IG_TOKEN,
    };
    if (legenda && tipo === "IMAGE") bodyContainer.caption = legenda;

    const cRes  = await fetch(`https://graph.facebook.com/${IG_VER}/${IG_ID}/media`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyContainer),
    });
    const cData = await cRes.json() as { id?: string; error?: { message: string; code?: number; error_subcode?: number } };
    if (!cData.id) {
      return { id: null, erro: `container: ${cData.error?.message ?? "sem id"} (code ${cData.error?.code})` };
    }

    // Aguarda processamento (máx 30s)
    let statusFinal = "";
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 3000));
      const sRes  = await fetch(`https://graph.facebook.com/${IG_VER}/${cData.id}?fields=status_code,status&access_token=${IG_TOKEN}`);
      const sData = await sRes.json() as { status_code?: string; status?: string };
      statusFinal = sData.status ?? sData.status_code ?? "";
      if (sData.status_code === "FINISHED") break;
      if (sData.status_code === "ERROR")    return { id: null, erro: `container ERROR: ${sData.status}` };
    }

    const pRes  = await fetch(`https://graph.facebook.com/${IG_VER}/${IG_ID}/media_publish`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: cData.id, access_token: IG_TOKEN }),
    });
    const pData = await pRes.json() as { id?: string; error?: { message: string } };
    if (pData.id) return { id: pData.id };
    return { id: null, erro: `publish: ${pData.error?.message ?? "sem id"} | status: ${statusFinal}` };

  } catch (e: unknown) {
    return { id: null, erro: `exception: ${String(e)}` };
  }
}

export async function GET(req: Request) {
  // Segurança: só Vercel Cron pode chamar
  const auth = req.headers.get("authorization");
  const url  = new URL(req.url);
  const isTest = url.searchParams.get("test") === "1";
  // Aceita: Vercel Cron (Bearer CRON_SECRET) ou chamada manual do painel (mesmo secret)
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const sb = getSupabase();
  if (!sb) return NextResponse.json({ ok: false, error: "Supabase nao configurado" });

  // Busca agendamentos pendentes vencidos (com imagens salvas)
  // Em modo test, também mostra agendamentos futuros (para diagnóstico)
  const query = sb.from("agendamentos_posts").select("id, concurso_id, cargo, orgao, estado, modo, agendado_para, publicado, feed_base64, stories_base64, legenda, tentativas").eq("publicado", false).limit(10);
  const { data: pendentes, error } = isTest
    ? await query.order("agendado_para", { ascending: true })
    : await query.lte("agendado_para", new Date().toISOString());

  if (error) return NextResponse.json({ ok: false, error: error.message });
  if (!pendentes?.length) {
    return NextResponse.json({ ok: true, processados: 0, msg: "Nenhum agendamento pendente" });
  }

  const resultados = [];

  for (const ag of pendentes) {
    const r: Record<string, unknown> = {
      id:           ag.id,
      cargo:        ag.cargo,
      modo:         ag.modo,
      agendado_para: ag.agendado_para,
      tem_feed:     !!ag.feed_base64,
      tem_stories:  !!ag.stories_base64,
    };

    // MODO SIMULAÇÃO: apenas informa o que faria, sem publicar nem marcar
    if (isTest) {
      r.status = "🔍 simulação";
      if (ag.modo === "feed" || ag.modo === "ambos")
        r.feed = ag.feed_base64 ? "✓ imagem disponível" : "⚠️ sem imagem salva";
      if (ag.modo === "stories" || ag.modo === "ambos")
        r.stories = ag.stories_base64 ? "✓ imagem disponível" : "⚠️ sem imagem salva";
      resultados.push(r);
      continue;
    }

    try {
      let postIdFeed = null, postIdStories = null;

      // ── Publica Feed ──────────────────────────────────────────────────────
      if ((ag.modo === "feed" || ag.modo === "ambos") && ag.feed_base64) {
        const { url: imageUrl, erro: erroUpload } = await uploadBase64(ag.feed_base64 as string, "feed");
        if (imageUrl) {
          const { id: pubId, erro: erroPub } = await publicarViaAPI(imageUrl, "IMAGE", ag.legenda);
          postIdFeed = pubId;
          r.feed = pubId ? `✅ postId: ${pubId}` : `❌ Graph API: ${erroPub}`;
        } else {
          r.feed = `❌ upload: ${erroUpload}`;
        }
      } else if (ag.modo === "feed" || ag.modo === "ambos") {
        r.feed = "⚠️ sem imagem salva";
      }

      // ── Publica Stories ───────────────────────────────────────────────────
      if ((ag.modo === "stories" || ag.modo === "ambos") && ag.stories_base64) {
        const { url: imageUrl, erro: erroUpload } = await uploadBase64(ag.stories_base64 as string, "stories");
        if (imageUrl) {
          const { id: pubId, erro: erroPub } = await publicarViaAPI(imageUrl, "STORIES");
          postIdStories = pubId;
          r.stories = pubId ? `✅ postId: ${pubId}` : `❌ Graph API: ${erroPub}`;
        } else {
          r.stories = `❌ upload: ${erroUpload}`;
        }
      } else if (ag.modo === "stories" || ag.modo === "ambos") {
        r.stories = "⚠️ sem imagem salva";
      }

      const ok = postIdFeed !== null || postIdStories !== null;
      const falhouTotal = !ok &&
        ((ag.modo === "feed" || ag.modo === "ambos") ? postIdFeed === null : false) ||
        ((ag.modo === "stories" || ag.modo === "ambos") ? postIdStories === null : false);

      if (ok) {
        // Sucesso: marca publicado e limpa base64
        await sb.from("agendamentos_posts").update({
          publicado:       true,
          publicado_em:    new Date().toISOString(),
          post_id_feed:    postIdFeed,
          post_id_stories: postIdStories,
          feed_base64:     null,
          stories_base64:  null,
        }).eq("id", ag.id);

        await sb.from("historico_posts").insert({
          concurso_id: ag.concurso_id,
          cargo:       ag.cargo,
          orgao:       ag.orgao,
          estado:      ag.estado,
        });

        r.status = "✅ publicado";
      } else {
        // FIX 2: falhou — NÃO marca como publicado, permite retry na próxima execução
        // Mas registra tentativa para não tentar infinitamente (máx 3 tentativas)
        const tentativas = (ag.tentativas ?? 0) + 1;
        if (tentativas >= 3) {
          await sb.from("agendamentos_posts")
            .update({ publicado: true, publicado_em: new Date().toISOString() })
            .eq("id", ag.id);
          r.status = "❌ falhou após 3 tentativas — cancelado";
        } else {
          await sb.from("agendamentos_posts")
            .update({ tentativas })
            .eq("id", ag.id);
          r.status = `❌ falhou (tentativa ${tentativas}/3 — tentará novamente)`;
        }
      }

    } catch (e: unknown) {
      r.status = "erro";
      r.erro   = String(e);
    }

    resultados.push(r);
  }

  const agora = new Date();
  const agoraBRT = new Date(agora.getTime() - 3 * 60 * 60 * 1000);

  return NextResponse.json({
    ok:            true,
    modo:          isTest ? "simulacao" : "producao",
    processados:   resultados.length,
    resultados,
    timestamp_utc: agora.toISOString(),
    timestamp_brt: agoraBRT.toISOString().replace("T", " ").slice(0, 16) + " (Brasília)",
    proxima_execucao_utc: new Date(Math.ceil(agora.getTime() / 300000) * 300000).toISOString(),
    aviso: isTest ? "SIMULACAO: nenhuma publicacao foi feita" : undefined,
  });
}
