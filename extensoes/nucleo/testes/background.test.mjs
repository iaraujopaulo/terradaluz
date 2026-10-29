// Teste do processo de fundo do Núcleo com uma imitação mínima das APIs do
// navegador. Rode com:  node extensoes/nucleo/testes/background.test.mjs
import assert from "node:assert/strict";

const eventos = () => {
  const ouvintes = [];
  return { addListener: (f) => ouvintes.push(f), disparar: (...a) => Promise.all(ouvintes.map((f) => f(...a))) };
};
const armazem = () => {
  let dados = {};
  return {
    async get(chaves) {
      if (chaves === null || chaves === undefined) return structuredClone(dados);
      if (typeof chaves === "string") return chaves in dados ? { [chaves]: structuredClone(dados[chaves]) } : {};
      if (Array.isArray(chaves)) return Object.fromEntries(chaves.filter((k) => k in dados).map((k) => [k, structuredClone(dados[k])]));
      return Object.fromEntries(Object.entries(chaves).map(([k, v]) => [k, k in dados ? structuredClone(dados[k]) : v]));
    },
    async set(obj) { dados = { ...dados, ...structuredClone(obj) }; },
    _dados: () => dados
  };
};

const registro = { abasAtualizadas: [], regrasDinamicas: [], scripts: [], nativo: [], menus: [] };
globalThis.chrome = {
  runtime: {
    id: "hemloehddnlobmafgeeelgobmlfndnkj",
    onInstalled: eventos(), onStartup: eventos(), onMessage: eventos(),
    getURL: (p) => "chrome-extension://hemloehddnlobmafgeeelgobmlfndnkj/" + p.replace(/^\//, ""),
    getManifest: () => ({ version: "1.0.0" }),
    lastError: null,
    sendNativeMessage(host, msg, cb) {
      registro.nativo.push(msg);
      setTimeout(() => cb({ ok: true, versao: "teste", modoIE: true }), 1);
    }
  },
  storage: { local: armazem(), session: armazem(), onChanged: eventos() },
  alarms: { create() {}, onAlarm: eventos() },
  declarativeNetRequest: {
    async updateEnabledRulesets() {},
    async getDynamicRules() { return registro.regrasDinamicas; },
    async updateDynamicRules({ removeRuleIds, addRules }) {
      registro.regrasDinamicas = registro.regrasDinamicas.filter((r) => !removeRuleIds.includes(r.id)).concat(addRules);
    },
    async setExtensionActionOptions() {},
    async getMatchedRules() { return { rulesMatchedInfo: [{ rule: { rulesetId: "rastreadores", ruleId: 1 } }, { rule: { rulesetId: "rastreadores", ruleId: 4 } }] }; }
  },
  scripting: {
    async getRegisteredContentScripts() { return registro.scripts; },
    async registerContentScripts(s) { registro.scripts.push(...s); },
    async unregisterContentScripts() { registro.scripts = []; }
  },
  action: { async setBadgeBackgroundColor() {} },
  webNavigation: { onBeforeNavigate: eventos() },
  downloads: { onCreated: eventos(), cancel() {}, pause() {} },
  contextMenus: { async removeAll() { registro.menus = []; }, create(m) { registro.menus.push(m.id); }, onClicked: eventos() },
  notifications: { create() {}, onClicked: eventos(), onButtonClicked: eventos() },
  tabs: {
    update(id, p) { registro.abasAtualizadas.push(p.url); return Promise.resolve(); },
    async get(id) { return { id, windowId: 1 }; },
    async query() { return [{ id: 1 }, { id: 2 }]; },
    remove() {}, async create() {}
  },
  management: { async getAll() { return []; } },
  windows: { async getAll() { return []; } }
};
globalThis.fetch = async () => ({ ok: true, text: async () => "# lista\n127.0.0.1 malware-teste.example\n" });

await import("../background.js");
const espera = (ms = 20) => new Promise((r) => setTimeout(r, ms));

// instalação: grava padrões, liga regras, cria menus
await chrome.runtime.onInstalled.disparar({ reason: "install" });
await espera(50);
const local = chrome.storage.local._dados();
assert.equal(local.nivelProtecao, "padrao");
assert.ok(local.listasGolpe.hosts.includes("malware-teste.example"), "lista de golpes baixada");
assert.ok(registro.menus.includes("ie-pagina"), "menu do modo IE criado");
assert.ok(registro.menus.includes("conteiner:banco"), "menu de contêineres criado");

// mensagem de outra extensão é ignorada
function enviar(msg, remetente = { id: chrome.runtime.id, url: chrome.runtime.getURL("paginas/popup.html") }) {
  return new Promise((resolve) => {
    let respondeu = false;
    chrome.runtime.onMessage.disparar(msg, remetente, (r) => { respondeu = true; resolve(r); });
    setTimeout(() => { if (!respondeu) resolve(undefined); }, 100);
  });
}
assert.equal(await enviar({ tipo: "estadoAba" }, { id: "outra" }), undefined);

// estado da aba
let r = await enviar({ tipo: "estadoAba", tabId: 1, url: "https://www.itau.com.br/" });
assert.equal(r.ok, true, JSON.stringify(r));
assert.equal(r.dados.analise.nivel, "ok");
assert.equal(r.dados.protegido, true);

// desligar a proteção em um site cria a exceção
r = await enviar({ tipo: "alternarSite", host: "www.exemplo.com.br" });
assert.equal(r.dados.dominio, "exemplo.com.br");
assert.equal(registro.regrasDinamicas.length, 1);
assert.equal(registro.regrasDinamicas[0].action.type, "allowAllRequests");

// nível estrito registra o script de impressão digital
r = await enviar({ tipo: "definirNivel", nivel: "estrita" });
assert.equal(registro.scripts.length, 1);
assert.deepEqual(registro.scripts[0].excludeMatches, ["*://exemplo.com.br/*", "*://*.exemplo.com.br/*"]);

// navegação para golpe é desviada para o alerta
await chrome.webNavigation.onBeforeNavigate.disparar({ frameId: 0, tabId: 7, url: "https://caixa.gov.br.atualiza-cadastro.top/login" });
await espera(30);
assert.ok(registro.abasAtualizadas.some((u) => u.includes("paginas/alerta.html") && u.includes("nivel=perigoso")), "alerta exibido");

// site da lista de malware também
registro.abasAtualizadas = [];
await chrome.webNavigation.onBeforeNavigate.disparar({ frameId: 0, tabId: 8, url: "http://malware-teste.example/x.exe" });
await espera(30);
assert.ok(registro.abasAtualizadas.some((u) => u.includes("alerta.html")), "lista de malware respeitada");

// liberar temporariamente
await enviar({ tipo: "liberarSite", host: "malware-teste.example", minutos: 5 });
registro.abasAtualizadas = [];
await chrome.webNavigation.onBeforeNavigate.disparar({ frameId: 0, tabId: 8, url: "http://malware-teste.example/x.exe" });
await espera(30);
assert.equal(registro.abasAtualizadas.filter((u) => u.includes("alerta.html")).length, 0, "liberação respeitada");

// modo IE via ajudante
r = await enviar({ tipo: "abrirIE", url: "http://sistema.antigo.gov.br/" });
assert.equal(r.ok, true);
assert.equal(registro.nativo.at(-1).comando, "abrirIE");

// site sempre no modo IE: navegação abre o IE e mostra o aviso
await enviar({ tipo: "alternarSempreNoIE", host: "intranet.prefeitura.ce.gov.br" });
registro.abasAtualizadas = [];
await chrome.webNavigation.onBeforeNavigate.disparar({ frameId: 0, tabId: 9, url: "http://intranet.prefeitura.ce.gov.br/app" });
await espera(30);
assert.ok(registro.abasAtualizadas.some((u) => u.includes("modoie.html")), "aviso do modo IE");

// contêineres
r = await enviar({ tipo: "criarConteiner", nome: "Família Araújo", cor: "#E46FA8" });
assert.match(r.dados.id, /^familia-araujo-[a-z0-9]{4}$/);
r = await enviar({ tipo: "abrirConteiner", id: r.dados.id, url: "https://exemplo.com/" });
assert.equal(r.ok, true);
assert.equal(registro.nativo.at(-1).comando, "abrirConteiner");

// central de extensões
r = await enviar({ tipo: "instalarDaLoja", texto: "https://chromewebstore.google.com/detail/ublock-origin-lite/ddkjiahejlhfcafbddmgiahcphecmpfh" });
assert.equal(r.dados, "ddkjiahejlhfcafbddmgiahcphecmpfh");
r = await enviar({ tipo: "instalarDaLoja", texto: "qualquer coisa" });
assert.equal(r.ok, false);

// estatísticas
await chrome.alarms.onAlarm.disparar({ name: "coleta" });
await espera(30);
const est = chrome.storage.local._dados().estatisticas;
assert.equal(est.rastreadores, 1);
assert.equal(est.impressao, 1);

console.log("background: todos os testes passaram");
process.exit(0);
