"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import InstagramCard from "@/components/InstagramCard";
import { gerarLegenda } from "@/lib/legenda";
import type { Concurso } from "@/lib/scraper";
import { UF_NOMES } from "@/lib/scraper";
import type { PostHistorico } from "@/app/api/historico/route";

// Hook utilitário: retarda a atualização de um valor até o usuário parar de digitar
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

type FilterStatus = "todos" | "Inscricoes Abertas" | "Aguardando Prova";
type TabType = "lista" | "cards" | "historico" | "favoritos" | "stats" | "calendario";
type CardFormato = "feed" | "stories";
type SortBy = "padrao" | "salario" | "vagas" | "prazo";

interface Favorito {
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

interface StatsData {
  totalGeral: number;
  totalSemana: number;
  totalMes: number;
  semanasData: { semana: string; label: string; total: number }[];
  topEstados:  { estado: string; total: number }[];
  topCargos:   { cargo: string;  total: number }[];
}

const STATUS_DOT: Record<string, string> = {
  "Inscricoes Abertas": "#00C896",
  "Aguardando Prova":   "#A78BFA",
  "Previsto":           "#FFB800",
  "Encerrado":          "#FF4B4B",
};

const STATUS_BG: Record<string, string> = {
  "Inscricoes Abertas": "rgba(0,200,150,.08)",
  "Aguardando Prova":   "rgba(167,139,250,.08)",
  "Previsto":           "rgba(255,184,0,.08)",
  "Encerrado":          "rgba(255,75,75,.08)",
};

const NIVEIS = ["Todos", "Superior", "Médio/Técnico", "Médio/Técnico/Superior"];

const UFS = ["Todos","AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO","Nacional"];

// Exibe cargo — com explosão de multi-cargo, cada card tem 1 cargo.
// Mantido para compatibilidade com dados legados que possam ter cargos combinados.
function cargoDisplay(cargo: string): string {
  if (cargo.length <= 50) return cargo;
  const partes = cargo.split(",").map(p => p.trim()).filter(Boolean);
  if (partes.length > 1) return `${partes[0]} +${partes.length - 1}`;
  return cargo.slice(0, 48) + "…";
}

function nivelDisplay(cargo: string, nivel: string): string {
  const c = cargo.toLowerCase();
  const ehSuperior = ["contador", "contadora", "auditor", "analista contábil",
    "analista contabil", "fiscal de tribut", "fiscal de rendas"].some(kw => c.includes(kw));
  if (ehSuperior && nivel.includes("Superior")) return "Superior";
  if ((c.includes("técnico em contabilidade") || c.includes("tecnico em contabilidade")) && nivel === "Médio/Técnico/Superior") return "Médio/Técnico";
  return nivel;
}

function parseSalario(s: string): number {
  return parseFloat(s.replace("R$", "").replace(/\./g, "").replace(",", ".").trim()) || 0;
}

function parseVagas(v: string): number {
  const m = v.match(/(\d+)/);
  return m ? parseInt(m[1]) : 0;
}

function BadgeUrgente({ dias }: { dias: number }) {
  if (dias < 0 || dias > 7) return null;
  return (
    <span style={{
      background: "linear-gradient(135deg,#FF4B4B,#FF2222)",
      color: "#fff", fontSize: 10, fontWeight: 800,
      padding: "2px 9px", borderRadius: 20, whiteSpace: "nowrap",
      boxShadow: "0 2px 8px rgba(255,75,75,.4)",
      animation: "pulse 1.5s ease-in-out infinite",
    }}>
      {dias === 0 ? "⚡ Encerra hoje!" : `⚡ ${dias}d restantes`}
    </span>
  );
}

function StatusTag({ status }: { status: string }) {
  const color = STATUS_DOT[status] ?? "#888";
  const label = status === "Inscricoes Abertas" ? "Inscrições Abertas" : status;
  return (
    <span style={{
      background: STATUS_BG[status] ?? "rgba(255,255,255,.07)",
      color, padding: "3px 9px", borderRadius: 7,
      fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
      border: `1px solid ${color}22`,
    }}>
      {label}
    </span>
  );
}

function Tag({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{
      background: color + "15", color,
      padding: "3px 9px", borderRadius: 7,
      fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
      border: `1px solid ${color}25`,
    }}>
      {children}
    </span>
  );
}

function Btn({ color, onClick, disabled, children }: {
  color: string; onClick: (e: React.MouseEvent) => void; disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: color + "15", border: "1px solid " + color + "30",
      color, borderRadius: 9, padding: "7px 13px",
      cursor: disabled ? "not-allowed" : "pointer",
      fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
      opacity: disabled ? 0.5 : 1,
      transition: "all .15s",
    }}>
      {children}
    </button>
  );
}

function StatCard({ label, value, color, sub }: { label: string; value: number; color: string; sub?: string }) {
  return (
    <div style={{
      padding: "16px 22px", borderRight: "1px solid rgba(255,255,255,.06)",
      flexShrink: 0, position: "relative", overflow: "hidden",
    }}>
      {/* Fundo com glow sutil */}
      <div style={{
        position: "absolute", bottom: -20, right: -20,
        width: 80, height: 80,
        background: `radial-gradient(circle, ${color}20 0%, transparent 70%)`,
        pointerEvents: "none",
      }} />
      <div style={{ color: "rgba(255,255,255,.3)", fontSize: 9, letterSpacing: 1.2, marginBottom: 4, textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ color, fontSize: 26, fontWeight: 900, lineHeight: 1, letterSpacing: "-1px" }}>{value}</div>
      {sub && <div style={{ color: "rgba(255,255,255,.2)", fontSize: 9, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function ConfirmModal({ mensagem, onConfirm, onCancel }: { mensagem: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
      <div style={{
        background: "#0C1E3E", border: "1px solid rgba(255,75,75,.25)",
        borderRadius: 16, padding: "28px 32px", maxWidth: 400, width: "90%",
        display: "flex", flexDirection: "column", gap: 20,
        boxShadow: "0 20px 60px rgba(0,0,0,.6)",
      }}>
        <div style={{ color: "#fff", fontSize: 14, lineHeight: 1.6 }}>{mensagem}</div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", color: "rgba(255,255,255,.6)", borderRadius: 9, padding: "8px 18px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
            Cancelar
          </button>
          <button onClick={onConfirm} style={{ background: "rgba(255,75,75,.15)", border: "1px solid rgba(255,75,75,.3)", color: "#FF4B4B", borderRadius: 9, padding: "8px 18px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Componente isolado para botão Publicar com dropdown ─────────────────────
function CardPublicarBtn({
  concurso,
  downloadingId,
  onPublicar,
  onAgendar,
}: {
  concurso: Concurso;
  downloadingId: string | null;
  onPublicar: (modo: "feed" | "stories" | "ambos") => void;
  onAgendar:  (modo: "feed" | "stories" | "ambos") => void;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAberto(false);
      }
    };
    // Pequeno delay para não fechar imediatamente ao abrir
    const t = setTimeout(() => document.addEventListener("mousedown", handler), 10);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", handler); };
  }, [aberto]);

  const loading = !!downloadingId?.startsWith(concurso.id + "ig");

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => !downloadingId && setAberto(a => !a)}
        style={{
          background: loading ? "rgba(225,48,108,.15)" : "linear-gradient(135deg,#E1306C,#833AB4)",
          color: loading ? "#E1306C" : "#fff",
          border: "none", borderRadius: 9, padding: "9px 18px",
          cursor: downloadingId ? "not-allowed" : "pointer",
          fontSize: 12, fontWeight: 800,
          display: "flex", alignItems: "center", gap: 6,
          opacity: downloadingId && !loading ? .5 : 1,
          transition: "opacity .15s",
        }}
      >
        {loading ? "Publicando..." : "📤 Publicar"}
        <span style={{ fontSize: 8, opacity: .7 }}>{aberto ? "▲" : "▼"}</span>
      </button>

      {aberto && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 6px)", left: "50%",
          transform: "translateX(-50%)", zIndex: 9999,
          background: "#0D1B35",
          border: "1px solid rgba(255,255,255,.15)",
          borderRadius: 12, padding: "6px 0",
          minWidth: 210,
          boxShadow: "0 -12px 40px rgba(0,0,0,.7)",
        }}>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,.3)", fontWeight: 800, padding: "4px 14px 6px", letterSpacing: 1 }}>
            PUBLICAR AGORA
          </div>
          {([
            { modo: "feed"    as const, label: "📷 Feed",           desc: "1080×1350px" },
            { modo: "stories" as const, label: "📱 Stories",        desc: "1080×1920px" },
            { modo: "ambos"   as const, label: "📲 Feed + Stories", desc: "os dois" },
          ]).map(({ modo, label, desc }) => (
            <button key={modo}
              onClick={() => { setAberto(false); onPublicar(modo); }}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                width: "100%", background: "none", border: "none",
                color: "#fff", padding: "8px 14px",
                cursor: "pointer", fontSize: 12, fontWeight: 700,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(225,48,108,.12)")}
              onMouseLeave={e => (e.currentTarget.style.background = "none")}
            >
              <span>{label}</span>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,.3)", fontWeight: 400 }}>{desc}</span>
            </button>
          ))}

          <div style={{ height: 1, background: "rgba(255,255,255,.08)", margin: "4px 0" }} />

          <div style={{ fontSize: 9, color: "rgba(255,184,0,.6)", fontWeight: 800, padding: "6px 14px 4px", letterSpacing: 1 }}>
            ⏰ AGENDAR
          </div>
          {([
            { modo: "feed"    as const, label: "📷 Feed" },
            { modo: "stories" as const, label: "📱 Stories" },
            { modo: "ambos"   as const, label: "📲 Feed + Stories" },
          ]).map(({ modo, label }) => (
            <button key={"ag-" + modo}
              onClick={() => { setAberto(false); onAgendar(modo); }}
              style={{
                display: "block", width: "100%", background: "none", border: "none",
                color: "#FFB800", padding: "7px 14px",
                cursor: "pointer", fontSize: 11, fontWeight: 600, textAlign: "left",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,184,0,.08)")}
              onMouseLeave={e => (e.currentTarget.style.background = "none")}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function HomeContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [concursos, setConcursos]       = useState<Concurso[]>([]);
  const [historico, setHistorico]       = useState<PostHistorico[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [loteProgresso, setLoteProgresso] = useState<{ atual: number; total: number } | null>(null);
  const [filter, setFilter]             = useState<FilterStatus>(
    (searchParams.get("status") as FilterStatus) ?? "todos"
  );
  const [estadoFiltro, setEstadoFiltro] = useState(searchParams.get("estado") ?? "Todos");
  const [nivelFiltro, setNivelFiltro]   = useState(searchParams.get("nivel")  ?? "Todos");
  const [sortBy, setSortBy]             = useState<SortBy>(
    (searchParams.get("sort") as SortBy) ?? "padrao"
  );
  const [salarioMin, setSalarioMin]     = useState(Number(searchParams.get("salario") ?? 0));
  const [favoritos, setFavoritos]       = useState<Favorito[]>([]);
  const [stats, setStats]               = useState<StatsData | null>(null);
  const [favoritando, setFavoritando]   = useState<string | null>(null);
  const [busca, setBusca]               = useState(searchParams.get("q") ?? "");
  const buscaDebounced                  = useDebounce(busca, 250);
  const [tab, setTab]                   = useState<TabType>(
    (searchParams.get("tab") as TabType) ?? "lista"
  );
  const [expanded, setExpanded]         = useState<string | null>(null);
  const [copied, setCopied]             = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [cardFormato, setCardFormato]   = useState<CardFormato>("feed");
  const [atualizadoEm, setAtualizadoEm] = useState("");
  const [fromCache, setFromCache]       = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ mensagem: string; onConfirm: () => void; onCancel: () => void } | null>(null);
  const [clearing, setClearing]         = useState(false);
  const [debugging, setDebugging]       = useState(false);
  const [erro, setErro]                 = useState<string | null>(null);
  const [toast, setToast]               = useState<{ msg: string; tipo: "ok" | "erro" | "info" } | null>(null);
  const [agendarModal, setAgendarModal] = useState<{ concurso: Concurso; modo: "feed" | "stories" | "ambos" } | null>(null);
  const [agendadoPara, setAgendadoPara] = useState<string>("");
  const [dropdownAberto, setDropdownAberto] = useState<string | null>(null);
  const [agendamentos, setAgendamentos] = useState<{ concurso_id: string; agendado_para: string; publicado: boolean }[]>([]);

  // Sincroniza filtros na URL sempre que mudam
  useEffect(() => {
    const params = new URLSearchParams();
    if (tab !== "lista")       params.set("tab",     tab);
    if (filter !== "todos")    params.set("status",  filter);
    if (estadoFiltro !== "Todos") params.set("estado", estadoFiltro);
    if (nivelFiltro !== "Todos")  params.set("nivel",  nivelFiltro);
    if (sortBy !== "padrao")   params.set("sort",    sortBy);
    if (salarioMin > 0)        params.set("salario", String(salarioMin));
    if (buscaDebounced.trim()) params.set("q",       buscaDebounced.trim());
    const query = params.toString();
    router.replace(query ? "?" + query : "/", { scroll: false });
  }, [tab, filter, estadoFiltro, nivelFiltro, sortBy, salarioMin, buscaDebounced, router]);

  const confirmar = (mensagem: string): Promise<boolean> =>
    new Promise(resolve => {
      setConfirmModal({
        mensagem,
        onConfirm:  () => { setConfirmModal(null); resolve(true); },
        onCancel:   () => { setConfirmModal(null); resolve(false); },
      });
    });

  const runDebug = async () => {
    setDebugging(true);
    console.clear();
    console.group("DEBUG - Concursos Contabeis");
    try {
      const urls = ["/vagas/contador", "/vagas/contabilidade", "/vagas/tecnico-em-contabilidade", "/vagas/auditor-fiscal"];
      for (const u of urls) {
        const res  = await fetch("/api/debug?url=" + encodeURIComponent(u));
        const data = await res.json();
        console.group("URL: " + u);
        console.log("Fetch OK:", data.fetch?.ok, "| Status:", data.fetch?.status);
        console.log("Links encontrados:", data.links_total, "| Validos:", data.links_validos);
        const blocos = (data.debug_primeiros_3_concursos ?? []) as Record<string, unknown>[];
        blocos.forEach((b, i) => {
          console.group("Concurso #" + (i + 1) + ": " + b.orgao);
          console.log("title:", b.title);
          console.log("UF:", b.uf_extraido);
          console.log("Cargo do title:", b.cargo_do_title);
          console.log("Vagas:", b.vagas_match);
          console.log("Data periodo:", b.data_periodo, "| Data unica:", b.data_unica);
          console.log("Bloco:", b.bloco_linhas);
          console.groupEnd();
        });
        console.groupEnd();
      }
    } catch (e: unknown) {
      console.error("Erro no debug:", e);
    } finally {
      console.groupEnd();
      setDebugging(false);
    }
  };

  const clearCache = async () => {
    if (!await confirmar("Limpar o cache e buscar dados frescos agora?")) return;
    setClearing(true);
    try {
      const res  = await fetch("/api/concursos", { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        // Dispara o re-scraping automaticamente após limpar
        await fetchConcursos(true);
      } else {
        alert("Erro ao limpar cache: " + data.error);
      }
    } finally {
      setClearing(false);
    }
  };

  const fetchConcursos = useCallback(async (forceRefresh = false) => {
    forceRefresh ? setRefreshing(true) : setLoading(true);
    setErro(null);

    try {
      // Sem forceRefresh: tenta cache normal primeiro
      if (!forceRefresh) {
        const res  = await fetch("/api/concursos");
        const data = await res.json();
        if (data.ok) {
          const c = data.concursos as Concurso[];
          setConcursos(c);
          setFromCache(data.fromCache ?? false);
          setAtualizadoEm(new Date(data.atualizadoEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }));
          console.group("Concursos Contábeis [CACHE]");
          console.log("Total:", c.length);
          console.groupEnd();
          return;
        }
      }

      // Bug 2 fix: busca lote 0 primeiro para descobrir totalLotes real da API
      // Evita hardcoded que desincroniza quando VAGAS_URLS / CONCURSOS_URLS mudam
      let TOTAL_LOTES = 22; // fallback seguro
      try {
        const res0  = await fetch("/api/scrape-lote?lote=0");
        const data0 = await res0.json();
        if (data0?.totalLotes) TOTAL_LOTES = data0.totalLotes;
        setLoteProgresso({ atual: 1, total: TOTAL_LOTES });
        if (data0.ok && data0.totalAcumulado > 0) {
          const res2  = await fetch("/api/concursos");
          const data2 = await res2.json();
          if (data2.ok) {
            setConcursos(data2.concursos as Concurso[]);
            setFromCache(false);
            setAtualizadoEm(new Date(data2.atualizadoEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }));
            console.log(`[Lote 1/${TOTAL_LOTES}] ${data0.novosNesteLote} novos | Total: ${data2.concursos.length}`);
          }
        }
        if (data0.fim) return;
      } catch (e: unknown) {
        console.warn("[Lote 1] Falhou, continuando...", e);
      }

      for (let lote = 1; lote < TOTAL_LOTES; lote++) {
        const isFim  = lote === TOTAL_LOTES - 1;
        const params = new URLSearchParams({ lote: String(lote), ...(isFim ? { fim: "1" } : {}) });

        try {
          const res  = await fetch(`/api/scrape-lote?${params}`);
          const data = await res.json();
          setLoteProgresso({ atual: lote + 1, total: TOTAL_LOTES });

          if (!data.ok) continue;

          // Após cada lote, atualiza a lista com os dados acumulados
          if (data.totalAcumulado > 0) {
            const res2  = await fetch("/api/concursos");
            const data2 = await res2.json();
            if (data2.ok) {
              const c = data2.concursos as Concurso[];
              setConcursos(c);
              setFromCache(false);
              setAtualizadoEm(new Date(data2.atualizadoEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }));
              console.log(`[Lote ${lote + 1}/${TOTAL_LOTES}] ${data.novosNesteLote} novos | Total: ${c.length}`);
            }
          }

          if (data.fim) break;
        } catch (e: unknown) {
          console.warn(`[Lote ${lote + 1}] Falhou, continuando...`, e);
          setLoteProgresso({ atual: lote + 1, total: TOTAL_LOTES });
          continue;
        }
      }

    } catch (e: unknown) {
      console.error("Erro ao carregar concursos:", e);
      setErro("Falha na conexão com o servidor. Verifique sua internet e tente novamente.");
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoteProgresso(null);
    }
  }, []);

  const fetchHistorico = useCallback(async () => {
    try {
      const r = await fetch("/api/historico");
      const d = await r.json();
      if (d.ok) setHistorico(d.historico);
    } catch {}
  }, []);

  const fetchFavoritos = useCallback(async () => {
    try {
      const r = await fetch("/api/favoritos");
      const d = await r.json();
      if (d.ok) setFavoritos(d.favoritos);
    } catch {}
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const r = await fetch("/api/stats");
      const d = await r.json();
      if (d.ok) setStats(d.stats);
    } catch {}
  }, []);

  const fetchAgendamentos = useCallback(async () => {
    try {
      const r = await fetch("/api/agendamentos");
      const d = await r.json();
      if (d.ok) setAgendamentos(d.agendamentos ?? []);
    } catch {}
  }, []);

  const toggleFavorito = async (c: import("@/lib/scraper").Concurso) => {
    setFavoritando(c.id);
    const ehFav = favoritos.some(f => f.concurso_id === c.id);
    if (ehFav) {
      await fetch("/api/favoritos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ concurso_id: c.id }),
      });
    } else {
      await fetch("/api/favoritos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ concurso_id: c.id, cargo: c.cargo, orgao: c.orgao, estado: c.estado, cidade: c.cidade || "", uf: c.uf || c.estado }),
      });
    }
    await fetchFavoritos();
    setFavoritando(null);
  };

  useEffect(() => {
    fetchConcursos();
    fetchHistorico();
    fetchFavoritos();
    fetchStats();
    fetchAgendamentos();
  }, [fetchConcursos, fetchHistorico, fetchFavoritos, fetchStats, fetchAgendamentos]);

  // Filtragem + ordenação
  const filtered = (() => {
    const hojeMs = new Date().setHours(0, 0, 0, 0);
    let list = concursos.filter(c => {
      // Última linha de defesa: oculta concursos com prova já realizada
      if (c.dataProva && c.dataProva !== "-") {
        const p = c.dataProva.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (p) {
          const dtP = new Date(parseInt(p[3]), parseInt(p[2]) - 1, parseInt(p[1])).setHours(0,0,0,0);
          if (dtP < hojeMs) return false;
        }
      }
      if (filter !== "todos" && c.status !== filter) return false;
      if (estadoFiltro !== "Todos" && c.estado !== estadoFiltro) return false;
      if (nivelFiltro !== "Todos") {
        // Usa nivelDisplay para normalizar o nível antes de filtrar
        const nivelNorm = nivelDisplay(c.cargo, c.nivel);
        if (nivelFiltro === "Superior") {
          if (!nivelNorm.includes("Superior")) return false;
        } else {
          if (nivelNorm !== nivelFiltro) return false;
        }
      }
      if (buscaDebounced.trim()) {
        const q = buscaDebounced.toLowerCase();
        if (!c.cargo.toLowerCase().includes(q) && !c.orgao.toLowerCase().includes(q) && !c.estado.toLowerCase().includes(q) && !(c.cidade || "").toLowerCase().includes(q) && !(c.uf || "").toLowerCase().includes(q)) return false;
      }
      return true;
    });

    if (salarioMin > 0)        list = list.filter(c => parseSalario(c.salario) >= salarioMin);
    if (sortBy === "salario")  list = [...list].sort((a, b) => parseSalario(b.salario) - parseSalario(a.salario));
    if (sortBy === "vagas")    list = [...list].sort((a, b) => parseVagas(b.vagas) - parseVagas(a.vagas));
    if (sortBy === "prazo")    list = [...list].sort((a, b) => {
      if (a.diasRestantes < 0 && b.diasRestantes >= 0) return 1;
      if (b.diasRestantes < 0 && a.diasRestantes >= 0) return -1;
      return a.diasRestantes - b.diasRestantes;
    });

    // Na aba cards: não publicados → agendados (opacidade 60%) → publicados (opacidade 45%)
    if (tab === "cards") {
      list = [...list].sort((a, b) => {
        const peso = (c: typeof a) =>
          historico.some(h => h.concurso_id === c.id) ? 2
          : agendamentos.some(ag => ag.concurso_id === c.id && !ag.publicado) ? 1
          : 0;
        return peso(a) - peso(b);
      });
    }

    return list;
  })();

  const contagens = {
    total:    concursos.length,
    abertas:  concursos.filter(c => c.status === "Inscricoes Abertas").length,
    urgentes: concursos.filter(c => c.diasRestantes >= 0 && c.diasRestantes <= 7).length,
    comProva: concursos.filter(c => c.dataProva && c.dataProva !== "-").length,
  };

  const copyLegenda = (c: Concurso) => {
    navigator.clipboard.writeText(gerarLegenda(c));
    setCopied(c.id);
    setTimeout(() => setCopied(null), 2500);
  };

  const marcarPostado = async (c: Concurso) => {
    await fetch("/api/historico", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: c.id, cargo: c.cargo, orgao: c.orgao, estado: c.estado }),
    });
    fetchHistorico();
  };

  const removerHistorico = async (id: string) => {
    await fetch("/api/historico", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    fetchHistorico();
  };

  const downloadCard = async (c: Concurso, fmt: CardFormato) => {
    setDownloadingId(c.id + fmt);
    try {
      const h2c = (await import("html2canvas")).default;
      const el  = document.getElementById("card-" + c.id + "-" + fmt);
      if (!el) return;
      await document.fonts.ready;
      // Feed 4:5: scale 2.25 → 480×600px × 2.25 = 1080×1350px real
      // Stories:  scale 4   → 270×480px × 4    = 1080×1920px real
      const scale = fmt === "feed" ? 2.25 : 4;
      const canvas = await h2c(el, { scale, backgroundColor: null, useCORS: true });
      const a = document.createElement("a");
      a.download = c.id + "-" + fmt + ".png";
      a.href = canvas.toDataURL("image/png");
      a.click();
    } finally {
      setDownloadingId(null);
    }
  };

  const jaPostado = (id: string) => historico.some(h => h.concurso_id === id);

  const dataPostagem = (id: string) => {
    const h = historico.find(h => h.concurso_id === id);
    if (!h) return null;
    return new Date(h.posted_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  };

  // Agendamentos pendentes (não publicados ainda)
  const jaAgendado = (id: string) => agendamentos.some(a => a.concurso_id === id && !a.publicado);
  const dataAgendamento = (id: string) => {
    const a = agendamentos.find(a => a.concurso_id === id && !a.publicado);
    if (!a) return null;
    return new Date(a.agendado_para).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  // Toast helper
  // Fecha dropdown ao clicar fora (mousedown antes do click, evita race condition)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Só fecha se o clique foi fora de qualquer elemento com data-dropdown
      if (!target.closest("[data-dropdown]")) {
        setDropdownAberto(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const showToast = (msg: string, tipo: "ok" | "erro" | "info" = "ok") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 5000);
  };

  // Envia só o feed para a extensão publicar no Instagram
  // Stories não funciona via web — disponível apenas para download manual
  const publicarInstagram = async (c: Concurso, modo: "feed" | "stories" | "ambos" = "ambos", agendarEm?: string) => {
    setDownloadingId(c.id + "ig" + modo);
    try {
      // ── AGENDAMENTO: gera os cards aqui no navegador e salva base64 no banco ──
      // O cron usa as imagens salvas — sem precisar de screenshot externo
      if (agendarEm) {
        await document.fonts.ready;
        const { renderCardCanvas } = await import("@/lib/card-renderer");

        const feedBase64    = (modo === "feed"    || modo === "ambos") ? (await renderCardCanvas(c, "feed")).toDataURL("image/png")    : null;
        const storiesBase64 = (modo === "stories" || modo === "ambos") ? (await renderCardCanvas(c, "stories")).toDataURL("image/png") : null;
        const legenda = gerarLegenda(c);

        const res = await fetch("/api/agendamentos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            concurso_id:    c.id,
            cargo:          c.cargo,
            orgao:          c.orgao,
            estado:         c.estado,
            modo,
            agendado_para:  new Date(agendarEm).toISOString(),
            feed_base64:    feedBase64,
            stories_base64: storiesBase64,
            legenda,
          }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "Erro ao salvar agendamento");
        const partes = modo === "feed" ? "Feed" : modo === "stories" ? "Stories" : "Feed + Stories";
        showToast(`⏰ ${partes} agendado para ${new Date(agendarEm).toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" })}!`, "ok");
        fetchAgendamentos();
        return;
      }

      // ── PUBLICAÇÃO IMEDIATA: chama a extensão ────────────────────────────
      await document.fonts.ready;
      const { renderCardCanvas } = await import("@/lib/card-renderer");

      const feedBase64    = (modo === "feed"    || modo === "ambos") ? (await renderCardCanvas(c, "feed")).toDataURL("image/png")    : null;
      const storiesBase64 = (modo === "stories" || modo === "ambos") ? (await renderCardCanvas(c, "stories")).toDataURL("image/png") : null;
      const legenda = gerarLegenda(c);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chrome = (window as any).chrome;
      if (!chrome?.runtime?.sendMessage) {
        throw new Error("Extensão não encontrada. Instale a extensão Concursos Contábeis no Chrome.");
      }

      const EXT_ID = "phmnhackebfpjcjpdopobdalmaolbglk";

      await new Promise<void>((resolve, reject) => {
        chrome.runtime.sendMessage(
          EXT_ID,
          { type: "PUBLICAR_INSTAGRAM", feedBase64, storiesBase64, legenda, agendadoPara: null },
          (r: { ok: boolean } | undefined) => {
            if (chrome.runtime.lastError || !r?.ok) {
              reject(new Error(chrome.runtime.lastError?.message || "Extensão não respondeu. Verifique se está instalada e ativa."));
            } else { resolve(); }
          }
        );
      });

      const partes = [feedBase64 && "Feed", storiesBase64 && "Stories"].filter(Boolean).join(" + ");
      showToast(`✅ ${partes} publicado com sucesso!`, "ok");
      await marcarPostado(c);

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      showToast("❌ " + msg, "erro");
    } finally {
      setDownloadingId(null);
      setAgendarModal(null);
      setAgendadoPara("");
    }
  };

  // ── Toast de notificação ──────────────────────────────────────────────────
  const ToastUI = toast && (
    <div className="toast-ui" style={{
      position: "fixed", bottom: 32, right: 32, zIndex: 9999,
      background: toast.tipo === "ok" ? "rgba(0,200,150,0.95)" : toast.tipo === "erro" ? "rgba(255,75,75,0.95)" : "rgba(99,102,241,0.95)",
      color: "#fff", padding: "14px 24px", borderRadius: 12,
      fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 14,
      boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
      display: "flex", alignItems: "center", gap: 10,
      animation: "slideIn .3s ease",
      maxWidth: 400,
    }}>
      <style>{`@keyframes slideIn{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
      {toast.msg}
      <button onClick={() => setToast(null)} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 18, lineHeight: 1, marginLeft: 8 }}>×</button>
    </div>
  );

  // ── Modal de Agendamento ───────────────────────────────────────────────────
  const AgendarModalUI = agendarModal && (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "#0D1B35", border: "1px solid rgba(0,200,150,0.2)", borderRadius: 20,
        padding: 32, width: 400, fontFamily: "'Sora',sans-serif",
      }} className="agendar-modal">
        <h3 style={{ color: "#00C896", margin: "0 0 8px", fontSize: 18 }}>⏰ Agendar publicação</h3>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, margin: "0 0 20px" }}>
          {agendarModal.modo === "feed" ? "📷 Feed" : agendarModal.modo === "stories" ? "📱 Stories" : "📲 Feed + Stories"} · {agendarModal.concurso.cargo}
        </p>
        <label style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, display: "block", marginBottom: 8 }}>DATA E HORA</label>
        <input
          type="datetime-local"
          value={agendadoPara}
          onChange={e => setAgendadoPara(e.target.value)}
          min={new Date().toISOString().slice(0, 16)}
          style={{
            width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 14,
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
            color: "#fff", fontFamily: "'Sora',sans-serif", boxSizing: "border-box",
          }}
        />
        <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
          <button
            onClick={() => { setAgendarModal(null); setAgendadoPara(""); }}
            style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontFamily: "'Sora',sans-serif" }}
          >Cancelar</button>
          <button
            disabled={!agendadoPara}
            onClick={() => publicarInstagram(agendarModal.concurso, agendarModal.modo, agendadoPara)}
            style={{
              flex: 2, padding: "10px 0", borderRadius: 8, border: "none",
              background: agendadoPara ? "linear-gradient(135deg,#00C896,#00A87A)" : "rgba(255,255,255,0.1)",
              color: agendadoPara ? "#002D1F" : "rgba(255,255,255,0.3)",
              fontWeight: 700, cursor: agendadoPara ? "pointer" : "not-allowed",
              fontFamily: "'Sora',sans-serif", fontSize: 14,
            }}
          >⏰ Agendar</button>
        </div>
      </div>
    </div>
  );

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#060E20", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Sora',sans-serif", gap: 16 }}>
      <div style={{ width: 44, height: 44, border: "3px solid rgba(0,200,150,.15)", borderTop: "3px solid #00C896", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
      <div style={{ color: "rgba(255,255,255,.35)", fontSize: 13 }}>Buscando concursos...</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <>
    {ToastUI}
    {AgendarModalUI}
    <div style={{ minHeight: "100vh", background: "#060E20", fontFamily: "'Sora',sans-serif", color: "#fff" }}>
      {confirmModal && <ConfirmModal mensagem={confirmModal.mensagem} onConfirm={confirmModal.onConfirm} onCancel={confirmModal.onCancel} />}

      {/* ── Banner de erro ── */}
      {erro && (
        <div style={{
          background: "rgba(255,75,75,.08)", border: "1px solid rgba(255,75,75,.25)",
          borderRadius: 12, margin: "16px 20px 0",
          padding: "14px 18px", display: "flex", alignItems: "center", gap: 12,
        }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#FF4B4B", fontWeight: 700, fontSize: 13 }}>Erro ao carregar</div>
            <div style={{ color: "rgba(255,255,255,.5)", fontSize: 12, marginTop: 2 }}>{erro}</div>
          </div>
          <button
            onClick={() => fetchConcursos(true)}
            style={{
              background: "rgba(255,75,75,.15)", border: "1px solid rgba(255,75,75,.3)",
              color: "#FF4B4B", borderRadius: 9, padding: "8px 16px",
              cursor: "pointer", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
            }}
          >
            Tentar novamente
          </button>
        </div>
      )}

      <link href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700;800;900&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes spin    { to { transform: rotate(360deg) } }
        @keyframes pulse   { 0%,100% { opacity:1 } 50% { opacity:.7 } }
        @keyframes slideIn { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
        * { box-sizing: border-box }
        html { -webkit-text-size-adjust: 100% }
        ::-webkit-scrollbar { width:5px; height:5px }
        ::-webkit-scrollbar-thumb { background:rgba(0,200,150,.25); border-radius:3px }
        button:hover:not(:disabled) { opacity: .85; }
        input, select { font-size: max(12px,16px) }

        /* ── Mobile breakpoint ───────────────────────────── */
        @media(max-width:640px){

          /* Header */
          .header-row {
            flex-direction: column !important;
            gap: 10px !important;
            align-items: flex-start !important;
            padding: 12px 14px !important;
          }
          .header-row > div:last-child {
            width: 100%;
            justify-content: flex-start !important;
          }
          .header-row button, .header-row a {
            flex: 1;
            justify-content: center;
            text-align: center;
          }

          /* Stats bar — 2 por linha */
          .stats-bar { flex-wrap: wrap !important }
          .stats-bar > div {
            flex: 1 1 45% !important;
            min-width: 120px !important;
            border-right: none !important;
            border-bottom: 1px solid rgba(255,255,255,.06) !important;
          }

          /* Filtros — empilham */
          .filters-row {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 8px !important;
            padding: 10px 14px !important;
          }
          .filters-row input,
          .filters-row select { width: 100% !important; min-width: unset !important; }
          .filters-row > div { width: 100% !important; }
          .filters-row > div select { width: 100% !important; }
          .filters-status-row {
            display: flex !important;
            flex-wrap: wrap !important;
            gap: 6px !important;
          }
          .filters-status-row button { flex: 1 !important; min-width: 100px !important; }
          .formato-row { margin-left: 0 !important; width: 100% !important; }
          .formato-row button { flex: 1 !important; }

          /* Lista de concursos — botões de ação empilham */
          .list-btns {
            width: 100% !important;
            flex-wrap: wrap !important;
            gap: 5px !important;
          }
          .list-btns > *, .list-btns button, .list-btns a {
            flex: 1 !important;
            min-width: 80px !important;
            text-align: center !important;
            justify-content: center !important;
          }

          /* Cards Instagram — centralizados, largura máxima */
          .cards-wrap { justify-content: center !important }
          .cards-wrap > div { width: 100% !important; max-width: 390px !important; }

          /* Main padding */
          main { padding: 14px !important }

          /* Modal de agendamento — largura total no mobile */
          .agendar-modal { width: 92% !important; padding: 20px !important }

          /* Toast — ocupa largura no mobile */
          .toast-ui {
            left: 14px !important;
            right: 14px !important;
            bottom: 14px !important;
            max-width: unset !important;
          }

          /* Stats grid — 1 coluna */
          .stats-grid-3 { grid-template-columns: 1fr !important }
          .stats-grid-2 { grid-template-columns: 1fr !important }
        }
      `}</style>

      {/* ══════════════════════ HEADER ══════════════════════ */}
      <header style={{
        borderBottom: "1px solid rgba(0,200,150,.1)",
        padding: "14px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(0,200,150,.02)",
        position: "sticky", top: 0, zIndex: 50,
        backdropFilter: "blur(16px)",
      }} className="header-row">
        <div>
          <div style={{
            background: "linear-gradient(90deg,#00C896,#00E5A8)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            fontSize: 18, fontWeight: 900, letterSpacing: "-0.5px",
          }}>
            Concursos Contábeis
          </div>
          <div style={{ color: "rgba(255,255,255,.25)", fontSize: 10, marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
            pciconcursos.com.br · @concursos.contabeis
            {atualizadoEm && (
              <>
                <span style={{ opacity: .4 }}>·</span>
                <span style={{
                  background: fromCache ? "rgba(255,184,0,.1)" : "rgba(0,200,150,.1)",
                  color: fromCache ? "#FFB800" : "#00C896",
                  padding: "1px 6px", borderRadius: 4, fontSize: 9, fontWeight: 700,
                }}>
                  {fromCache ? "CACHE" : "AO VIVO"}
                </span>
                <span>{atualizadoEm}</span>
              </>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button onClick={clearCache} disabled={clearing} style={{
                background: "rgba(255,75,75,.1)", border: "1px solid rgba(255,75,75,.2)",
                color: "#FF4B4B", borderRadius: 10, padding: "8px 13px",
                fontSize: 11, fontWeight: 700, cursor: clearing ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", gap: 5, opacity: clearing ? .6 : 1,
              }}>
                <span style={{ display: "inline-block", animation: clearing ? "spin .8s linear infinite" : "none" }}>🗑</span>
                {clearing ? "Limpando..." : "Limpar cache"}
              </button>
          <button onClick={() => fetchConcursos(true)} disabled={refreshing} style={{
            background: refreshing ? "rgba(0,200,150,.15)" : "linear-gradient(135deg,#00C896,#00A87A)",
            color: refreshing ? "#00C896" : "#002D1F",
            border: "none", borderRadius: 10, padding: "8px 18px",
            fontSize: 11, fontWeight: 700,
            cursor: refreshing ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", gap: 5,
          }}>
            <span style={{ display: "inline-block", animation: refreshing ? "spin .8s linear infinite" : "none" }}>↻</span>
            {refreshing
              ? loteProgresso
                ? `Lote ${loteProgresso.atual}/${loteProgresso.total}...`
                : "Buscando..."
              : "Atualizar"}
          </button>
        </div>
      </header>

      {/* ══════════════════════ STATS BAR ══════════════════════ */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,.05)", overflowX: "auto" }} className="stats-bar">
        <StatCard label="Total"             value={contagens.total}    color="#fff"     />
        <StatCard label="Inscrições Abertas" value={contagens.abertas}  color="#00C896"  sub={`${contagens.urgentes} urgentes`} />
        <StatCard label="Aguardando Prova"   value={concursos.filter(c => c.status === "Aguardando Prova").length} color="#A78BFA" />
        <StatCard label="Com Data de Prova"  value={contagens.comProva}  color="#A78BFA" />
        {contagens.urgentes > 0 && (
          <StatCard label="⚡ Urgentes (≤7d)" value={contagens.urgentes}  color="#FF4B4B" sub="encerram em breve" />
        )}
      </div>

      {/* ══════════════════════ TABS ══════════════════════ */}
      <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,.05)", padding: "0 20px", overflowX: "auto", gap: 4 }}>
        {(["lista", "cards", "favoritos", "stats", "calendario", "historico"] as TabType[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: "none", border: "none",
            borderBottom: tab === t ? "2px solid #00C896" : "2px solid transparent",
            color: tab === t ? "#00C896" : "rgba(255,255,255,.3)",
            padding: "13px 18px", cursor: "pointer",
            fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
            transition: "color .15s",
          }}>
            {t === "lista" ? "Lista"
              : t === "cards" ? "Cards Instagram"
              : t === "favoritos" ? `⭐ Favoritos (${favoritos.length})`
              : t === "stats" ? "📈 Estatísticas"
              : t === "calendario" ? "🗓️ Calendário"
              : `Histórico (${historico.length})`}
          </button>
        ))}
        {/* Botão Calendário de Publicações */}
        <a
          href="/calendario"
          target="_blank"
          rel="noreferrer"
          style={{
            marginLeft: "auto", flexShrink: 0,
            display: "flex", alignItems: "center", gap: 5,
            padding: "5px 12px",
            background: "rgba(0,200,150,.08)",
            border: "1px solid rgba(0,200,150,.2)",
            borderRadius: 8,
            color: "#00C896",
            fontSize: 11, fontWeight: 700,
            textDecoration: "none", whiteSpace: "nowrap",
          }}
        >📅 Publicações</a>
      </div>

      {/* ══════════════════════ FILTROS ══════════════════════ */}
      {tab !== "historico" && tab !== "stats" && tab !== "calendario" && tab !== "favoritos" && (
        <div style={{
          padding: "10px 20px",
          display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center",
          borderBottom: "1px solid rgba(255,255,255,.04)",
          background: "rgba(255,255,255,.01)",
        }} className="filters-row">
          {/* Busca */}
          <input value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="🔎  Buscar cargo, órgão ou estado..."
            style={{
              background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)",
              color: "#fff", borderRadius: 9, padding: "7px 12px", fontSize: 12,
              outline: "none", minWidth: 220, flex: 1,
            }}
          />

          {/* Filtro status */}
          <div className="filters-status-row" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {(["todos", "Inscricoes Abertas", "Aguardando Prova"] as FilterStatus[]).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              background: filter === f ? "rgba(0,200,150,.1)" : "transparent",
              border: "1px solid " + (filter === f ? "#00C896" : "rgba(255,255,255,.1)"),
              color: filter === f ? "#00C896" : "rgba(255,255,255,.35)",
              borderRadius: 18, padding: "5px 12px",
              cursor: "pointer", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
              transition: "all .15s",
            }}>
              {f === "todos" ? "Todos" : f === "Inscricoes Abertas" ? "Inscrições Abertas" : f === "Aguardando Prova" ? "Aguardando Prova" : f}
            </button>
          ))}
          </div>

          {/* Estado */}
          <select value={estadoFiltro} onChange={e => setEstadoFiltro(e.target.value)} style={{
            background: "#0C1E3E", border: "1px solid rgba(255,255,255,.1)",
            color: "rgba(255,255,255,.6)", borderRadius: 9, padding: "6px 10px",
            fontSize: 11, cursor: "pointer",
          }}>
            {UFS.map(uf => <option key={uf} value={uf}>{uf === "Todos" ? "Todos" : uf + (UF_NOMES[uf] ? " — " + UF_NOMES[uf] : "")}</option>)}
          </select>

          {/* Nível */}
          <select value={nivelFiltro} onChange={e => setNivelFiltro(e.target.value)} style={{
            background: "#0C1E3E", border: "1px solid rgba(255,255,255,.1)",
            color: "rgba(255,255,255,.6)", borderRadius: 9, padding: "6px 10px",
            fontSize: 11, cursor: "pointer",
          }}>
            {NIVEIS.map(n => (
              <option key={n} value={n}>
                {n === "Todos" ? "🎓 Nível" : n === "Superior" ? "Superior (inclui misto)" : n}
              </option>
            ))}
          </select>

          {/* Ordenação */}
          <select value={sortBy} onChange={e => setSortBy(e.target.value as SortBy)} style={{
            background: "#0C1E3E", border: "1px solid rgba(255,255,255,.1)",
            color: "rgba(255,255,255,.6)", borderRadius: 9, padding: "6px 10px",
            fontSize: 11, cursor: "pointer",
          }}>
            <option value="padrao">↕ Ordenar</option>
            <option value="prazo">⏰ Menor prazo</option>
            <option value="salario">💰 Maior salário</option>
            <option value="vagas">🎯 Mais vagas</option>
          </select>

          {/* Filtro salário mínimo */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,.3)", whiteSpace: "nowrap" }}>
              💰 mín:
            </span>
            <select value={salarioMin} onChange={e => setSalarioMin(Number(e.target.value))} style={{
              background: "#0C1E3E", border: "1px solid rgba(255,255,255,.1)",
              color: salarioMin > 0 ? "#00C896" : "rgba(255,255,255,.6)",
              borderRadius: 9, padding: "6px 10px", fontSize: 11, cursor: "pointer",
            }}>
              <option value={0}>Qualquer</option>
              <option value={3000}>R$ 3.000+</option>
              <option value={5000}>R$ 5.000+</option>
              <option value={8000}>R$ 8.000+</option>
              <option value={10000}>R$ 10.000+</option>
              <option value={15000}>R$ 15.000+</option>
              <option value={20000}>R$ 20.000+</option>
            </select>
          </div>

          {/* Formato dos cards */}
          {tab === "cards" && (
            <div className="formato-row" style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
              {([
                ["feed",    "Feed 4:5 (1080×1350)"],
                ["stories", "Stories 9:16 (download)"],
              ] as [CardFormato, string][]).map(([f, label]) => (
                <button key={f} onClick={() => setCardFormato(f)} style={{
                  background: cardFormato === f ? "rgba(0,200,150,.12)" : "transparent",
                  border: "1px solid " + (cardFormato === f ? "#00C896" : "rgba(255,255,255,.1)"),
                  color: cardFormato === f ? "#00C896" : "rgba(255,255,255,.35)",
                  borderRadius: 8, padding: "5px 11px", fontSize: 11, fontWeight: 700, cursor: "pointer",
                }}>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════ CONTEÚDO ══════════════════════ */}
      <main style={{ padding: "20px" }}>

        {/* ── LISTA ── */}
        {tab === "lista" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 980 }}>

            {/* Contador de resultados */}
            {filtered.length > 0 && (
              <div style={{ color: "rgba(255,255,255,.2)", fontSize: 11, marginBottom: 4, paddingLeft: 4 }}>
                {filtered.length} concurso{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
                {buscaDebounced && ` para "${buscaDebounced}"`}
              </div>
            )}

            {filtered.length === 0 && (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "rgba(255,255,255,.2)" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Nenhum concurso encontrado</div>
                <div style={{ fontSize: 12, marginTop: 6 }}>Tente outros filtros ou atualize os dados</div>
              </div>
            )}

            {filtered.map(c => {
              const postado = jaPostado(c.id);
              const isOpen  = expanded === c.id;
              const temProva = c.dataProva && c.dataProva !== "-";

              return (
                <div key={c.id} id={"item-" + c.id} style={{
                  background: isOpen ? "rgba(0,200,150,.03)" : "rgba(255,255,255,.02)",
                  border: "1px solid " + (isOpen ? "rgba(0,200,150,.25)" : "rgba(255,255,255,.06)"),
                  borderRadius: 14, overflow: "hidden",
                  transition: "border-color .2s, background .2s",
                }}>
                  {/* Faixa de status lateral */}
                  <div style={{
                    height: 3,
                    background: `linear-gradient(90deg, ${STATUS_DOT[c.status] ?? "#888"}, transparent)`,
                    opacity: .6,
                  }} />

                  <div
                    onClick={() => setExpanded(isOpen ? null : c.id)}
                    style={{
                      padding: "13px 18px",
                      display: "flex", alignItems: "center", gap: 12,
                      cursor: "pointer", flexWrap: "wrap",
                    }}
                  >
                    {/* Dot */}
                    <div style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: STATUS_DOT[c.status] ?? "#888",
                      boxShadow: `0 0 6px ${STATUS_DOT[c.status] ?? "#888"}`,
                      flexShrink: 0,
                    }} />

                    {/* Info principal */}
                    <div style={{ flex: 1, minWidth: 150 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ color: "#fff", fontWeight: 800, fontSize: 14 }} title={c.cargo}>{cargoDisplay(c.cargo)}</span>
                        <BadgeUrgente dias={c.diasRestantes} />
                        {postado && (
                          <span style={{ background: "rgba(0,200,150,.12)", color: "#00C896", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>
                            ✓ Postado {dataPostagem(c.id)}
                          </span>
                        )}
                        {temProva && (
                          <span style={{ background: "rgba(167,139,250,.1)", color: "#A78BFA", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>
                            📝 Prova: {c.dataProva}
                          </span>
                        )}
                      </div>
                      <div style={{ color: "#00C896", fontSize: 12, marginTop: 2, fontWeight: 600 }}>{c.orgao}</div>
                      <div style={{ color: "rgba(255,255,255,.3)", fontSize: 10, marginTop: 1 }} className="list-meta">
                        {c.cidade ? c.cidade + "/" : ""}{c.estado}{c.uf && c.uf !== c.estado ? " · " + c.uf : ""} · {nivelDisplay(c.cargo, c.nivel)}{c.banca !== "-" ? " · " + c.banca : ""}
                      </div>
                      {/* Cargos contábeis inline quando há múltiplos */}
                      {c.cargosContabeis && c.cargosContabeis.length > 1 && (
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 5 }}>
                          {c.cargosContabeis.slice(0, 3).map(cg => (
                            <span key={cg} style={{
                              background: "rgba(0,200,150,.06)", border: "1px solid rgba(0,200,150,.15)",
                              color: "rgba(0,200,150,.8)", fontSize: 9, fontWeight: 700,
                              padding: "1px 6px", borderRadius: 4,
                            }} title={cg}>
                              {cg.length > 20 ? cg.slice(0,18)+"…" : cg}
                            </span>
                          ))}
                          {c.cargosContabeis.length > 3 && (
                            <span style={{
                              background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)",
                              color: "rgba(255,255,255,.4)", fontSize: 9, fontWeight: 700,
                              padding: "1px 6px", borderRadius: 4,
                            }}>+{c.cargosContabeis.length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Tags */}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                      <Tag color="#00C896">{c.salario}</Tag>
                      <Tag color="#A78BFA">{c.vagas}</Tag>
                      <StatusTag status={c.status} />
                    </div>

                    {/* Botões */}
                    <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap" }} className="list-btns">
                      <Btn color="#00C896" onClick={e => { e.stopPropagation(); copyLegenda(c); }}>
                        {copied === c.id ? "✓ Copiado!" : "Legenda"}
                      </Btn>
                      <Btn color="#A78BFA" onClick={e => { e.stopPropagation(); setTab("cards"); setExpanded(c.id); }}>
                        Card
                      </Btn>
                      <Btn color="#FFB800" onClick={e => { e.stopPropagation(); marcarPostado(c); }} disabled={postado}>
                        {postado ? "Postado" : "Marcar postado"}
                      </Btn>
                      <Btn color="#F59E0B" onClick={e => { e.stopPropagation(); toggleFavorito(c); }} disabled={favoritando === c.id}>
                        {favoritos.some(f => f.concurso_id === c.id) ? "⭐" : "☆"}
                      </Btn>
                      {(() => {
                        const isPdf = c.linkEdital.toLowerCase().endsWith(".pdf");
                        return (
                          <a
                            href={c.linkEdital} target="_blank" rel="noreferrer"
                            onClick={e => e.stopPropagation()}
                            title={isPdf ? "Abrir PDF do edital" : "Abrir notícia (PDF não encontrado)"}
                            style={{
                              background: isPdf ? "rgba(0,200,150,.08)" : "rgba(255,255,255,.04)",
                              border: isPdf ? "1px solid rgba(0,200,150,.2)" : "1px solid rgba(255,255,255,.08)",
                              color: isPdf ? "#00C896" : "rgba(255,255,255,.35)",
                              borderRadius: 9, padding: "7px 12px",
                              fontSize: 11, fontWeight: 600,
                              textDecoration: "none", whiteSpace: "nowrap",
                            }}
                          >
                            {isPdf ? "📄 PDF" : "Notícia ↗"}
                          </a>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Painel expandido */}
                  {isOpen && (
                    <div style={{ borderTop: "1px solid rgba(255,255,255,.05)", padding: "14px 18px 18px" }}>

                      {/* Cargos contábeis identificados */}
                      {c.cargosContabeis && c.cargosContabeis.length > 1 && (
                        <div style={{ marginBottom: 14 }}>
                          <div style={{ color: "rgba(255,255,255,.2)", fontSize: 9, letterSpacing: 1.5, marginBottom: 6, textTransform: "uppercase" }}>
                            🏷️ Cargos contábeis neste concurso
                          </div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {c.cargosContabeis.map(cargo => (
                              <span key={cargo} style={{
                                background: "rgba(0,200,150,.08)", border: "1px solid rgba(0,200,150,.2)",
                                color: "#00C896", padding: "4px 10px", borderRadius: 7,
                                fontSize: 11, fontWeight: 700,
                              }}>
                                {cargo}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Datas */}
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                        {c.inscricao !== "-" && (
                          <span style={{ background: "rgba(0,200,150,.08)", border: "1px solid rgba(0,200,150,.15)", color: "#00C896", padding: "4px 10px", borderRadius: 7, fontSize: 11, fontWeight: 700 }}>
                            📅 Inscrições: {c.inscricao}
                          </span>
                        )}
                        {temProva && (
                          <span style={{ background: "rgba(167,139,250,.08)", border: "1px solid rgba(167,139,250,.15)", color: "#A78BFA", padding: "4px 10px", borderRadius: 7, fontSize: 11, fontWeight: 700 }}>
                            📝 Prova: {c.dataProva}
                          </span>
                        )}
                        {c.dataResultado !== "-" && (
                          <span style={{ background: "rgba(255,184,0,.08)", border: "1px solid rgba(255,184,0,.15)", color: "#FFB800", padding: "4px 10px", borderRadius: 7, fontSize: 11, fontWeight: 700 }}>
                            🏆 Resultado: {c.dataResultado}
                          </span>
                        )}
                      </div>

                      {/* Legenda */}
                      <div style={{ color: "rgba(255,255,255,.2)", fontSize: 9, letterSpacing: 1.5, marginBottom: 8, textTransform: "uppercase" }}>
                        Legenda pronta para Instagram
                      </div>
                      <pre style={{
                        background: "rgba(0,0,0,.3)", border: "1px solid rgba(255,255,255,.06)",
                        borderRadius: 10, padding: 14,
                        color: "rgba(255,255,255,.7)", fontSize: 11,
                        whiteSpace: "pre-wrap", lineHeight: 1.75, margin: 0,
                        maxHeight: 200, overflowY: "auto",
                      }}>
                        {gerarLegenda(c)}
                      </pre>
                      <button onClick={() => copyLegenda(c)} style={{
                        marginTop: 10,
                        background: copied === c.id ? "#00C896" : "rgba(0,200,150,.1)",
                        border: "1px solid rgba(0,200,150,.2)",
                        color: copied === c.id ? "#002D1F" : "#00C896",
                        borderRadius: 7, padding: "7px 16px",
                        cursor: "pointer", fontSize: 11, fontWeight: 700,
                      }}>
                        {copied === c.id ? "✓ Copiado!" : "Copiar Legenda"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── CARDS ── */}
        {tab === "cards" && (
          <div>
            <p style={{ color: "rgba(255,255,255,.25)", fontSize: 11, marginBottom: 20 }}>
            {cardFormato === "feed"
              ? "Feed 4:5 — 1080×1350px — proporção padrão do Instagram (área visível na grade: 1012×1350px)"
              : "Stories 9:16 — 1080×1920px — somente para download manual (não publicável via web)"}
              {" — Clique em Baixar PNG para salvar."}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 28 }} className="cards-wrap">
              {filtered.map(c => (
                <div key={c.id} style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center", position: "relative", opacity: jaPostado(c.id) ? 0.45 : jaAgendado(c.id) ? 0.6 : 1, transition: "opacity .2s" }}>
                  {jaPostado(c.id) && (
                    <div style={{
                      position: "absolute", top: 10, right: 10, zIndex: 10,
                      background: "#16a34a", color: "#fff",
                      fontSize: 10, fontWeight: 800,
                      padding: "3px 10px", borderRadius: 999,
                      boxShadow: "0 2px 8px rgba(0,0,0,.4)",
                      pointerEvents: "none",
                    }}>
                      ✓ Publicado {dataPostagem(c.id)}
                    </div>
                  )}
                  {!jaPostado(c.id) && jaAgendado(c.id) && (
                    <div style={{
                      position: "absolute", top: 10, right: 10, zIndex: 10,
                      background: "#b45309", color: "#fff",
                      fontSize: 10, fontWeight: 800,
                      padding: "3px 10px", borderRadius: 999,
                      boxShadow: "0 2px 8px rgba(0,0,0,.4)",
                      pointerEvents: "none",
                    }}>
                      ⏰ Agendado {dataAgendamento(c.id)}
                    </div>
                  )}
                  <InstagramCard concurso={c} formato={cardFormato} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%", maxWidth: 390 }}>

                    {/* ── LINHA 1: Botão Publicar com dropdown (componente isolado) ── */}
                    <div style={{ display: "flex", gap: 5, justifyContent: "center" }}>
                      <CardPublicarBtn
                        concurso={c}
                        downloadingId={downloadingId}
                        onPublicar={modo => publicarInstagram(c, modo)}
                        onAgendar={modo => setAgendarModal({ concurso: c, modo })}
                      />
                    </div>

                    {/* ── LINHA 2: Utilitários ── */}
                    <div style={{ display: "flex", gap: 5, justifyContent: "center" }}>
                      <button
                        onClick={() => downloadCard(c, cardFormato)}
                        disabled={downloadingId === c.id + cardFormato}
                        style={{
                          background: "rgba(0,200,150,.08)", border: "1px solid rgba(0,200,150,.2)",
                          color: "#00C896", borderRadius: 7, padding: "6px 10px",
                          cursor: "pointer", fontSize: 10, fontWeight: 700,
                        }}
                      >
                        {downloadingId === c.id + cardFormato ? "..." : "⬇ PNG"}
                      </button>
                      <button
                        onClick={() => copyLegenda(c)}
                        style={{
                          background: "rgba(0,200,150,.08)", border: "1px solid rgba(0,200,150,.2)",
                          color: "#00C896", borderRadius: 7, padding: "6px 10px",
                          cursor: "pointer", fontSize: 10, fontWeight: 700,
                        }}
                      >
                        {copied === c.id ? "✓ Copiado!" : "Legenda"}
                      </button>
                      <Btn color="#FFB800" onClick={() => marcarPostado(c)} disabled={jaPostado(c.id)}>
                        {jaPostado(c.id) ? "✓ Postado" : "Marcar"}
                      </Btn>
                      {(() => {
                        const isPdf = c.linkEdital.toLowerCase().endsWith(".pdf");
                        return (
                          <a href={c.linkEdital} target="_blank" rel="noreferrer"
                            style={{
                              background: isPdf ? "rgba(0,200,150,.08)" : "rgba(167,139,250,.08)",
                              border: isPdf ? "1px solid rgba(0,200,150,.2)" : "1px solid rgba(167,139,250,.15)",
                              color: isPdf ? "#00C896" : "#A78BFA",
                              borderRadius: 7, padding: "6px 10px",
                              fontSize: 10, fontWeight: 600, textDecoration: "none",
                            }}
                          >
                            {isPdf ? "📄 PDF" : "↗ Notícia"}
                          </a>
                        );
                      })()}
                    </div>

                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── FAVORITOS ── */}
        {tab === "favoritos" && (
          <div style={{ maxWidth: 980 }}>
            <p style={{ color: "rgba(255,255,255,.25)", fontSize: 11, marginBottom: 20 }}>
              Concursos marcados com ⭐ para acompanhar de perto.
            </p>
            {favoritos.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "rgba(255,255,255,.2)" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>⭐</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Nenhum favorito ainda</div>
                <div style={{ fontSize: 12, marginTop: 6 }}>Clique em ☆ em qualquer concurso da lista</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {favoritos.map(f => {
                  const c = concursos.find(x => x.id === f.concurso_id);
                  return (
                    <div key={f.id} style={{
                      background: "rgba(245,158,11,.03)", border: "1px solid rgba(245,158,11,.15)",
                      borderRadius: 14, padding: "14px 18px",
                      display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                    }}>
                      <span style={{ fontSize: 18 }}>⭐</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>{f.cargo}</div>
                        <div style={{ color: "#00C896", fontSize: 12, marginTop: 2 }}>{f.orgao} — {f.cidade ? f.cidade + "/" : ""}{f.estado}{f.uf && f.uf !== f.estado ? " · " + f.uf : ""}</div>
                        {c && (
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                            <span style={{ background: "rgba(0,200,150,.08)", color: "#00C896", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5 }}>{c.salario}</span>
                            <span style={{ background: "rgba(167,139,250,.08)", color: "#A78BFA", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5 }}>{c.vagas}</span>
                            {c.status === "Inscricoes Abertas" && c.diasRestantes >= 0 && (
                              <span style={{ background: c.diasRestantes <= 7 ? "rgba(255,75,75,.1)" : "rgba(0,200,150,.08)", color: c.diasRestantes <= 7 ? "#FF4B4B" : "#00C896", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5 }}>
                                {c.diasRestantes <= 7 ? `⚡ ${c.diasRestantes}d` : `📅 ${c.diasRestantes}d`}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {c && (
                          <button onClick={() => {
                            setTab("lista");
                            setExpanded(f.concurso_id);
                            // Aguarda a tab renderizar antes de rolar até o elemento
                            setTimeout(() => {
                              const el = document.getElementById("item-" + f.concurso_id);
                              if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                            }, 120);
                          }} style={{ background: "rgba(0,200,150,.1)", border: "1px solid rgba(0,200,150,.2)", color: "#00C896", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                            Ver na lista
                          </button>
                        )}
                        <button onClick={() => fetch("/api/favoritos", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ concurso_id: f.concurso_id }) }).then(() => setFavoritos(prev => prev.filter(x => x.concurso_id !== f.concurso_id)))} style={{ background: "rgba(255,75,75,.08)", border: "1px solid rgba(255,75,75,.15)", color: "#FF4B4B", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                          Remover
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── ESTATÍSTICAS ── */}
        {tab === "stats" && (
          <div style={{ maxWidth: 800 }}>
            {!stats ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "rgba(255,255,255,.2)" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📈</div>
                <div>Carregando estatísticas...</div>
              </div>
            ) : (
              <>
                {/* Cards de totais */}
                <div className="stats-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 28 }}>
                  {[
                    { label: "Posts esta semana", value: stats.totalSemana, color: "#00C896" },
                    { label: "Posts este mês",    value: stats.totalMes,    color: "#A78BFA" },
                    { label: "Posts totais",      value: stats.totalGeral,  color: "#60A5FA" },
                  ].map(s => (
                    <div key={s.label} style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 12, padding: "16px 20px", textAlign: "center" }}>
                      <div style={{ color: s.color, fontSize: 32, fontWeight: 900 }}>{s.value}</div>
                      <div style={{ color: "rgba(255,255,255,.3)", fontSize: 10, marginTop: 4, letterSpacing: 1, textTransform: "uppercase" }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Posts por semana — barras */}
                {stats.semanasData.length > 0 && (
                  <div style={{ background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 14, padding: "20px", marginBottom: 20 }}>
                    <div style={{ color: "rgba(255,255,255,.3)", fontSize: 10, letterSpacing: 1.5, marginBottom: 14, textTransform: "uppercase" }}>Posts por semana</div>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 80 }}>
                      {(() => {
                        const max = Math.max(...stats.semanasData.map(s => s.total), 1);
                        return stats.semanasData.map(s => (
                          <div key={s.semana} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                            <div style={{ color: "rgba(255,255,255,.5)", fontSize: 9 }}>{s.total}</div>
                            <div style={{ width: "100%", background: "#00C896", borderRadius: "4px 4px 0 0", height: `${(s.total / max) * 60}px`, minHeight: 4, transition: "height .3s" }} />
                            <div style={{ color: "rgba(255,255,255,.25)", fontSize: 8, whiteSpace: "nowrap" }}>{s.label}</div>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                )}

                <div className="stats-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  {/* Top estados */}
                  {stats.topEstados.length > 0 && (
                    <div style={{ background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 14, padding: "20px" }}>
                      <div style={{ color: "rgba(255,255,255,.3)", fontSize: 10, letterSpacing: 1.5, marginBottom: 14, textTransform: "uppercase" }}>Top estados</div>
                      {stats.topEstados.map((e, i) => {
                        const max = stats.topEstados[0].total;
                        return (
                          <div key={e.estado} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                            <span style={{ color: "rgba(255,255,255,.3)", fontSize: 10, width: 16, textAlign: "right" }}>{i + 1}</span>
                            <span style={{ color: "#fff", fontSize: 12, fontWeight: 700, width: 28 }}>{e.estado}</span>
                            <div style={{ flex: 1, background: "rgba(255,255,255,.06)", borderRadius: 4, height: 6 }}>
                              <div style={{ width: `${(e.total / max) * 100}%`, background: "#00C896", borderRadius: 4, height: 6 }} />
                            </div>
                            <span style={{ color: "rgba(255,255,255,.4)", fontSize: 11, width: 20, textAlign: "right" }}>{e.total}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Top cargos */}
                  {stats.topCargos.length > 0 && (
                    <div style={{ background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 14, padding: "20px" }}>
                      <div style={{ color: "rgba(255,255,255,.3)", fontSize: 10, letterSpacing: 1.5, marginBottom: 14, textTransform: "uppercase" }}>Top cargos</div>
                      {stats.topCargos.map((c, i) => {
                        const max = stats.topCargos[0].total;
                        return (
                          <div key={c.cargo} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                            <span style={{ color: "rgba(255,255,255,.3)", fontSize: 10, width: 16, textAlign: "right" }}>{i + 1}</span>
                            <div style={{ flex: 1, background: "rgba(255,255,255,.06)", borderRadius: 4, height: 6 }}>
                              <div style={{ width: `${(c.total / max) * 100}%`, background: "#A78BFA", borderRadius: 4, height: 6 }} />
                            </div>
                            <span style={{ color: "rgba(255,255,255,.4)", fontSize: 11, maxWidth: 100, textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.cargo} ({c.total})</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {stats.totalGeral === 0 && (
                  <div style={{ textAlign: "center", padding: "40px 20px", color: "rgba(255,255,255,.2)" }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
                    <div style={{ fontSize: 13 }}>Nenhum post registrado ainda. Marque concursos como postados para ver as estatísticas.</div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── CALENDÁRIO DE PROVAS ── */}
        {tab === "calendario" && (
          <div style={{ maxWidth: 800 }}>
            <p style={{ color: "rgba(255,255,255,.25)", fontSize: 11, marginBottom: 20 }}>
              Datas de prova e resultado dos concursos ativos.
            </p>
            {(() => {
              const comData = concursos.filter(c => c.dataProva && c.dataProva !== "-");
              if (comData.length === 0) return (
                <div style={{ textAlign: "center", padding: "60px 20px", color: "rgba(255,255,255,.2)" }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>🗓️</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>Nenhuma data de prova encontrada</div>
                  <div style={{ fontSize: 12, marginTop: 6 }}>As datas aparecem quando o sistema encontra informações nos editais</div>
                </div>
              );

              // Agrupa por mês
              const porMes: Record<string, typeof comData> = {};
              for (const c of comData) {
                const partes = c.dataProva.split("/");
                if (partes.length < 3) continue;
                const chave = `${partes[2]}-${partes[1]}`;
                if (!porMes[chave]) porMes[chave] = [];
                porMes[chave].push(c);
              }

              return Object.entries(porMes).sort(([a], [b]) => a.localeCompare(b)).map(([mesAno, lista]) => {
                const [ano, mes] = mesAno.split("-");
                const nomeMes = new Date(Number(ano), Number(mes) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
                return (
                  <div key={mesAno} style={{ marginBottom: 24 }}>
                    <div style={{ color: "rgba(255,255,255,.3)", fontSize: 10, letterSpacing: 1.5, marginBottom: 10, textTransform: "uppercase" }}>
                      📅 {nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {lista.sort((a, b) => a.dataProva.localeCompare(b.dataProva)).map(c => {
                        const hoje = new Date(); hoje.setHours(0,0,0,0);
                        const [d, m, y] = c.dataProva.split("/").map(Number);
                        const dataProva = new Date(y, m - 1, d);
                        const diasParaProva = Math.ceil((dataProva.getTime() - hoje.getTime()) / 86400000);
                        const passada = diasParaProva < 0;
                        return (
                          <div key={c.id} style={{
                            background: passada ? "rgba(255,255,255,.01)" : "rgba(167,139,250,.04)",
                            border: `1px solid ${passada ? "rgba(255,255,255,.05)" : "rgba(167,139,250,.2)"}`,
                            borderRadius: 12, padding: "12px 16px",
                            display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
                            opacity: passada ? 0.5 : 1,
                          }}>
                            <div style={{
                              background: passada ? "rgba(255,255,255,.05)" : "rgba(167,139,250,.15)",
                              borderRadius: 10, padding: "8px 14px", textAlign: "center", flexShrink: 0,
                            }}>
                              <div style={{ color: passada ? "rgba(255,255,255,.3)" : "#C4B5FD", fontSize: 20, fontWeight: 900 }}>
                                {c.dataProva.split("/")[0]}
                              </div>
                              <div style={{ color: "rgba(255,255,255,.3)", fontSize: 9, letterSpacing: 1 }}>
                                {new Date(y, m - 1, d).toLocaleDateString("pt-BR", { month: "short" }).toUpperCase()}
                              </div>
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ color: passada ? "rgba(255,255,255,.5)" : "#fff", fontWeight: 700, fontSize: 14 }} title={c.cargo}>{cargoDisplay(c.cargo)}</div>
                              <div style={{ color: passada ? "rgba(0,200,150,.5)" : "#00C896", fontSize: 12, marginTop: 2 }}>{c.orgao} — {(c as Concurso & { cidade?: string }).cidade ? (c as Concurso & { cidade?: string }).cidade + "/" : ""}{c.estado}</div>
                              {c.banca !== "-" && <div style={{ color: "rgba(255,255,255,.3)", fontSize: 10, marginTop: 1 }}>{c.banca}</div>}
                            </div>
                            {!passada ? (
                              <span style={{ background: diasParaProva <= 7 ? "rgba(255,75,75,.12)" : "rgba(167,139,250,.12)", color: diasParaProva <= 7 ? "#FF4B4B" : "#A78BFA", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, whiteSpace: "nowrap" }}>
                                {diasParaProva === 0 ? "Hoje!" : diasParaProva === 1 ? "Amanhã!" : `${diasParaProva}d`}
                              </span>
                            ) : (
                              <span style={{ color: "rgba(255,255,255,.2)", fontSize: 11 }}>Realizada</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}

        {/* ── HISTÓRICO ── */}

        {tab === "historico" && (
          <div style={{ maxWidth: 700 }}>
            <p style={{ color: "rgba(255,255,255,.25)", fontSize: 11, marginBottom: 20 }}>
              Registro dos concursos que você marcou como postados.
            </p>
            {historico.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "rgba(255,255,255,.2)" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Nenhum post registrado ainda</div>
                <div style={{ fontSize: 12, marginTop: 6 }}>Marque concursos como postados na aba Lista</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {historico.map(h => (
                  <div key={h.id} style={{
                    background: "rgba(255,255,255,.025)", border: "1px solid rgba(255,255,255,.06)",
                    borderRadius: 12, padding: "12px 16px",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    gap: 12, flexWrap: "wrap",
                  }}>
                    <div>
                      <div style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>{h.cargo}</div>
                      <div style={{ color: "#00C896", fontSize: 11, marginTop: 2 }}>{h.orgao} — {h.estado}</div>
                      <div style={{ color: "rgba(255,255,255,.25)", fontSize: 10, marginTop: 2 }}>
                        Postado em {new Date(h.posted_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                    <button onClick={() => removerHistorico(h.concurso_id)} style={{
                      background: "rgba(255,75,75,.08)", border: "1px solid rgba(255,75,75,.15)",
                      color: "#FF4B4B", borderRadius: 8, padding: "6px 12px",
                      cursor: "pointer", fontSize: 11, fontWeight: 600,
                    }}>
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
    </>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", background: "#060E20", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Sora',sans-serif", gap: 16 }}>
        <div style={{ width: 44, height: 44, border: "3px solid rgba(0,200,150,.15)", borderTop: "3px solid #00C896", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
        <div style={{ color: "rgba(255,255,255,.35)", fontSize: 13 }}>Carregando...</div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}