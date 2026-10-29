// Escudo do Terra da Luz: níveis de proteção no estilo da Proteção Aprimorada
// contra Rastreamento do Firefox, sobre o motor de bloqueio nativo do
// Chromium (declarativeNetRequest, executado em C++ dentro do navegador).
import { ler, gravar, dominioPrincipal } from "./config.js";

const ID_BASE_EXCECAO = 10000;
const SCRIPT_ESTRITO = "terra-impressao-estrita";

export async function aplicarNivel(nivel) {
  nivel = nivel || (await ler("nivelProtecao"));
  const ligar = nivel === "desligada" ? [] : ["rastreadores", "parametros"];
  const desligar = nivel === "desligada" ? ["rastreadores", "parametros"] : [];
  await chrome.declarativeNetRequest.updateEnabledRulesets({ enableRulesetIds: ligar, disableRulesetIds: desligar });

  const registrados = await chrome.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ESTRITO] });
  if (nivel === "estrita" && registrados.length === 0) {
    await chrome.scripting.registerContentScripts([{
      id: SCRIPT_ESTRITO,
      js: ["conteudo/impressao.js"],
      matches: ["<all_urls>"],
      allFrames: true,
      matchOriginAsFallback: true,
      runAt: "document_start",
      world: "MAIN",
      excludeMatches: await padroesExcluidos()
    }]);
  } else if (nivel !== "estrita" && registrados.length) {
    await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ESTRITO] });
  }
  await chrome.action.setBadgeBackgroundColor({ color: nivel === "desligada" ? "#8A8F98" : "#0A4F7A" });
  await chrome.declarativeNetRequest.setExtensionActionOptions({ displayActionCountAsBadgeText: nivel !== "desligada" });
}

async function padroesExcluidos() {
  const sites = await ler("sitesSemProtecao");
  return sites.flatMap((d) => [`*://${d}/*`, `*://*.${d}/*`]);
}

// Exceções por site (o site continua com o antigolpe, só sai o bloqueio de rastreadores)
export async function sincronizarExcecoes() {
  const sites = await ler("sitesSemProtecao");
  const atuais = await chrome.declarativeNetRequest.getDynamicRules();
  const remover = atuais.filter((r) => r.id >= ID_BASE_EXCECAO).map((r) => r.id);
  const adicionar = sites.map((dominio, i) => ({
    id: ID_BASE_EXCECAO + i,
    priority: 100,
    action: { type: "allowAllRequests" },
    condition: { requestDomains: [dominio], resourceTypes: ["main_frame", "sub_frame"] }
  }));
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: remover, addRules: adicionar });
  // o script estrito também respeita as exceções
  if ((await ler("nivelProtecao")) === "estrita") {
    await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ESTRITO] }).catch(() => {});
    await aplicarNivel("estrita");
  }
}

export async function alternarSite(host) {
  const dominio = dominioPrincipal(host);
  let sites = await ler("sitesSemProtecao");
  const desligado = sites.includes(dominio);
  sites = desligado ? sites.filter((s) => s !== dominio) : [...sites, dominio];
  await gravar({ sitesSemProtecao: sites });
  await sincronizarExcecoes();
  return { dominio, protegido: desligado };
}

export async function siteProtegido(host) {
  const sites = await ler("sitesSemProtecao");
  return !sites.includes(dominioPrincipal(host));
}
