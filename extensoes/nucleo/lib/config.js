// Configurações do Núcleo do Terra da Luz, guardadas em chrome.storage.local.
// Tudo aqui fica no computador da pessoa; nada é enviado para fora.

export const HOST_NATIVO = "br.terradaluz.ajudante";

export const BUSCADORES = {
  duckduckgo: { nome: "DuckDuckGo", url: "https://duckduckgo.com/?q=%s", sugestoes: false },
  startpage: { nome: "Startpage", url: "https://www.startpage.com/do/search?q=%s", sugestoes: false },
  brave: { nome: "Brave Search", url: "https://search.brave.com/search?q=%s", sugestoes: false },
  mojeek: { nome: "Mojeek", url: "https://www.mojeek.com/search?q=%s", sugestoes: false },
  google: { nome: "Google", url: "https://www.google.com/search?q=%s", sugestoes: false }
};

export const PADRAO = {
  // Proteção
  nivelProtecao: "padrao", // "padrao" | "estrita" | "desligada"
  sitesSemProtecao: [], // domínios em que a pessoa desligou o escudo
  antiGolpe: true,
  listasAntiGolpe: true, // baixar listas públicas de golpes (URLhaus/OpenPhish) uma vez por dia
  bloquearDownloadsPerigosos: true,
  excecoesGolpe: [], // { host, ate } liberações temporárias feitas pela pessoa
  // Modo IE
  sitesModoIE: [], // domínios que sempre abrem no modo Internet Explorer
  // Contêineres
  conteineres: [
    { id: "trabalho", nome: "Trabalho", cor: "#2EC4C9" },
    { id: "banco", nome: "Banco", cor: "#F69C4A" },
    { id: "compras", nome: "Compras", cor: "#B07CF2" }
  ],
  regrasConteiner: [], // { host, conteiner }
  // Extensões da Chrome Web Store
  verificarAtualizacoesExtensoes: false, // só liga com permissão da pessoa
  // Nova aba
  buscador: "duckduckgo",
  atalhos: [],
  mostrarSitesMaisVisitados: true,
  nomePessoa: "",
  // Estatísticas locais (nunca saem do computador)
  estatisticas: { dia: "", rastreadores: 0, impressao: 0, cripto: 0, social: 0, golpes: 0, total: 0 }
};

export async function ler(chaves) {
  const lista = Array.isArray(chaves) ? chaves : chaves ? [chaves] : Object.keys(PADRAO);
  const padroes = {};
  for (const k of lista) padroes[k] = PADRAO[k];
  const r = await chrome.storage.local.get(padroes);
  return Array.isArray(chaves) || !chaves ? r : r[chaves];
}

export function gravar(obj) {
  return chrome.storage.local.set(obj);
}

// Domínio "principal" aproximado (eTLD+1) sem baixar a Public Suffix List inteira.
const SUFIXOS_DUPLOS = new Set([
  "com.br", "gov.br", "org.br", "net.br", "edu.br", "jus.br", "leg.br", "mp.br", "art.br", "blog.br",
  "eco.br", "emp.br", "ind.br", "inf.br", "app.br", "dev.br", "log.br", "tec.br", "nom.br",
  "co.uk", "org.uk", "gov.uk", "ac.uk", "com.au", "net.au", "org.au", "co.jp", "com.ar", "com.mx",
  "com.pt", "gov.pt", "co.nz", "com.co", "com.cn", "co.in", "co.za", "github.io", "blogspot.com",
  "appspot.com", "web.app", "pages.dev", "netlify.app", "vercel.app", "herokuapp.com", "firebaseapp.com"
]);

export function dominioPrincipal(host) {
  host = (host || "").toLowerCase().replace(/\.$/, "");
  if (/^[\d.]+$/.test(host) || host.includes(":")) return host;
  const p = host.split(".");
  if (p.length <= 2) return host;
  const ult2 = p.slice(-2).join(".");
  if (SUFIXOS_DUPLOS.has(ult2)) return p.slice(-3).join(".");
  return ult2;
}

export function hostDe(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function hostCorresponde(host, padrao) {
  host = host.toLowerCase();
  padrao = padrao.toLowerCase().replace(/^\*\./, "");
  return host === padrao || host.endsWith("." + padrao);
}

export function hoje() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
