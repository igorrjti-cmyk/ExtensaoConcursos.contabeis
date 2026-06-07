// popup.js v2.4
const statusEl  = document.getElementById("status");
const btnLimpar = document.getElementById("btnLimpar");
const logBox    = document.getElementById("logBox");
const btnClear  = document.getElementById("btnClearLogs");

function horaFormatada(iso) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit", second:"2-digit" });
}

function renderLogs(logs) {
  if (!logs || logs.length === 0) {
    logBox.innerHTML = '<div class="empty">Nenhum log ainda.<br>Clique em Publicar no painel para ver o processo.</div>';
    return;
  }
  logBox.innerHTML = logs.map(entry => {
    const dadosStr = entry.dados ? JSON.stringify(entry.dados, null, 2) : null;
    const dadosHtml = dadosStr ? `<div class="log-dados expandivel" onclick="this.style.maxHeight=this.style.maxHeight==='none'?'120px':'none'">${dadosStr}</div>` : "";
    return `<div class="log-entry ${entry.nivel}">
      <span class="log-time">${horaFormatada(entry.ts)}</span>${entry.msg}${dadosHtml}
    </div>`;
  }).join("");
  // Auto-scroll para o fim
  logBox.scrollTop = logBox.scrollHeight;
}

function atualizarStatus(pendente) {
  if (pendente && Date.now() - pendente.ts < 5 * 60 * 1000) {
    const isStories = pendente.etapa === "stories";
    statusEl.className = isStories ? "status stories" : "status feed";
    statusEl.innerHTML = isStories
      ? `<span class="dot rosa"></span>Publicando Stories (modo mobile)...`
      : `<span class="dot verde"></span>Publicando Feed...`;
    btnLimpar.style.display = "block";
  } else {
    statusEl.className = "status ok";
    statusEl.textContent = "✓ Nenhuma publicação pendente";
    btnLimpar.style.display = "none";
  }
}

// Carrega estado inicial
chrome.storage.local.get(["ig_pendente", "ig_logs"], (data) => {
  atualizarStatus(data.ig_pendente);
  renderLogs(data.ig_logs);
});

// Atualiza em tempo real quando storage muda
chrome.storage.onChanged.addListener((changes) => {
  if (changes.ig_pendente) atualizarStatus(changes.ig_pendente.newValue);
  if (changes.ig_logs)     renderLogs(changes.ig_logs.newValue);
});

btnLimpar.addEventListener("click", () => {
  chrome.storage.local.remove("ig_pendente", () => {
    statusEl.className = "status ok";
    statusEl.textContent = "Cancelado.";
    btnLimpar.style.display = "none";
  });
});

btnClear.addEventListener("click", () => {
  chrome.storage.local.set({ ig_logs: [] });
  logBox.innerHTML = '<div class="empty">Logs limpos.</div>';
});
