"use client";

import { useEffect, useState, useCallback } from "react";

interface Agendamento {
  id: number;
  concurso_id: string;
  cargo: string;
  orgao: string;
  estado: string;
  modo: "feed" | "stories" | "ambos";
  agendado_para: string;
  publicado: boolean;
  publicado_em: string | null;
  post_id_feed: string | null;
  post_id_stories: string | null;
  criado_em: string;
}

interface HistoricoItem {
  id: number;
  concurso_id: string;
  cargo: string;
  orgao: string;
  estado: string;
  posted_at: string;
}

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const DIAS_SEMANA = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
const MODO_LABEL: Record<string, string> = { feed: "📷 Feed", stories: "📱 Stories", ambos: "📲 Feed+Stories" };
const MODO_COLOR: Record<string, string> = { feed: "#E1306C", stories: "#833AB4", ambos: "#00C896" };

function mesAno(data: Date) {
  return `${MESES[data.getMonth()]} ${data.getFullYear()}`;
}
function isoData(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function CalendarioPage() {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [historico, setHistorico]       = useState<HistoricoItem[]>([]);
  const [loading, setLoading]           = useState(true);
  const [hoje] = useState(new Date());
  const [mesAtual, setMesAtual]         = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(isoData(hoje));
  const [deletando, setDeletando]       = useState<number | null>(null);
  const [publicando, setPublicando]     = useState<number | null>(null);
  const [toastMsg, setToastMsg]         = useState<string | null>(null);
  const [cronStatus, setCronStatus]     = useState<Record<string,unknown> | null>(null);
  const [cronLoading, setCronLoading]   = useState(false);
  const [mostrarCron, setMostrarCron]   = useState(false);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 5000);
  };

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [resAg, resHist] = await Promise.all([
        fetch("/api/agendamentos"),
        fetch("/api/historico"),
      ]);
      const [dAg, dHist] = await Promise.all([resAg.json(), resHist.json()]);
      if (dAg.ok)   setAgendamentos(dAg.agendamentos   ?? []);
      if (dHist.ok) setHistorico(dHist.historico ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function deletarAgendamento(id: number) {
    setDeletando(id);
    await fetch("/api/agendamentos", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    await carregar();
    setDeletando(null);
  }

  async function testarCron(simular = true) {
    setCronLoading(true);
    setCronStatus(null);
    try {
      // Usa rota intermediária — o secret fica no servidor, não exposto no JS
      const res = await fetch("/api/cron/disparar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ simulacao: simular }),
      });
      const data = await res.json();
      setCronStatus(data);
      setMostrarCron(true);
      if (!simular && data.processados > 0) {
        showToast(`✅ Cron executado: ${data.processados} publicação(ões) processada(s)`);
        await carregar();
      } else if (!simular) {
        showToast("ℹ️ Cron executado: nenhum agendamento pendente no momento");
      }
    } catch (e: unknown) {
      setCronStatus({ ok: false, erro: String(e) });
      setMostrarCron(true);
    } finally {
      setCronLoading(false);
    }
  }

  async function publicarAgora(ag: Agendamento) {
    setPublicando(ag.id);
    try {
      // Chama a extensão para publicar imediatamente
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chrome = (window as any).chrome;
      if (!chrome?.runtime?.sendMessage) {
        showToast("❌ Extensão não encontrada. Instale a extensão no Chrome.");
        return;
      }
      const EXT_ID = "phmnhackebfpjcjpdopobdalmaolbglk";

      // Busca as imagens do agendamento do banco
      const res = await fetch(`/api/agendamentos/${ag.id}/imagens`);
      const data = await res.json();

      if (!data.ok || (!data.feed_base64 && !data.stories_base64)) {
        showToast("❌ Imagens não encontradas. Reagende esta publicação no painel.");
        return;
      }

      await new Promise<void>((resolve, reject) => {
        chrome.runtime.sendMessage(
          EXT_ID,
          {
            type: "PUBLICAR_INSTAGRAM",
            feedBase64:    data.feed_base64    || null,
            storiesBase64: data.stories_base64 || null,
            legenda:       data.legenda        || null,
            agendadoPara:  null,
          },
          (r: { ok: boolean } | undefined) => {
            if (chrome.runtime.lastError || !r?.ok) {
              reject(new Error(chrome.runtime.lastError?.message || "Extensão não respondeu"));
            } else resolve();
          }
        );
      });

      // Marca como publicado
      await fetch("/api/agendamentos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ag.id }),
      });

      showToast("✅ Publicado com sucesso!");
      await carregar();
    } catch (e: unknown) {
      showToast("❌ " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setPublicando(null);
    }
  }

  // Monta o grid do mês
  const diasNoMes = new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1, 0).getDate();
  const primeiroDia = new Date(mesAtual.getFullYear(), mesAtual.getMonth(), 1).getDay();

  // Mapa data → eventos
  const eventosMap: Record<string, { agendados: Agendamento[]; postados: HistoricoItem[] }> = {};
  agendamentos.forEach(a => {
    const data = a.agendado_para.slice(0, 10);
    if (!eventosMap[data]) eventosMap[data] = { agendados: [], postados: [] };
    eventosMap[data].agendados.push(a);
  });
  historico.forEach(h => {
    const data = h.posted_at.slice(0, 10);
    if (!eventosMap[data]) eventosMap[data] = { agendados: [], postados: [] };
    eventosMap[data].postados.push(h);
  });

  const eventosDia = diaSelecionado ? (eventosMap[diaSelecionado] ?? { agendados: [], postados: [] }) : null;

  return (
    <>
    {toastMsg && (
      <div style={{
        position: "fixed", bottom: 24, right: 24, zIndex: 9999,
        background: toastMsg.startsWith("✅") ? "rgba(0,200,150,.95)" : "rgba(255,75,75,.95)",
        color: "#fff", padding: "12px 20px", borderRadius: 10,
        fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 13,
        boxShadow: "0 8px 24px rgba(0,0,0,.4)",
      }}>{toastMsg}</div>
    )}
    <div style={{ minHeight: "100vh", background: "#060E20", fontFamily: "'Sora',sans-serif", color: "#fff" }}>
      <link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800;900&display=swap" rel="stylesheet" />
      <style>{`
        * { box-sizing: border-box; }
        .dia-cell { transition: all .15s; cursor: pointer; }
        .dia-cell:hover { background: rgba(255,255,255,.06) !important; }
        .dia-cell.hoje { box-shadow: inset 0 0 0 2px #00C896; }
        .dia-cell.selecionado { background: rgba(0,200,150,.12) !important; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        .evento-item { animation: fadeUp .25s ease both; }
        input, select { font-size: max(12px,16px) }
        @media(max-width:700px){
          .calendario-grid { grid-template-columns: 1fr !important; max-height: unset !important; }
          .calendario-grid > div:last-child { border-left: none !important; border-top: 1px solid rgba(255,255,255,.06); max-height: 400px; overflow-y: auto; }
          .cal-header { flex-direction: column !important; align-items: flex-start !important; gap: 12px !important; padding: 16px 16px 14px !important; }
          .cal-header > div:last-child { display: flex; flex-wrap: wrap; gap: 6px; width: 100%; }
          .cal-header > div:last-child > * { flex: 1; text-align: center; }
        }
      `}</style>

      {/* Header */}
      <div className="cal-header" style={{ padding: "28px 32px 20px", borderBottom: "1px solid rgba(255,255,255,.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, background: "linear-gradient(90deg,#00C896,#00E5A8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            📅 Calendário de Publicações
          </h1>
          <p style={{ color: "rgba(255,255,255,.3)", fontSize: 12, marginTop: 4 }}>
            Agendamentos futuros e histórico de posts publicados
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={() => testarCron(true)}
            disabled={cronLoading}
            title="Verifica agendamentos sem publicar"
            style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid rgba(255,184,0,.3)", background: "rgba(255,184,0,.08)", color: "#FFB800", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
          >{cronLoading ? "⏳" : "🔍 Diagnosticar"}</button>
          <button
            onClick={() => testarCron(false)}
            disabled={cronLoading}
            title="Executa o cron agora e publica agendamentos vencidos"
            style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid rgba(0,200,150,.3)", background: "rgba(0,200,150,.08)", color: "#00C896", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
          >{cronLoading ? "⏳ Executando..." : "▶ Executar cron agora"}</button>
          <a href="/" style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,.1)", color: "rgba(255,255,255,.5)", fontSize: 12, textDecoration: "none", fontWeight: 700 }}>
            ← Painel
          </a>
        </div>
      </div>

      {/* Painel de status do cron */}
      {mostrarCron && cronStatus && (
        <div style={{ margin: "0 24px 0", padding: "14px 20px", background: "rgba(0,0,0,.3)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: (cronStatus.ok as boolean) ? "#00C896" : "#FF4B4B" }}>
              {(cronStatus.ok as boolean) ? "✅" : "❌"} Cron — {(cronStatus.modo as string) === "simulacao" ? "Diagnóstico (sem publicar)" : "Execução real"}
            </span>
            <button onClick={() => setMostrarCron(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,.3)", cursor: "pointer", fontSize: 16 }}>×</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
            {[
              { label: "Horário UTC", value: (cronStatus.timestamp_utc as string)?.slice(11,16) + " UTC" },
              { label: "Horário Brasília", value: (cronStatus.timestamp_brt as string)?.slice(11,16) + " BRT" },
              { label: "Agendamentos processados", value: String(cronStatus.processados ?? 0) },
            ].map(s => (
              <div key={s.label} style={{ background: "rgba(255,255,255,.03)", borderRadius: 8, padding: "10px 14px" }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,.3)", marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>{s.value}</div>
              </div>
            ))}
          </div>
          {/* Resultados por agendamento */}
          {(cronStatus.resultados as unknown[])?.length > 0 && (
            <div>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,.3)", marginBottom: 8, fontWeight: 700 }}>DETALHES</p>
              {(cronStatus.resultados as Record<string,unknown>[]).map((r, i) => (
                <div key={i} style={{ fontSize: 11, padding: "6px 10px", background: "rgba(255,255,255,.02)", borderRadius: 6, marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "rgba(255,255,255,.6)" }}>{r.cargo as string} · {r.modo as string}</span>
                  <span style={{ color: (r.status as string)?.includes("✅") ? "#00C896" : "#FF4B4B", fontWeight: 700 }}>{r.status as string}</span>
                </div>
              ))}
            </div>
          )}
          {(cronStatus.processados as number) === 0 && (
            <div style={{ fontSize: 11, color: "rgba(255,255,255,.3)", textAlign: "center", padding: "8px 0" }}>
              {(cronStatus.modo as string) === "simulacao"
                ? "Nenhum agendamento com horário vencido encontrado"
                : "Nenhum agendamento pendente no momento"}
            </div>
          )}
          <div style={{ marginTop: 10, padding: "8px 12px", background: "rgba(255,184,0,.06)", border: "1px solid rgba(255,184,0,.15)", borderRadius: 8 }}>
            <p style={{ fontSize: 10, color: "#FFB800", fontWeight: 700 }}>⏰ FUSO HORÁRIO</p>
            <p style={{ fontSize: 10, color: "rgba(255,255,255,.4)", marginTop: 4 }}>
              O Vercel usa UTC. Brasília = UTC-3. Se você agendar para 10:00 BRT, o cron dispara às 13:00 UTC.
              A próxima execução automática é às {(cronStatus.proxima_execucao_utc as string)?.slice(11,16)} UTC.
            </p>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 0, maxHeight: "calc(100vh - 89px)" }}
        className="calendario-grid">

        {/* CALENDÁRIO */}
        <div style={{ padding: "24px 28px", overflowY: "auto" }}>

          {/* Navegação mês */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <button
              onClick={() => setMesAtual(new Date(mesAtual.getFullYear(), mesAtual.getMonth() - 1, 1))}
              style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", color: "#fff", borderRadius: 8, width: 36, height: 36, cursor: "pointer", fontSize: 16 }}
            >‹</button>
            <h2 style={{ fontSize: 18, fontWeight: 800 }}>{mesAno(mesAtual)}</h2>
            <button
              onClick={() => setMesAtual(new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1, 1))}
              style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", color: "#fff", borderRadius: 8, width: 36, height: 36, cursor: "pointer", fontSize: 16 }}
            >›</button>
          </div>

          {/* Dias da semana */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 8 }}>
            {DIAS_SEMANA.map(d => (
              <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.3)", padding: "6px 0" }}>{d}</div>
            ))}
          </div>

          {/* Grid de dias */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
            {/* Células vazias antes do dia 1 */}
            {Array.from({ length: primeiroDia }).map((_, i) => <div key={`v${i}`} />)}

            {Array.from({ length: diasNoMes }).map((_, i) => {
              const dia = i + 1;
              const dataStr = `${mesAtual.getFullYear()}-${String(mesAtual.getMonth() + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
              const eventos = eventosMap[dataStr];
              const ehHoje = dataStr === isoData(hoje);
              const selecionado = dataStr === diaSelecionado;
              const nAgendados = eventos?.agendados.filter(a => !a.publicado).length ?? 0;
              const nPostados  = eventos?.postados.length ?? 0;
              const nPublicadosAg = eventos?.agendados.filter(a => a.publicado).length ?? 0;

              return (
                <div
                  key={dia}
                  className={`dia-cell${ehHoje ? " hoje" : ""}${selecionado ? " selecionado" : ""}`}
                  onClick={() => setDiaSelecionado(dataStr)}
                  style={{
                    minHeight: 72,
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,.06)",
                    background: selecionado ? "rgba(0,200,150,.08)" : "rgba(255,255,255,.02)",
                    padding: "8px 6px",
                    position: "relative",
                  }}
                >
                  <span style={{
                    fontSize: 13, fontWeight: ehHoje ? 900 : 600,
                    color: ehHoje ? "#00C896" : "rgba(255,255,255,.7)",
                  }}>{dia}</span>

                  {/* Dots de eventos */}
                  <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginTop: 6 }}>
                    {nAgendados > 0 && (
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#FFB800" }} title={`${nAgendados} agendado${nAgendados > 1 ? "s" : ""}`} />
                    )}
                    {(nPostados + nPublicadosAg) > 0 && (
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#00C896" }} title={`${nPostados + nPublicadosAg} publicado${nPostados + nPublicadosAg > 1 ? "s" : ""}`} />
                    )}
                  </div>

                  {/* Contador */}
                  {(nAgendados + nPostados + nPublicadosAg) > 0 && (
                    <div style={{
                      position: "absolute", bottom: 4, right: 6,
                      fontSize: 9, fontWeight: 800,
                      color: "rgba(255,255,255,.3)",
                    }}>
                      {nAgendados + nPostados + nPublicadosAg}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legenda */}
          <div style={{ display: "flex", gap: 20, marginTop: 20, padding: "12px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#FFB800" }} />
              <span style={{ fontSize: 11, color: "rgba(255,255,255,.4)" }}>Agendado</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#00C896" }} />
              <span style={{ fontSize: 11, color: "rgba(255,255,255,.4)" }}>Publicado</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 18, height: 18, borderRadius: 4, boxShadow: "inset 0 0 0 2px #00C896", display: "inline-block" }} />
              <span style={{ fontSize: 11, color: "rgba(255,255,255,.4)" }}>Hoje</span>
            </div>
          </div>

          {/* Resumo do mês */}
          <div style={{ marginTop: 8, padding: "16px 20px", background: "rgba(255,255,255,.02)", borderRadius: 12, border: "1px solid rgba(255,255,255,.06)" }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,.4)", marginBottom: 12 }}>RESUMO DO MÊS</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              {[
                { label: "Agendados", value: agendamentos.filter(a => !a.publicado && a.agendado_para.startsWith(`${mesAtual.getFullYear()}-${String(mesAtual.getMonth()+1).padStart(2,"0")}`)).length, color: "#FFB800" },
                { label: "Publicados", value: historico.filter(h => h.posted_at.startsWith(`${mesAtual.getFullYear()}-${String(mesAtual.getMonth()+1).padStart(2,"0")}`)).length, color: "#00C896" },
                { label: "Total", value: agendamentos.filter(a => a.agendado_para.startsWith(`${mesAtual.getFullYear()}-${String(mesAtual.getMonth()+1).padStart(2,"0")}`)).length + historico.filter(h => h.posted_at.startsWith(`${mesAtual.getFullYear()}-${String(mesAtual.getMonth()+1).padStart(2,"0")}`)).length, color: "#A78BFA" },
              ].map(s => (
                <div key={s.label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,.35)", marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* PAINEL LATERAL — eventos do dia */}
        <div style={{
          borderLeft: "1px solid rgba(255,255,255,.06)",
          overflowY: "auto",
          padding: "24px 20px",
          background: "rgba(0,0,0,.2)",
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 16, color: "rgba(255,255,255,.6)" }}>
            {diaSelecionado ? new Date(diaSelecionado + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }) : "Selecione um dia"}
          </h3>

          {loading && <div style={{ color: "rgba(255,255,255,.3)", fontSize: 12 }}>Carregando...</div>}

          {!loading && eventosDia && (eventosDia.agendados.length + eventosDia.postados.length) === 0 && (
            <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(255,255,255,.2)" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
              <div style={{ fontSize: 13 }}>Nenhuma publicação neste dia</div>
            </div>
          )}

          {/* Agendamentos do dia */}
          {eventosDia && eventosDia.agendados.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 10, fontWeight: 800, color: "#FFB800", letterSpacing: 1, marginBottom: 10 }}>
                ⏰ AGENDAMENTOS ({eventosDia.agendados.filter(a => !a.publicado).length} pendentes)
              </p>
              {eventosDia.agendados.map((a, idx) => (
                <div key={a.id} className="evento-item" style={{
                  animationDelay: `${idx * 60}ms`,
                  background: a.publicado ? "rgba(0,200,150,.05)" : "rgba(255,184,0,.05)",
                  border: `1px solid ${a.publicado ? "rgba(0,200,150,.15)" : "rgba(255,184,0,.15)"}`,
                  borderRadius: 12, padding: "12px 14px", marginBottom: 8,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.cargo}</div>
                      <div style={{ fontSize: 11, color: "#00C896", marginTop: 2 }}>{a.orgao}</div>
                      <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: MODO_COLOR[a.modo], background: MODO_COLOR[a.modo] + "15", padding: "2px 8px", borderRadius: 10 }}>
                          {MODO_LABEL[a.modo]}
                        </span>
                        <span style={{ fontSize: 10, color: "rgba(255,255,255,.3)" }}>
                          {new Date(a.agendado_para).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {a.publicado && <span style={{ fontSize: 10, color: "#00C896", fontWeight: 700 }}>✅ Publicado</span>}
                      </div>
                    </div>
                    {!a.publicado && (
                      <div style={{ display: "flex", gap: 4, marginLeft: 8 }}>
                        <button
                          onClick={() => publicarAgora(a)}
                          disabled={publicando === a.id || deletando === a.id}
                          title="Publicar agora"
                          style={{
                            background: "rgba(0,200,150,.1)", border: "1px solid rgba(0,200,150,.2)",
                            color: "#00C896", borderRadius: 6, width: 28, height: 28,
                            cursor: "pointer", fontSize: 13, flexShrink: 0,
                          }}
                        >{publicando === a.id ? "…" : "▶"}</button>
                        <button
                          onClick={() => deletarAgendamento(a.id)}
                          disabled={deletando === a.id || publicando === a.id}
                          title="Cancelar agendamento"
                          style={{
                            background: "rgba(255,75,75,.1)", border: "1px solid rgba(255,75,75,.2)",
                            color: "#FF4B4B", borderRadius: 6, width: 28, height: 28,
                            cursor: "pointer", fontSize: 14, flexShrink: 0,
                          }}
                        >{deletando === a.id ? "…" : "✕"}</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Publicações do dia */}
          {eventosDia && eventosDia.postados.length > 0 && (
            <div>
              <p style={{ fontSize: 10, fontWeight: 800, color: "#00C896", letterSpacing: 1, marginBottom: 10 }}>
                ✅ PUBLICADOS ({eventosDia.postados.length})
              </p>
              {eventosDia.postados.map((h, idx) => (
                <div key={h.id} className="evento-item" style={{
                  animationDelay: `${idx * 60}ms`,
                  background: "rgba(0,200,150,.04)",
                  border: "1px solid rgba(0,200,150,.1)",
                  borderRadius: 12, padding: "12px 14px", marginBottom: 8,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{h.cargo}</div>
                  <div style={{ fontSize: 11, color: "#00C896", marginTop: 2 }}>{h.orgao}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,.3)", marginTop: 4 }}>
                    {new Date(h.posted_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · {h.estado}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}