// background.js v5.0
// Feed + Stories: publica via Instagram Graph API
// Suporte a agendamento (scheduled_publish_time)

const MAX_LOGS = 200;
let logBuffer = [];

const IG = {
  accessToken: "EAARBkW84Ti8BRnecGN7TxA7C59yDHRMJzKyf6lUbuYx2rMk5aUNo2rb9ZBgNmdVyg14Xmcg76X11M7uAfaTRp5bEZCMoq4pgJCMyvrYKQmfxOErUqPJYwzgksG5m7U5hbjjhyGKf8rx67rPeAZAJceqGbZB7RrZBINqRK0UZBBK3hedVZCGRgRV36dLfLNvZBEwxsjVMm5EZCRjRcxVFQ",
  igId: "17841459409972261",
  apiVersion: "v19.0",
};

function addLog(entry) {
  logBuffer.push(entry);
  if (logBuffer.length > MAX_LOGS) logBuffer.shift();
  chrome.storage.local.set({ ig_logs: logBuffer });
}
function log(nivel, msg, dados = null) {
  addLog({ ts: new Date().toISOString(), nivel, msg, dados });
}

async function uploadImagem(base64) {
  try {
    const b64 = base64.includes(",") ? base64.split(",")[1] : base64;
    const res = await fetch("https://api.imgur.com/3/image", {
      method: "POST",
      headers: { "Authorization": "Client-ID 546c25a59c58ad7", "Content-Type": "application/json" },
      body: JSON.stringify({ image: b64, type: "base64" }),
    });
    const data = await res.json();
    if (data.success && data.data?.link) return data.data.link;
    log("warn", "Imgur falhou", data);
    return null;
  } catch (e) {
    log("erro", "Upload falhou: " + e.message);
    return null;
  }
}

async function criarContainer(imageUrl, mediaType, legenda, scheduledTime) {
  const body = { image_url: imageUrl, media_type: mediaType, access_token: IG.accessToken };
  if (legenda && mediaType === "IMAGE") body.caption = legenda;
  if (scheduledTime) {
    body.published = false;
    body.scheduled_publish_time = Math.floor(new Date(scheduledTime).getTime() / 1000);
  }
  const res = await fetch(`https://graph.facebook.com/${IG.apiVersion}/${IG.igId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function aguardarContainer(containerId) {
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const res = await fetch(
      `https://graph.facebook.com/${IG.apiVersion}/${containerId}?fields=status_code,status&access_token=${IG.accessToken}`
    );
    const data = await res.json();
    log("info", `Status container (${i+1}/10)`, data);
    if (data.status_code === "FINISHED") return true;
    if (data.status_code === "ERROR") return false;
  }
  return false;
}

async function publicarContainer(containerId) {
  const res = await fetch(`https://graph.facebook.com/${IG.apiVersion}/${IG.igId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: containerId, access_token: IG.accessToken }),
  });
  return res.json();
}

async function publicarMidia(base64, mediaType, legenda, scheduledTime) {
  const tipo = mediaType === "STORIES" ? "Story" : "Feed";
  log("info", `📡 Publicando ${tipo} via API...`);

  const imageUrl = await uploadImagem(base64);
  if (!imageUrl) { log("erro", "❌ Upload falhou"); return false; }
  log("info", "✅ Imagem hospedada", { url: imageUrl });

  const container = await criarContainer(imageUrl, mediaType, legenda, scheduledTime);
  log("info", `📦 Container ${tipo}`, container);
  if (!container.id) { log("erro", "❌ Falha ao criar container", container); return false; }

  const ok = await aguardarContainer(container.id);
  if (!ok) { log("erro", "❌ Container com erro"); return false; }

  if (scheduledTime) {
    log("info", `⏰ ${tipo} agendado!`, { para: scheduledTime, containerId: container.id });
    return true;
  }

  const pub = await publicarContainer(container.id);
  log("info", `📤 Publicação ${tipo}`, pub);
  if (pub.id) { log("info", `🎉 ${tipo} publicado!`, { postId: pub.id }); return true; }
  log("erro", `❌ Falha ${tipo}`, pub);
  return false;
}

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message.type !== "PUBLICAR_INSTAGRAM") return;

  const { feedBase64, storiesBase64, legenda, agendadoPara } = message;

  logBuffer = [];
  chrome.storage.local.set({ ig_logs: [] });
  log("info", "Nova publicação", {
    temFeed: !!feedBase64, temStories: !!storiesBase64,
    agendado: !!agendadoPara, agendadoPara: agendadoPara || null,
  });

  (async () => {
    const res = { feed: null, stories: null };
    if (feedBase64)    res.feed    = await publicarMidia(feedBase64,    "IMAGE",   legenda,  agendadoPara);
    if (storiesBase64) res.stories = await publicarMidia(storiesBase64, "STORIES", null,     agendadoPara);

    const ok = Object.values(res).filter(v => v !== null).every(v => v === true);
    log("info", ok ? "🎉 Publicação completa!" : "⚠️ Publicação com erros", res);

    chrome.notifications.create({
      type: "basic", iconUrl: "icon.png",
      title: ok ? "✅ Publicado com sucesso!" : "⚠️ Publicação com erros",
      message: ok
        ? [feedBase64 && "Feed", storiesBase64 && "Stories"].filter(Boolean).join(" + ") + " publicado!"
        : "Verifique os logs na extensão.",
    });

    sendResponse({ ok, resultados: res });
  })();

  return true;
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "LOG") addLog(message.entry);
});
