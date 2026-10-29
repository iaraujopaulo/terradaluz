// Núcleo do Terra da Luz — processo de fundo.
import { ler, gravar, hostDe, PADRAO } from "./lib/config.js";
import { aplicarNivel, sincronizarExcecoes, alternarSite, siteProtegido } from "./lib/escudo.js";
import { iniciarVigia, carregarListas, atualizarListas, liberarTemporariamente, analisar } from "./lib/antigolpe.js";
import { coletarBloqueios, bloqueiosDaAba } from "./lib/estatisticas.js";
import { nativo, ajudanteDisponivel } from "./lib/nativo.js";
import {
  abrirNoModoIE, siteSempreNoIE, alternarSempreNoIE, identidade, abrirEmConteiner, conteinerDoSite,
  definirConteinerDoSite, novoIdConteiner, idDaLoja, instalarDaLoja, extensoesDaLoja, verificarAtualizacoesDaLoja
} from "./lib/recursos.js";

// ---------- instalação e inicialização ----------
chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  // completa configurações novas sem apagar as escolhas da pessoa
  const atuais = await chrome.storage.local.get(null);
  const faltando = {};
  for (const [k, v] of Object.entries(PADRAO)) if (!(k in atuais)) faltando[k] = v;
  await chrome.storage.local.set(faltando);

  await aplicarNivel();
  await sincronizarExcecoes();
  criarMenus();
  chrome.alarms.create("coleta", { periodInMinutes: 1 });
  chrome.alarms.create("listas", { delayInMinutes: 1, periodInMinutes: 12 * 60 });
  chrome.alarms.create("extensoes", { delayInMinutes: 30, periodInMinutes: 24 * 60 });
  chrome.alarms.create("navegador", { delayInMinutes: 10, periodInMinutes: 6 * 60 });
  if (reason === "install") atualizarListas();
});

chrome.runtime.onStartup.addListener(async () => {
  await carregarListas();
  await aplicarNivel();
  criarMenus();
});

iniciarVigia();

chrome.alarms.onAlarm.addListener(async (alarme) => {
  if (alarme.name === "coleta") coletarBloqueios();
  if (alarme.name === "listas") atualizarListas();
  if (alarme.name === "extensoes" && (await ler("verificarAtualizacoesExtensoes"))) {
    const novas = await verificarAtualizacoesDaLoja().catch(() => []);
    if (novas.length) {
      chrome.notifications.create("extensoes", {
        type: "basic",
        iconUrl: chrome.runtime.getURL("icones/icone-128.png"),
        title: "Atualizações de extensões",
        message: `${novas.length} extensão(ões) da Chrome Web Store têm versão nova. Abra a Central de extensões para atualizar.`
      });
    }
  }
  if (alarme.name === "navegador") {
    try {
      const r = await nativo({ comando: "verificarAtualizacao" }, 30000);
      if (r.disponivel) {
        chrome.notifications.create("navegador", {
          type: "basic",
          iconUrl: chrome.runtime.getURL("icones/icone-128.png"),
          title: `Terra da Luz ${r.novaVersao} disponível`,
          message: "A atualização será instalada automaticamente quando você fechar o navegador.",
          buttons: [{ title: "Instalar agora (reinicia o navegador)" }]
        });
      }
    } catch {}
  }
});

chrome.notifications.onClicked.addListener((id) => {
  const destino = { extensoes: "#extensoes", navegador: "#atualizacoes" }[id];
  if (destino) chrome.tabs.create({ url: chrome.runtime.getURL("paginas/painel.html" + destino) });
});
chrome.notifications.onButtonClicked.addListener((id) => {
  if (id === "navegador") acoes.instalarAtualizacaoNavegador({ agora: true }).catch(() => {});
});

// ---------- sites que sempre abrem no modo IE ou em um contêiner ----------
chrome.webNavigation.onBeforeNavigate.addListener(async (det) => {
  if (det.frameId !== 0 || !/^https?:/i.test(det.url)) return;
  const host = hostDe(det.url);
  if (await siteSempreNoIE(host)) {
    try {
      await abrirNoModoIE(det.url);
      const aviso = chrome.runtime.getURL("paginas/modoie.html") + "?" + new URLSearchParams({ url: det.url });
      chrome.tabs.update(det.tabId, { url: aviso });
    } catch {}
    return;
  }
  if (await identidade()) return; // já estamos dentro de um contêiner
  const idC = await conteinerDoSite(host);
  if (idC) {
    try {
      await abrirEmConteiner(idC, det.url);
      const aba = await chrome.tabs.get(det.tabId);
      const abas = await chrome.tabs.query({ windowId: aba.windowId });
      if (abas.length > 1) chrome.tabs.remove(det.tabId);
      else chrome.tabs.update(det.tabId, { url: "chrome://newtab/" });
    } catch {}
  }
});

// ---------- menus de contexto ----------
async function criarMenus() {
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({ id: "ie-pagina", title: "Recarregar no modo Internet Explorer", contexts: ["page", "frame"] });
  chrome.contextMenus.create({ id: "ie-link", title: "Abrir link no modo Internet Explorer", contexts: ["link"] });
  const conteineres = await ler("conteineres");
  if (conteineres.length && !(await identidade())) {
    chrome.contextMenus.create({ id: "conteiner", title: "Abrir link em contêiner", contexts: ["link"] });
    for (const c of conteineres) {
      chrome.contextMenus.create({ id: "conteiner:" + c.id, parentId: "conteiner", title: c.nome, contexts: ["link"] });
    }
  }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    if (info.menuItemId === "ie-pagina") await abrirNoModoIE(info.frameUrl || info.pageUrl || tab.url);
    else if (info.menuItemId === "ie-link") await abrirNoModoIE(info.linkUrl);
    else if (String(info.menuItemId).startsWith("conteiner:")) {
      await abrirEmConteiner(String(info.menuItemId).slice(10), info.linkUrl);
    }
  } catch (e) {
    chrome.notifications.create({
      type: "basic",
      iconUrl: chrome.runtime.getURL("icones/icone-128.png"),
      title: "Não foi possível",
      message: e.message
    });
  }
});

chrome.storage.onChanged.addListener((mud, area) => {
  if (area === "local" && (mud.conteineres || mud.identidadeConteiner)) criarMenus();
  if (area === "local" && mud.nivelProtecao) aplicarNivel(mud.nivelProtecao.newValue);
});

// ---------- mensagens das páginas (popup, painel, nova aba, alerta) ----------
const acoes = {
  async estadoAba({ tabId, url }) {
    const host = hostDe(url);
    const web = /^https?:/i.test(url);
    return {
      host,
      web,
      protegido: web ? await siteProtegido(host) : true,
      nivel: await ler("nivelProtecao"),
      bloqueios: web ? await bloqueiosDaAba(tabId) : { total: 0, porCategoria: {} },
      analise: web ? analisar(url) : { nivel: "ok", motivos: [] },
      sempreIE: web ? await siteSempreNoIE(host) : false,
      conteinerDoSite: web ? await conteinerDoSite(host) : null,
      conteineres: await ler("conteineres"),
      identidade: await identidade(),
      seguro: url.startsWith("https:")
    };
  },
  alternarSite: ({ host }) => alternarSite(host),
  definirNivel: async ({ nivel }) => { await gravar({ nivelProtecao: nivel }); await aplicarNivel(nivel); return true; },
  abrirIE: ({ url }) => abrirNoModoIE(url),
  alternarSempreNoIE: ({ host }) => alternarSempreNoIE(host),
  abrirConteiner: ({ id, url }) => abrirEmConteiner(id, url),
  definirConteinerDoSite: ({ host, id }) => definirConteinerDoSite(host, id),
  async criarConteiner({ nome, cor }) {
    const conteineres = await ler("conteineres");
    const c = { id: novoIdConteiner(nome), nome: nome.trim().slice(0, 40), cor };
    await gravar({ conteineres: [...conteineres, c] });
    return c;
  },
  async removerConteiner({ id }) {
    await gravar({
      conteineres: (await ler("conteineres")).filter((c) => c.id !== id),
      regrasConteiner: (await ler("regrasConteiner")).filter((r) => r.conteiner !== id)
    });
    return true;
  },
  async definirIdentidade({ conteiner }) {
    await chrome.storage.local.set({ identidadeConteiner: conteiner });
    return true;
  },
  liberarSite: ({ host, minutos }) => liberarTemporariamente(host, minutos),
  atualizarListas: () => atualizarListas(),
  async infoListas() {
    const { listasGolpe = { hosts: [], urls: [] } } = await chrome.storage.local.get("listasGolpe");
    return { hosts: listasGolpe.hosts.length, urls: listasGolpe.urls.length, quando: listasGolpe.quando || null };
  },
  ajudante: () => ajudanteDisponivel(),
  verificarAtualizacaoNavegador: () => nativo({ comando: "verificarAtualizacao" }, 60000),
  async instalarAtualizacaoNavegador({ agora }) {
    const r = await nativo({ comando: "instalarAtualizacao", agora: !!agora }, 300000);
    if (r.reiniciando) {
      // o ajudante espera o navegador fechar, instala e abre de novo
      setTimeout(async () => {
        for (const janela of await chrome.windows.getAll()) chrome.windows.remove(janela.id).catch(() => {});
      }, 1500);
    }
    return r;
  },
  extensoes: () => extensoesDaLoja(),
  async instalarDaLoja({ texto }) {
    const id = idDaLoja(texto);
    if (!id) throw new Error("Não encontrei o código da extensão. Cole o endereço da página dela na Chrome Web Store.");
    await instalarDaLoja(id);
    return id;
  },
  verificarAtualizacoesExtensoes: () => verificarAtualizacoesDaLoja(),
  async alternarExtensao({ id, ativa }) { await chrome.management.setEnabled(id, ativa); return true; },
  async removerExtensao({ id }) { await chrome.management.uninstall(id, { showConfirmDialog: true }); return true; }
};

chrome.runtime.onMessage.addListener((msg, remetente, responder) => {
  // só aceitamos pedidos das próprias páginas do Núcleo ou do script da loja
  if (remetente.id !== chrome.runtime.id) return false;
  const acao = acoes[msg && msg.tipo];
  if (!acao) return false;
  if (remetente.tab && !remetente.url.startsWith(chrome.runtime.getURL("")) && msg.tipo !== "instalarDaLoja") return false;
  Promise.resolve()
    .then(() => acao(msg))
    .then((dados) => responder({ ok: true, dados }))
    .catch((e) => responder({ ok: false, erro: e.message || String(e) }));
  return true;
});
