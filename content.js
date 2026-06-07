// content.js v3.0
// Stories: usa interface mobile (janela 390px + User-Agent iPhone via rules.json)

const DELAY = ms => new Promise(r => setTimeout(r, ms));

if (window.__igExtJaRodou) {
  // já iniciou nesta página — não faz nada
} else {
  window.__igExtJaRodou = true;
  init();
}

// ─── UTILS ────────────────────────────────────────────────────────────────────

function log(nivel, msg, dados = null) {
  const entry = { ts: new Date().toISOString(), nivel, msg, dados };
  console[nivel === "erro" ? "error" : nivel === "warn" ? "warn" : "log"]("[IGExt]", msg, dados || "");
  chrome.runtime.sendMessage({ type: "LOG", entry }).catch(() => {});
}

function base64ToFile(base64, filename) {
  const arr  = base64.split(",");
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  const u8   = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
  return new File([u8], filename, { type: mime });
}

function aguardarElemento(seletor, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const el = document.querySelector(seletor);
    if (el) return resolve(el);
    const obs = new MutationObserver(() => {
      const f = document.querySelector(seletor);
      if (f) { obs.disconnect(); resolve(f); }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => { obs.disconnect(); reject(new Error("Timeout: " + seletor)); }, timeout);
  });
}

function aguardarTexto(texto, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const checar = () => {
      for (const el of document.querySelectorAll("*")) {
        if (
          el.children.length === 0 &&
          el.textContent?.trim() === texto &&
          el.tagName !== "TITLE" &&
          !el.closest("svg") &&
          el.offsetParent !== null
        ) return el;
      }
      return null;
    };
    const f = checar();
    if (f) return resolve(f);
    const obs = new MutationObserver(() => {
      const found = checar();
      if (found) { obs.disconnect(); resolve(found); }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => { obs.disconnect(); reject(new Error("Timeout texto: " + texto)); }, timeout);
  });
}

function encontrarBtnCriar() {
  for (const a of document.querySelectorAll('a[href="#"]')) {
    if ([...a.querySelectorAll("span")].some(s => s.textContent?.trim() === "Criar")) return a;
  }
  return null;
}

function injetarArquivo(inputArquivo, base64, filename) {
  // Primeiro tenta injeção local (funciona no feed/desktop)
  try {
    const arquivo = base64ToFile(base64, filename);
    const dt = new DataTransfer();
    dt.items.add(arquivo);
    inputArquivo.click = () => {};
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "files")?.set;
    if (setter) setter.call(inputArquivo, dt.files);
    else inputArquivo.files = dt.files;
    inputArquivo.dispatchEvent(new Event("change", { bubbles: true }));
    inputArquivo.dispatchEvent(new Event("input",  { bubbles: true }));
  } catch(e) {
    log("warn", "Injeção local falhou — delegando ao background: " + e.message);
  }
  // Também delega ao background (world MAIN, bypassa proteções do Instagram)
  chrome.runtime.sendMessage({ type: "INJETAR_ARQUIVO", base64, filename }).catch(() => {});
}

function snapshotDOM() {
  const textos = new Set();
  for (const el of document.querySelectorAll("*")) {
    if (el.children.length === 0 && el.tagName !== "TITLE" && !el.closest("svg")) {
      const t = el.textContent?.trim();
      if (t && t.length > 1 && t.length < 80) textos.add(t);
    }
  }
  const inputs = [...document.querySelectorAll("input,button,a[href],[role='button']")]
    .filter(el => el.offsetParent !== null)
    .map(el => ({
      tag: el.tagName,
      text: el.textContent?.trim().slice(0, 50) || "-",
      href: el.href || "-",
      aria: el.getAttribute("aria-label") || "-",
    })).slice(0, 25);
  return { url: location.href, width: window.innerWidth, textos: [...textos].slice(0, 40), inputs };
}

// ─── FEED ─────────────────────────────────────────────────────────────────────

async function publicarFeed(base64, legenda) {
  log("info", "▶ Iniciando FEED");

  let btnCriar = encontrarBtnCriar();
  if (!btnCriar) {
    await new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error("Botão Criar não encontrado")), 10000);
      const c = setInterval(() => {
        const b = encontrarBtnCriar();
        if (b) { clearInterval(c); clearTimeout(t); btnCriar = b; res(); }
      }, 400);
    });
  }
  log("info", "✅ Botão Criar — clicando");
  btnCriar.click();
  await DELAY(1000);

  const elPostar = await aguardarTexto("Postar", 5000);
  (elPostar.closest("a,button,[role='button']") || elPostar.parentElement).click();
  await DELAY(1500);

  log("info", "Aguardando input[type=file]...");
  const input = await aguardarElemento("input[type='file']", 10000);
  log("info", "✅ input encontrado — injetando");
  injetarArquivo(input, base64, "feed.png");
  await DELAY(2500);

  for (let i = 0; i < 3; i++) {
    try {
      const prox = await Promise.any([aguardarTexto("Avançar", 3000), aguardarTexto("Próximo", 3000)]);
      (prox.closest("button,[role='button'],a") || prox.parentElement).click();
      await DELAY(1500);
    } catch { break; }
  }

  if (legenda) {
    try {
      const campo = await aguardarElemento('div[contenteditable="true"][aria-label="Escreva uma legenda..."]', 6000);
      campo.focus();
      document.execCommand("selectAll", false, null);
      document.execCommand("delete", false, null);
      const linhas = legenda.split("\n");
      for (let i = 0; i < linhas.length; i++) {
        if (linhas[i]) document.execCommand("insertText", false, linhas[i]);
        if (i < linhas.length - 1) {
          ["keydown","keypress","keyup"].forEach(ev =>
            campo.dispatchEvent(new KeyboardEvent(ev, { key:"Enter", keyCode:13, which:13, bubbles:true }))
          );
        }
      }
      campo.dispatchEvent(new Event("input", { bubbles: true }));
      await DELAY(800);
      ["keydown","keyup"].forEach(ev => campo.dispatchEvent(new KeyboardEvent(ev, { key:"Escape", bubbles:true })));
      await DELAY(600);
    } catch {}
  }

  await new Promise(res => {
    const c = setInterval(() => {
      if (!document.querySelector("[role='listbox'],[role='option']")) { clearInterval(c); res(null); }
    }, 200);
    setTimeout(() => { clearInterval(c); res(null); }, 3000);
  });
  await DELAY(300);

  const btnFinal = await aguardarTexto("Compartilhar", 5000);
  (btnFinal.closest("button,[role='button'],a") || btnFinal.parentElement).click();
  await aguardarTexto("Seu post foi compartilhado.", 15000).catch(() => {});
  await DELAY(1500);
  log("info", "✅ FEED publicado!");
  chrome.runtime.sendMessage({ type: "ETAPA_CONCLUIDA", etapa: "feed" });
}

// ─── STORIES (interface mobile) ───────────────────────────────────────────────
// Fluxo: home landscape → clica "+" sobre o avatar "Seu story" → input[type=file]

async function publicarStories(base64) {
  log("info", "▶ Iniciando STORIES", { url: location.href, width: window.innerWidth });

  if (location.pathname !== "/") {
    log("info", "Navegando para home");
    location.href = "https://www.instagram.com/";
    return;
  }

  await DELAY(3000);
  log("info", "📸 DOM home mobile", snapshotDOM());

  let inputFile = null;

  // ── Fluxo correto: "+" da navbar → dropdown → clicar "Story" ──
  // O "+" fica na navbar superior (href="#") e abre dropdown com "Postar" e "Story"
  log("info", "🔍 Procurando botão '+' da navbar...", snapshotDOM());

  // Aguarda o "+" aparecer (pode demorar um pouco para carregar)
  let btnMais = null;
  for (let i = 0; i < 10; i++) {
    btnMais = encontrarBtnNavbarMais();
    if (btnMais) break;
    await DELAY(500);
  }

  if (btnMais) {
    log("info", "✅ Botão '+' encontrado — clicando", {
      tag: btnMais.tagName,
      aria: btnMais.getAttribute("aria-label"),
      href: btnMais.getAttribute("href") || "-",
      text: btnMais.textContent?.trim().slice(0, 30),
    });
    btnMais.click();
    await DELAY(1500);
    log("info", "📸 Após clicar '+'", snapshotDOM());

    // Aguarda o dropdown com "Story"
    try {
      const abaStory = await aguardarTexto("Story", 5000);
      log("info", "✅ 'Story' no dropdown — clicando");
      (abaStory.closest("button,[role='button'],a,li,div") || abaStory.parentElement).click();
      await DELAY(2000);
      log("info", "📸 Após clicar Story no dropdown", snapshotDOM());
      inputFile = await aguardarElemento("input[type='file']", 10000).catch(() => null);
    } catch {
      log("warn", "⚠️ 'Story' não apareceu no dropdown — loga DOM para debug", snapshotDOM());
    }
  } else {
    log("warn", "⚠️ Botão '+' não encontrado — loga DOM para debug", snapshotDOM());
  }

  // ── Fallback: avatar "Seu story" (só se "+" falhar) ──
  if (!inputFile) {
    log("warn", "⚠️ Fallback: clicando em 'Seu story'");
    const seuStory = encontrarSeuStory();
    if (seuStory) {
      seuStory.click();
      await DELAY(2500);
      inputFile = await aguardarElemento("input[type='file']", 8000).catch(() => null);
    }
  }

  if (!inputFile) {
    log("erro", "❌ input[type=file] não encontrado", snapshotDOM());
    chrome.runtime.sendMessage({ type: "ERRO_PUBLICACAO", erro: "input[type=file] não encontrado para Stories." });
    return;
  }

  // ── Injeta a imagem em portrait (interface mobile normal) ──
  log("info", "✅ input encontrado — injetando imagem", { accept: inputFile.accept });
  injetarArquivo(inputFile, base64, "stories.png");
  await DELAY(2000);

  // ── Muda para landscape via debugger para o editor de stories aparecer ──
  log("info", "🔄 Mudando emulação para landscape...");
  await chrome.runtime.sendMessage({ type: "SET_ORIENTATION", landscape: true }).catch(() => {});
  await DELAY(2000);
  log("info", "📸 Após landscape", snapshotDOM());

  // ── Se ainda mostrar "Gire", aguarda mais ──
  const temGire = [...document.querySelectorAll("*")].some(
    el => el.offsetParent !== null &&
          el.textContent?.trim() === "Gire seu dispositivo para adicionar ao seu story."
  );
  if (temGire) {
    log("warn", "⚠️ 'Gire seu dispositivo' ainda visível — aguardando 3s");
    await DELAY(3000);
    log("info", "📸 Após aguardar", snapshotDOM());
  }

  // ── Clica em publicar ──
  const botoesPossiveis = [
    "Adicionar ao story",
    "Compartilhar no story",
    "Adicionar ao seu story",
    "Compartilhar",
    "Avançar",
    "Publicar",
    "Enviar",
  ];

  let publicado = false;
  for (const txt of botoesPossiveis) {
    try {
      const btn = await aguardarTexto(txt, 5000);
      log("info", `✅ Botão "${txt}" — clicando`);
      (btn.closest("button,[role='button'],a") || btn.parentElement).click();
      await DELAY(2000);

      if (txt === "Avançar") {
        log("info", "📸 Após Avançar", snapshotDOM());
        for (const txt2 of ["Adicionar ao story", "Compartilhar no story", "Compartilhar", "Publicar"]) {
          try {
            const btn2 = await aguardarTexto(txt2, 5000);
            log("info", `✅ Botão final "${txt2}" — clicando`);
            (btn2.closest("button,[role='button'],a") || btn2.parentElement).click();
            publicado = true;
            break;
          } catch { log("warn", `"${txt2}" não encontrado após Avançar`); }
        }
        if (publicado) break;
      } else {
        publicado = true;
        break;
      }
    } catch {
      log("warn", `"${txt}" não encontrado`);
    }
  }

  if (!publicado) {
    log("warn", "⚠️ Nenhum botão de publicar encontrado", snapshotDOM());
  }

  await DELAY(2000);
  log("info", "✅ Stories finalizado");
  chrome.runtime.sendMessage({ type: "ETAPA_CONCLUIDA", etapa: "stories" });
}

// ─── HELPERS para encontrar elementos mobile ──────────────────────────────────

function encontrarBtnNavbarMais() {
  // No DOM do Instagram mobile, o "+" da navbar aparece como:
  // <a href="https://www.instagram.com/#"> com SVG interno, sem texto visível
  // Nos logs vimos: { href: "https://www.instagram.com/#", tag: "A", text: "Página inicial" }
  // O botão "+" real não tem texto — diferente de "Página inicial", "Notificações" etc.

  // Tenta pelo SVG com path de "+" — o Instagram usa um path específico para o ícone de criar
  for (const svg of document.querySelectorAll("svg")) {
    // Verifica se tem path com símbolo de "+" (linha horizontal + vertical)
    const paths = svg.querySelectorAll("path");
    for (const path of paths) {
      const d = path.getAttribute("d") || "";
      // Path do "+" do Instagram contém coordenadas específicas de cruz/mais
      if (d.includes("M12 2") || d.includes("M12,2") || d.length < 30) {
        const btn = svg.closest("a,button,[role='button']");
        if (btn && btn.offsetParent !== null) return btn;
      }
    }
  }

  // Fallback 1: <a href="#"> com SVG e sem texto meaningful
  for (const a of document.querySelectorAll('a[href="https://www.instagram.com/#"], a[href="#"]')) {
    if (a.offsetParent === null) continue;
    const text = (a.textContent?.trim() || "");
    const hasSvg = !!a.querySelector("svg");
    // Exclui links que têm texto longo (são outros botões como "Notificações", "Página inicial")
    if (hasSvg && text.length === 0) return a;
  }

  // Fallback 2: aria-label de criar/novo
  for (const el of document.querySelectorAll("a,button,[role='button']")) {
    if (el.offsetParent === null) continue;
    const aria = (el.getAttribute("aria-label") || "").toLowerCase();
    if (aria === "criar" || aria === "novo post" || aria === "new post" || aria === "add") return el;
  }

  return null;
}

function encontrarBtnAdicionar() {
  // Procura o "+" diretamente no container do "Seu story"
  // O DOM do Instagram mobile tem: container > [avatar img] + [botão "+"]
  for (const el of document.querySelectorAll("*")) {
    if (el.offsetParent === null) continue;
    const text = el.textContent?.trim();
    if (text === "Seu story") {
      // Sobe na árvore até encontrar um container com botão clicável
      let node = el;
      for (let i = 0; i < 6; i++) {
        node = node.parentElement;
        if (!node) break;
        // Procura botão de adicionar no container
        for (const btn of node.querySelectorAll("button,[role='button']")) {
          if (btn.offsetParent !== null) {
            log("info", "🔍 Botão próximo a 'Seu story'", {
              tag: btn.tagName,
              aria: btn.getAttribute("aria-label"),
              text: btn.textContent?.trim().slice(0,30),
            });
            return btn;
          }
        }
      }
    }
  }
  // Fallback: qualquer botão com aria-label de adicionar/criar
  for (const el of document.querySelectorAll("button,[role='button']")) {
    if (el.offsetParent === null) continue;
    const aria = (el.getAttribute("aria-label") || "").toLowerCase();
    if (aria.includes("adicionar") || aria.includes("criar") || aria.includes("novo")) return el;
  }
  return null;
}

function encontrarSeuStory() {
  for (const el of document.querySelectorAll("*")) {
    if (el.offsetParent === null) continue;
    const aria = (el.getAttribute("aria-label") || "").toLowerCase();
    const text = el.textContent?.trim() || "";
    if (
      aria.includes("seu story") ||
      aria.includes("your story") ||
      text === "Seu story"
    ) return el;
  }
  // ícone "+" sobre o avatar na barra de stories
  const plusSvg = document.querySelector('svg[aria-label="Ícone de adicionar"]');
  if (plusSvg) return plusSvg.closest("button,[role='button'],a") || plusSvg.parentElement;
  return null;
}

function encontrarBtnMais() {
  for (const el of document.querySelectorAll("a,button,[role='button']")) {
    if (el.offsetParent === null) continue;
    const aria = (el.getAttribute("aria-label") || "").toLowerCase();
    if (
      aria.includes("nova publicação") ||
      aria.includes("new post") ||
      aria.includes("criar")
    ) return el;
  }
  // Fallback: primeiro link href="#" com SVG visível
  for (const a of document.querySelectorAll('a[href="#"]')) {
    if (a.querySelector("svg") && a.offsetParent !== null) return a;
  }
  return null;
}

// ─── INIT ─────────────────────────────────────────────────────────────────────

async function init() {
  await DELAY(3000);
  log("info", "🚀 Extensão iniciada", { url: location.href, width: window.innerWidth });

  chrome.storage.local.get("ig_pendente", async (data) => {
    const pendente = data?.ig_pendente;
    if (!pendente) { log("info", "Sem publicação pendente"); return; }
    if (Date.now() - pendente.ts > 5 * 60 * 1000) {
      log("warn", "Expirado — descartando");
      chrome.storage.local.remove("ig_pendente");
      return;
    }

    log("info", `📋 Etapa: ${pendente.etapa}`, {
      temFeed: !!pendente.feedBase64,
      temStories: !!pendente.storiesBase64,
      temLegenda: !!pendente.legenda,
    });

    const isStories = pendente.etapa === "stories";

    if (!isStories) {
      await new Promise(resolve => {
        const c = setInterval(() => {
          if (encontrarBtnCriar()) { clearInterval(c); resolve(null); }
        }, 300);
        setTimeout(() => { clearInterval(c); resolve(null); }, 10000);
      });
      await DELAY(500);
    } else {
      await DELAY(2500);
    }

    const base64 = isStories ? pendente.storiesBase64 : pendente.feedBase64;
    if (!base64) {
      chrome.runtime.sendMessage({ type: "ETAPA_CONCLUIDA", etapa: pendente.etapa });
      return;
    }

    try {
      if (isStories) await publicarStories(base64);
      else await publicarFeed(base64, pendente.legenda);
    } catch (erro) {
      log("erro", "❌ Erro: " + erro.message);
      chrome.runtime.sendMessage({ type: "ERRO_PUBLICACAO", erro: erro.message });
    }
  });
}
