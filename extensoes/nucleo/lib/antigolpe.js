// Camada antigolpe: listas públicas de phishing/malware + análise local do
// endereço antes de cada página abrir. Nenhum endereço visitado sai do
// computador: as listas são baixadas inteiras e comparadas aqui.
import { analisarEndereco } from "./analise.js";
import { ler, gravar, hostDe, hostCorresponde } from "./config.js";
import { contar } from "./estatisticas.js";

const FONTES = [
  // abuse.ch URLhaus: domínios que distribuem vírus/ransomware (formato hosts)
  { id: "urlhaus", url: "https://urlhaus.abuse.ch/downloads/hostfile/", tipo: "hosts" },
  // OpenPhish: endereços de phishing ativos (um por linha)
  { id: "openphish", url: "https://openphish.com/feed.txt", tipo: "urls" }
];

let hostsPerigosos = new Set();
let urlsPerigosas = new Set();
let carregado = false;

export async function carregarListas() {
  const { listasGolpe } = await chrome.storage.local.get({ listasGolpe: { hosts: [], urls: [] } });
  hostsPerigosos = new Set(listasGolpe.hosts);
  urlsPerigosas = new Set(listasGolpe.urls);
  carregado = true;
}

export async function atualizarListas() {
  if (!(await ler("listasAntiGolpe"))) return { atualizado: false, motivo: "desligado" };
  const hosts = new Set();
  const urls = new Set();
  const erros = [];
  for (const fonte of FONTES) {
    try {
      const r = await fetch(fonte.url, { cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const texto = await r.text();
      for (let linha of texto.split(/\r?\n/)) {
        linha = linha.trim();
        if (!linha || linha.startsWith("#")) continue;
        if (fonte.tipo === "hosts") {
          const partes = linha.split(/\s+/);
          const h = (partes[1] || partes[0]).toLowerCase();
          if (h && h !== "localhost" && h.includes(".")) hosts.add(h);
        } else {
          try {
            const u = new URL(linha);
            urls.add((u.origin + u.pathname + u.search).toLowerCase());
          } catch {}
        }
      }
    } catch (e) {
      erros.push(`${fonte.id}: ${e.message}`);
    }
  }
  if (hosts.size || urls.size) {
    await chrome.storage.local.set({
      listasGolpe: { hosts: [...hosts], urls: [...urls], quando: Date.now() }
    });
    hostsPerigosos = hosts;
    urlsPerigosas = urls;
  }
  return { atualizado: hosts.size + urls.size > 0, hosts: hosts.size, urls: urls.size, erros };
}

export function analisar(url) {
  return analisarEndereco(url, { hostsPerigosos, urlsPerigosas });
}

async function liberado(host) {
  const excecoes = (await ler("excecoesGolpe")) || [];
  const agora = Date.now();
  return excecoes.some((e) => e.ate > agora && hostCorresponde(host, e.host));
}

export async function liberarTemporariamente(host, minutos = 60) {
  const excecoes = ((await ler("excecoesGolpe")) || []).filter((e) => e.ate > Date.now() && e.host !== host);
  excecoes.push({ host, ate: Date.now() + minutos * 60000 });
  await gravar({ excecoesGolpe: excecoes });
}

// Verifica a navegação principal de cada aba antes da página carregar.
export function iniciarVigia() {
  chrome.webNavigation.onBeforeNavigate.addListener(async (det) => {
    if (det.frameId !== 0) return;
    if (!/^https?:/i.test(det.url)) return;
    if (!(await ler("antiGolpe"))) return;
    if (!carregado) await carregarListas();
    const host = hostDe(det.url);
    if (await liberado(host)) return;
    const r = analisar(det.url);
    if (r.nivel === "ok") return;
    await contar("golpes");
    const destino = chrome.runtime.getURL("paginas/alerta.html") +
      "?" + new URLSearchParams({ url: det.url, nivel: r.nivel, motivos: JSON.stringify(r.motivos) });
    chrome.tabs.update(det.tabId, { url: destino }).catch(() => {});
  });

  // Downloads: cancela arquivos vindos de sites de golpe e avisa sobre
  // programas baixados sem conexão segura.
  chrome.downloads.onCreated.addListener(async (item) => {
    if (!(await ler("bloquearDownloadsPerigosos"))) return;
    if (!carregado) await carregarListas();
    const origem = item.finalUrl || item.url;
    const r = analisar(origem);
    const executavel = /\.(exe|msi|scr|bat|cmd|ps1|vbs|js|jar|apk|dmg|pkg|lnk|hta)$/i.test(item.filename || origem);
    if (r.nivel === "perigoso") {
      chrome.downloads.cancel(item.id);
      notificar("Download bloqueado", `O arquivo veio de um site conhecido por golpes ou vírus (${hostDe(origem)}).`);
      await contar("golpes");
    } else if (executavel && origem.startsWith("http:")) {
      chrome.downloads.pause(item.id);
      notificar(
        "Download pausado por segurança",
        "Este programa está vindo por uma conexão sem cadeado (http). Se confia no site, retome em Downloads."
      );
    }
  });
}

function notificar(titulo, texto) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: chrome.runtime.getURL("icones/icone-128.png"),
    title: titulo,
    message: texto,
    priority: 2
  });
}
