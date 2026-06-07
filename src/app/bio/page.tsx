"use client";

import { useEffect, useState, useMemo } from "react";

interface BioItem {
  id: string; cargo: string; orgao: string; estado: string;
  salario: string; vagas: string; nivel: string; banca: string;
  status: string; inscricaoAte: string; diasRestantes: number;
  dataProva: string; linkEdital: string; linkNoticia: string;
  posted_at: string; ativo: boolean;
}

const STATUS_COLOR: Record<string,string> = {"Inscricoes Abertas":"#00C896","Aguardando Prova":"#A78BFA","Previsto":"#FFB800","Encerrado":"#555"};
const STATUS_LABEL: Record<string,string> = {"Inscricoes Abertas":"Inscrições Abertas","Aguardando Prova":"Aguardando Prova","Previsto":"Previsto","Encerrado":"Encerrado"};
const ESTADOS = ["Todos","AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO","Nacional"];

export default function BioPage() {
  const [items, setItems]   = useState<BioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca]   = useState("");
  const [status, setStatus] = useState<"ativos"|"todos"|"encerrados">("ativos");
  const [estado, setEstado] = useState("Todos");
  const [nivel, setNivel]   = useState("Todos");
  const [ordenar, setOrdenar] = useState<"recente"|"prazo"|"salario">("recente");
  const [expandido, setExpandido] = useState<string|null>(null);
  const [atualizado, setAtualizado] = useState("");

  useEffect(() => {
    fetch("/api/bio").then(r=>r.json()).then(d=>{
      if(d.ok){ setItems(d.items); if(d.atualizado) setAtualizado(new Date(d.atualizado).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})); }
    }).finally(()=>setLoading(false));
  },[]);

  const niveis = useMemo(()=>["Todos",...Array.from(new Set(items.map(i=>i.nivel).filter(Boolean)))] as string[],[items]);

  const filtrados = useMemo(()=>{
    let r=[...items];
    if(status==="ativos") r=r.filter(i=>i.ativo&&i.status!=="Encerrado");
    if(status==="encerrados") r=r.filter(i=>!i.ativo||i.status==="Encerrado");
    if(estado!=="Todos") r=r.filter(i=>i.estado===estado);
    if(nivel!=="Todos") r=r.filter(i=>i.nivel===nivel);
    if(busca.trim()){ const b=busca.toLowerCase(); r=r.filter(i=>i.cargo.toLowerCase().includes(b)||i.orgao.toLowerCase().includes(b)||i.estado.toLowerCase().includes(b)||i.banca.toLowerCase().includes(b)); }
    if(ordenar==="prazo") r.sort((a,b)=>{ if(a.diasRestantes<0&&b.diasRestantes>=0)return 1; if(b.diasRestantes<0&&a.diasRestantes>=0)return -1; return a.diasRestantes-b.diasRestantes; });
    else if(ordenar==="salario") r.sort((a,b)=>{ const p=(s:string)=>parseFloat(s.replace(/[R$.\s]/g,"").replace(",","."))||0; return p(b.salario)-p(a.salario); });
    else r.sort((a,b)=>new Date(b.posted_at).getTime()-new Date(a.posted_at).getTime());
    return r;
  },[items,status,estado,nivel,busca,ordenar]);

  const urgentes = filtrados.filter(i=>i.diasRestantes>=0&&i.diasRestantes<=3&&i.status==="Inscricoes Abertas");

  return (
    <div style={{minHeight:"100vh",background:"#060E20",fontFamily:"'Sora',sans-serif",color:"#fff"}}>
      <link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800;900&display=swap" rel="stylesheet"/>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}@keyframes urgentPulse{0%,100%{box-shadow:0 0 0 0 rgba(255,75,75,.4)}50%{box-shadow:0 0 0 8px rgba(255,75,75,0)}}.card{animation:fadeUp .35s ease both;transition:transform .18s,box-shadow .18s}.card:hover{transform:translateY(-2px);box-shadow:0 8px 32px rgba(0,0,0,.3)}input::placeholder{color:rgba(255,255,255,.25)}select option{background:#0D1B35}::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:rgba(0,200,150,.2);border-radius:3px}input,select{font-size:max(12px,16px)}`}</style>

      <div style={{background:"linear-gradient(180deg,rgba(0,200,150,.06) 0%,transparent 100%)",borderBottom:"1px solid rgba(0,200,150,.08)",padding:"32px 20px 24px",textAlign:"center"}}>
        <div style={{width:68,height:68,borderRadius:"50%",background:"linear-gradient(135deg,#00C896,#007A6E)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px",fontSize:30,boxShadow:"0 0 40px rgba(0,200,150,.3)"}}>🧾</div>
        <h1 style={{background:"linear-gradient(90deg,#00C896,#00E5A8)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",fontSize:24,fontWeight:900,letterSpacing:"-.5px",marginBottom:4}}>Concursos Contábeis</h1>
        <p style={{color:"rgba(255,255,255,.35)",fontSize:12,marginBottom:4}}>@concursos.contabeis · Todos os editais publicados no Instagram</p>
        {atualizado&&<div style={{display:"inline-flex",alignItems:"center",gap:6,background:"rgba(0,200,150,.07)",border:"1px solid rgba(0,200,150,.12)",borderRadius:20,padding:"3px 12px",marginTop:10,color:"#00C896",fontSize:10,fontWeight:700}}><span style={{width:5,height:5,borderRadius:"50%",background:"#00C896",animation:"pulse 2s infinite",display:"inline-block"}}/>{atualizado}</div>}
      </div>

      {urgentes.length>0&&<div style={{margin:"12px 16px 0",padding:"12px 16px",background:"rgba(255,75,75,.06)",border:"1px solid rgba(255,75,75,.2)",borderRadius:12}}><p style={{fontSize:11,fontWeight:800,color:"#FF4B4B",marginBottom:8}}>⚡ ENCERRANDO EM BREVE</p><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{urgentes.slice(0,4).map(u=><span key={u.id} style={{fontSize:10,fontWeight:700,background:"rgba(255,75,75,.1)",color:"#FF4B4B",padding:"3px 10px",borderRadius:10,border:"1px solid rgba(255,75,75,.2)"}}>{u.cargo} · {u.diasRestantes===0?"hoje!":`${u.diasRestantes}d`}</span>)}</div></div>}

      <div style={{padding:"14px 16px 0"}}>
        <div style={{position:"relative"}}>
          <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:16,opacity:.4}}>🔍</span>
          <input type="text" placeholder="Buscar cargo, órgão, estado ou banca..." value={busca} onChange={e=>setBusca(e.target.value)} style={{width:"100%",padding:"12px 14px 12px 42px",background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",borderRadius:12,color:"#fff",fontSize:14,fontFamily:"'Sora',sans-serif",outline:"none"}}/>
          {busca&&<button onClick={()=>setBusca("")} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"rgba(255,255,255,.4)",cursor:"pointer",fontSize:18}}>×</button>}
        </div>
      </div>

      <div style={{padding:"10px 16px 0",display:"flex",flexDirection:"column",gap:8}}>
        <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4}}>
          {(["ativos","todos","encerrados"] as const).map(s=><button key={s} onClick={()=>setStatus(s)} style={{padding:"6px 14px",borderRadius:20,fontSize:11,fontWeight:700,flexShrink:0,background:status===s?"rgba(0,200,150,.15)":"rgba(255,255,255,.04)",border:`1px solid ${status===s?"#00C896":"rgba(255,255,255,.08)"}`,color:status===s?"#00C896":"rgba(255,255,255,.4)",cursor:"pointer"}}>{s==="ativos"?"✅ Inscrições abertas":s==="todos"?"📋 Todos":"🔒 Encerrados"}</button>)}
        </div>
        <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4}}>
          <select value={estado} onChange={e=>setEstado(e.target.value)} style={{padding:"6px 10px",borderRadius:10,fontSize:11,fontWeight:700,background:estado!=="Todos"?"rgba(0,200,150,.1)":"rgba(255,255,255,.04)",border:`1px solid ${estado!=="Todos"?"rgba(0,200,150,.3)":"rgba(255,255,255,.08)"}`,color:estado!=="Todos"?"#00C896":"rgba(255,255,255,.5)",fontFamily:"'Sora',sans-serif",cursor:"pointer",flexShrink:0}}>{ESTADOS.map(o=><option key={o} value={o}>{o}</option>)}</select>
          <select value={nivel} onChange={e=>setNivel(e.target.value)} style={{padding:"6px 10px",borderRadius:10,fontSize:11,fontWeight:700,background:nivel!=="Todos"?"rgba(0,200,150,.1)":"rgba(255,255,255,.04)",border:`1px solid ${nivel!=="Todos"?"rgba(0,200,150,.3)":"rgba(255,255,255,.08)"}`,color:nivel!=="Todos"?"#00C896":"rgba(255,255,255,.5)",fontFamily:"'Sora',sans-serif",cursor:"pointer",flexShrink:0}}>{niveis.map(o=><option key={o} value={o}>{o}</option>)}</select>
          <select value={ordenar} onChange={e=>setOrdenar(e.target.value as typeof ordenar)} style={{padding:"6px 10px",borderRadius:10,fontSize:11,fontWeight:700,background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",color:"rgba(255,255,255,.5)",fontFamily:"'Sora',sans-serif",cursor:"pointer",flexShrink:0}}><option value="recente">🕒 Mais recentes</option><option value="prazo">⏰ Prazo urgente</option><option value="salario">💰 Maior salário</option></select>
        </div>
      </div>

      <div style={{padding:"8px 16px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <p style={{color:"rgba(255,255,255,.25)",fontSize:11}}>{filtrados.length} concurso{filtrados.length!==1?"s":""} encontrado{filtrados.length!==1?"s":""}{busca?` para "${busca}`:""}</p>
        {(busca||estado!=="Todos"||nivel!=="Todos")&&<button onClick={()=>{setBusca("");setEstado("Todos");setNivel("Todos");}} style={{background:"none",border:"none",color:"#FF4B4B",fontSize:11,fontWeight:700,cursor:"pointer"}}>Limpar filtros</button>}
      </div>

      {loading&&<div style={{textAlign:"center",padding:"60px 20px"}}><div style={{width:32,height:32,border:"3px solid rgba(0,200,150,.15)",borderTop:"3px solid #00C896",borderRadius:"50%",animation:"pulse .8s linear infinite",margin:"0 auto 12px"}}/><p style={{color:"rgba(255,255,255,.3)",fontSize:12}}>Carregando editais...</p></div>}

      {!loading&&<div style={{padding:"10px 16px 60px",display:"flex",flexDirection:"column",gap:8}}>
        {filtrados.length===0&&<div style={{textAlign:"center",padding:"60px 20px",color:"rgba(255,255,255,.2)"}}><div style={{fontSize:36,marginBottom:12}}>🔍</div><div style={{fontSize:14,fontWeight:600}}>Nenhum concurso encontrado</div><div style={{fontSize:12,marginTop:6}}>Tente ajustar os filtros</div></div>}
        {filtrados.map((item,idx)=>{
          const cor=STATUS_COLOR[item.status]??"#555";
          const link=item.linkEdital||item.linkNoticia||"#";
          const isPdf=item.linkEdital?.toLowerCase().endsWith(".pdf");
          const urgente=item.diasRestantes>=0&&item.diasRestantes<=7&&item.status==="Inscricoes Abertas";
          const aberto=expandido===item.id;
          return(
            <div key={item.id} className="card" style={{animationDelay:`${Math.min(idx*25,300)}ms`,background:urgente?"rgba(255,75,75,.04)":item.ativo?"rgba(255,255,255,.03)":"rgba(255,255,255,.015)",border:`1px solid ${urgente?"rgba(255,75,75,.18)":item.ativo?"rgba(255,255,255,.07)":"rgba(255,255,255,.04)"}`,borderRadius:14,overflow:"hidden",opacity:item.ativo?1:0.5}}>
              <div style={{height:2,background:`linear-gradient(90deg,${cor},transparent)`,opacity:item.ativo?.8:.3}}/>
              <div style={{padding:"12px 14px"}}>
                <div onClick={()=>setExpandido(aberto?null:item.id)} style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,cursor:"pointer"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:800,fontSize:14,color:"#fff",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.cargo}</div>
                    <div style={{color:"#00C896",fontSize:11,fontWeight:600,marginTop:2}}>{item.orgao}</div>
                    <div style={{color:"rgba(255,255,255,.3)",fontSize:10,marginTop:1}}>{item.estado}{item.banca!=="-"?` · ${item.banca}`:""} · {item.nivel}</div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0}}>
                    {urgente?<span style={{background:"rgba(255,75,75,.15)",color:"#FF4B4B",fontSize:10,fontWeight:800,padding:"3px 10px",borderRadius:20,border:"1px solid rgba(255,75,75,.25)"}}>⚡ {item.diasRestantes===0?"Hoje!":`${item.diasRestantes}d`}</span>:<span style={{background:cor+"15",color:cor,fontSize:9,fontWeight:700,padding:"3px 9px",borderRadius:20,border:`1px solid ${cor}25`}}>{STATUS_LABEL[item.status]??item.status}</span>}
                    <span style={{fontSize:12,color:"rgba(255,255,255,.2)",transform:aberto?"rotate(180deg)":"none",transition:"transform .2s",display:"inline-block"}}>▾</span>
                  </div>
                </div>
                <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:8}}>
                  {item.salario!=="Ver edital"&&<span style={{fontSize:10,fontWeight:700,color:"#00C896",background:"rgba(0,200,150,.08)",padding:"2px 8px",borderRadius:6,border:"1px solid rgba(0,200,150,.12)"}}>💰 {item.salario}</span>}
                  {item.vagas!=="Ver edital"&&<span style={{fontSize:10,fontWeight:700,color:"#A78BFA",background:"rgba(167,139,250,.08)",padding:"2px 8px",borderRadius:6,border:"1px solid rgba(167,139,250,.12)"}}>🎯 {item.vagas}</span>}
                  {item.inscricaoAte!=="-"&&item.status==="Inscricoes Abertas"&&<span style={{fontSize:10,fontWeight:700,color:"#FFB800",background:"rgba(255,184,0,.08)",padding:"2px 8px",borderRadius:6,border:"1px solid rgba(255,184,0,.12)"}}>📅 até {item.inscricaoAte}</span>}
                  {item.dataProva!=="-"&&<span style={{fontSize:10,fontWeight:700,color:"#C4B5FD",background:"rgba(196,181,253,.08)",padding:"2px 8px",borderRadius:6,border:"1px solid rgba(196,181,253,.12)"}}>📝 {item.dataProva}</span>}
                </div>
                {aberto&&<div style={{marginTop:12,paddingTop:12,borderTop:"1px solid rgba(255,255,255,.06)",animation:"fadeUp .2s ease"}}>
                  <a href={link} target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,background:isPdf?"linear-gradient(135deg,#00C896,#00A87A)":"rgba(255,255,255,.07)",color:isPdf?"#002D1F":"rgba(255,255,255,.7)",borderRadius:10,padding:"11px 16px",fontSize:13,fontWeight:800,textDecoration:"none",border:isPdf?"none":"1px solid rgba(255,255,255,.1)"}}>
                    {isPdf?"📄 Abrir Edital (PDF)":"🔗 Ver notícia do concurso"}
                  </a>
                </div>}
              </div>
            </div>
          );
        })}
      </div>}

      <div style={{borderTop:"1px solid rgba(255,255,255,.05)",padding:"20px 16px",textAlign:"center",color:"rgba(255,255,255,.18)",fontSize:11}}>
        <p>Concursos Contábeis · @concursos.contabeis</p>
        <p style={{marginTop:4}}>Dados do <a href="https://www.pciconcursos.com.br" target="_blank" rel="noreferrer" style={{color:"rgba(0,200,150,.4)",textDecoration:"none"}}>PCI Concursos</a> · Atualizado automaticamente</p>
      </div>
    </div>
  );
}
