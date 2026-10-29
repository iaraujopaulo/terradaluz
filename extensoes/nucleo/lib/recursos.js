// Modo Internet Explorer, contêineres e central de extensões da Chrome Web Store.
import { ler, gravar, hostDe, hostCorresponde, dominioPrincipal } from "./config.js";
import { nativo } from "./nativo.js";

// ================= Modo Internet Explorer =================
export async function abrirNoModoIE(url) {
  if (!/^https?:|^file:/i.test(url)) throw new Error("Este endereço não pode ser aberto no modo Internet Explorer.");
  return nativo({ comando: "abrirIE", url });
}

export async function siteSempreNoIE(host) {
  const sites = await ler("sitesModoIE");
  return sites.some((s) => hostCorresponde(host, s));
}

export async function alternarSempreNoIE(host) {
  const dominio = host.replace(/^www\./, "");
  let sites = await ler("sitesModoIE");
  const tinha = sites.some((s) => hostCorresponde(host, s));
  sites = tinha ? sites.filter((s) => !hostCorresponde(host, s)) : [...sites, dominio];
  await gravar({ sitesModoIE: sites });
  return !tinha;
}

// ================= Contêineres =================
// Cada contêiner é um perfil separado do navegador: cookies, logins, cache e
// armazenamento ficam totalmente isolados dos outros contêineres.
export async function identidade() {
  const { identidadeConteiner = null } = await chrome.storage.local.get("identidadeConteiner");
  return identidadeConteiner;
}

export async function abrirEmConteiner(idConteiner, url) {
  const conteineres = await ler("conteineres");
  const c = conteineres.find((x) => x.id === idConteiner);
  if (!c) throw new Error("Contêiner não encontrado.");
  return nativo({ comando: "abrirConteiner", conteiner: c, url: url || "" });
}

export async function conteinerDoSite(host) {
  const regras = await ler("regrasConteiner");
  const r = regras.find((x) => hostCorresponde(host, x.host));
  return r ? r.conteiner : null;
}

export async function definirConteinerDoSite(host, idConteiner) {
  const dominio = dominioPrincipal(host);
  let regras = (await ler("regrasConteiner")).filter((r) => r.host !== dominio);
  if (idConteiner) regras.push({ host: dominio, conteiner: idConteiner });
  await gravar({ regrasConteiner: regras });
}

export function novoIdConteiner(nome) {
  const base = nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return (base || "conteiner") + "-" + Math.random().toString(36).slice(2, 6);
}

// ================= Central de extensões =================
export function idDaLoja(texto) {
  texto = (texto || "").trim();
  const m = texto.match(/([a-p]{32})/);
  return m ? m[1] : null;
}

function versaoNavegador() {
  const m = navigator.userAgent.match(/Chrome\/([\d.]+)/);
  return m ? m[1] : "156.0.0.0";
}

export function urlDownloadDaLoja(id) {
  const x = encodeURIComponent(`id=${id}&installsource=ondemand&uc`);
  return `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=${versaoNavegador()}&acceptformat=crx2,crx3&x=${x}`;
}

export async function instalarDaLoja(id) {
  // O navegador mostra a confirmação de instalação de sempre (permissões etc.).
  await chrome.tabs.create({ url: urlDownloadDaLoja(id), active: true });
}

function compararVersoes(a, b) {
  const pa = a.split(".").map(Number), pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

export async function extensoesDaLoja() {
  const todas = await chrome.management.getAll();
  return todas.filter((e) => e.type === "extension" || e.type === "theme").map((e) => ({
    id: e.id,
    nome: e.name,
    versao: e.version,
    ativa: e.enabled,
    descricao: e.description,
    icone: (e.icons || []).sort((a, b) => b.size - a.size)[0]?.url || "",
    opcoes: e.optionsUrl || "",
    daLoja: /google\.com\/service\/update2/.test(e.updateUrl || ""),
    embutida: e.installType === "admin",
    podeRemover: e.mayDisable !== false && e.installType !== "admin"
  }));
}

export async function verificarAtualizacoesDaLoja() {
  const lista = (await extensoesDaLoja()).filter((e) => e.daLoja);
  if (!lista.length) return [];
  const params = lista
    .map((e) => "x=" + encodeURIComponent(`id=${e.id}&v=${e.versao}&uc`))
    .join("&");
  const url = `https://clients2.google.com/service/update2/crx?response=updatecheck&prodversion=${versaoNavegador()}&acceptformat=crx2,crx3&${params}`;
  const r = await fetch(url, { credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store" });
  const xml = await r.text();
  const resultado = [];
  for (const m of xml.matchAll(/<app[^>]*appid="([a-p]{32})"[^>]*>([\s\S]*?)<\/app>/g)) {
    const id = m[1];
    const v = m[2].match(/<updatecheck[^>]*version="([^"]+)"/);
    const atual = lista.find((e) => e.id === id);
    if (v && atual && compararVersoes(v[1], atual.versao) > 0) {
      resultado.push({ id, nome: atual.nome, de: atual.versao, para: v[1] });
    }
  }
  await chrome.storage.local.set({ atualizacoesExtensoes: { quando: Date.now(), lista: resultado } });
  return resultado;
}
