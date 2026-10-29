// Análise de endereços contra golpes (phishing). Funções puras, sem APIs do
// navegador, para poderem ser testadas com Node (veja testes/analise.test.mjs).
import { MARCAS, PALAVRAS_RISCO, TLDS_RISCO } from "../dados/marcas.js";
import { dominioPrincipal, hostCorresponde } from "./config.js";

// ---------- Punycode (RFC 3492), só a decodificação ----------
const BASE = 36, TMIN = 1, TMAX = 26, SKEW = 38, DAMP = 700, INITIAL_BIAS = 72, INITIAL_N = 128;
function adapt(delta, numPoints, firstTime) {
  let k = 0;
  delta = firstTime ? Math.floor(delta / DAMP) : delta >> 1;
  delta += Math.floor(delta / numPoints);
  for (; delta > ((BASE - TMIN) * TMAX) >> 1; k += BASE) delta = Math.floor(delta / (BASE - TMIN));
  return Math.floor(k + ((BASE - TMIN + 1) * delta) / (delta + SKEW));
}
function digito(c) {
  if (c - 48 < 10) return c - 22;
  if (c - 65 < 26) return c - 65;
  if (c - 97 < 26) return c - 97;
  return BASE;
}
export function decodificarPunycode(rotulo) {
  if (!rotulo.startsWith("xn--")) return rotulo;
  const entrada = rotulo.slice(4);
  const saida = [];
  let n = INITIAL_N, i = 0, bias = INITIAL_BIAS;
  let basico = entrada.lastIndexOf("-");
  if (basico < 0) basico = 0;
  for (let j = 0; j < basico; j++) saida.push(entrada.charCodeAt(j));
  for (let idx = basico > 0 ? basico + 1 : 0; idx < entrada.length; ) {
    const oldi = i;
    for (let w = 1, k = BASE; ; k += BASE) {
      if (idx >= entrada.length) return rotulo;
      const d = digito(entrada.charCodeAt(idx++));
      if (d >= BASE) return rotulo;
      i += d * w;
      const t = k <= bias ? TMIN : k >= bias + TMAX ? TMAX : k - bias;
      if (d < t) break;
      w *= BASE - t;
    }
    const out = saida.length + 1;
    bias = adapt(i - oldi, out, oldi === 0);
    n += Math.floor(i / out);
    i %= out;
    saida.splice(i++, 0, n);
  }
  return String.fromCodePoint(...saida);
}

// ---------- caracteres parecidos ----------
const PARECIDOS = {
  "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "у": "y", "х": "x", "і": "i", "ј": "j", "ѕ": "s",
  "ԁ": "d", "ɡ": "g", "һ": "h", "ӏ": "l", "ո": "n", "ս": "u", "ν": "v", "ο": "o", "α": "a", "τ": "t",
  "ı": "i", "ł": "l", "ø": "o", "á": "a", "à": "a", "â": "a", "ã": "a", "é": "e", "ê": "e", "í": "i",
  "ó": "o", "ô": "o", "õ": "o", "ú": "u", "ü": "u", "ç": "c", "ñ": "n"
};
export function esqueleto(texto) {
  let s = [...texto.toLowerCase()].map((c) => PARECIDOS[c] || c).join("");
  s = s.replace(/rn/g, "m").replace(/vv/g, "w").replace(/cl/g, "d");
  s = s.replace(/0/g, "o").replace(/1/g, "l").replace(/3/g, "e").replace(/4/g, "a").replace(/5/g, "s").replace(/7/g, "t").replace(/\$/g, "s");
  return s.replace(/l/g, "i"); // l e i se confundem: comparamos os dois como "i"
}

export function distancia(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 99;
  const v = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let anterior = v[0];
    v[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = v[j];
      v[j] = Math.min(v[j] + 1, v[j - 1] + 1, anterior + (a[i - 1] === b[j - 1] ? 0 : 1));
      anterior = tmp;
    }
  }
  return v[b.length];
}

function misturaEscritas(texto) {
  const latino = /[a-z]/i.test(texto);
  const outros = /[Ͱ-ϿЀ-ӿ԰-֏]/.test(texto);
  return latino && outros;
}

function ehOficial(host, marca) {
  if (marca.aceitaSufixo && (host.endsWith(marca.aceitaSufixo) || host === marca.aceitaSufixo.slice(1))) return true;
  return marca.oficiais.some((o) => hostCorresponde(host, o));
}

/**
 * Analisa um endereço.
 * @param {string} endereco
 * @param {{hostsPerigosos?: Set<string>, urlsPerigosas?: Set<string>}} listas
 * @returns {{nivel: "ok"|"suspeito"|"perigoso", motivos: string[], marca?: string}}
 */
export function analisarEndereco(endereco, listas = {}) {
  let u;
  try {
    u = new URL(endereco);
  } catch {
    return { nivel: "ok", motivos: [] };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return { nivel: "ok", motivos: [] };
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  const motivos = [];
  let nivel = "ok";
  let marcaImitada;
  const subir = (n) => {
    if (n === "perigoso" || (n === "suspeito" && nivel === "ok")) nivel = n;
  };

  // 1) listas públicas de golpes e malware
  const hostsPerigosos = listas.hostsPerigosos;
  if (hostsPerigosos && hostsPerigosos.size) {
    const partes = host.split(".");
    for (let i = 0; i < partes.length - 1; i++) {
      if (hostsPerigosos.has(partes.slice(i).join("."))) {
        subir("perigoso");
        motivos.push("Este endereço está em uma lista pública de sites de golpe ou de vírus.");
        break;
      }
    }
  }
  if (listas.urlsPerigosas && listas.urlsPerigosas.size) {
    const semFrag = (u.origin + u.pathname + u.search).toLowerCase();
    if (listas.urlsPerigosas.has(semFrag) || listas.urlsPerigosas.has(semFrag.replace(/\/$/, ""))) {
      subir("perigoso");
      motivos.push("Esta página foi denunciada como golpe (phishing).");
    }
  }

  // 2) endereço com "@" que esconde o destino real
  if (u.username) {
    subir("suspeito");
    motivos.push(`O endereço usa "${u.username}@" para disfarçar o site verdadeiro, que é ${host}.`);
  }

  // 3) letras de outros alfabetos disfarçadas (ex.: "а" cirílico no lugar de "a")
  const rotulos = host.split(".");
  const decodificado = rotulos.map(decodificarPunycode).join(".");
  if (decodificado !== host) {
    if (misturaEscritas(decodificado)) {
      subir("suspeito");
      motivos.push(`O endereço mistura letras de alfabetos diferentes: ${decodificado}`);
    }
  }

  // 4) imitação de marcas conhecidas
  const dp = dominioPrincipal(host);
  const rotuloPrincipal = decodificarPunycode(dp.split(".")[0]);
  const tokens = decodificado.split(/[.\-_]+/).filter(Boolean);
  const tokensEsq = tokens.map(esqueleto);
  const temPalavraRisco =
    tokens.some((t) => PALAVRAS_RISCO.some((p) => t === p || (t.length > 6 && t.includes(p)))) ||
    PALAVRAS_RISCO.some((p) => u.pathname.toLowerCase().includes(p));
  const tld = rotulos[rotulos.length - 1];
  const tldRisco = TLDS_RISCO.includes(tld);

  // gov.br falso: "gov.br" no meio do endereço, mas o site não termina em .gov.br
  if (/(^|[.\-])gov[.\-]?br([.\-]|$)/.test(decodificado) && !(host === "gov.br" || host.endsWith(".gov.br"))) {
    subir("perigoso");
    motivos.push("O endereço finge ser do governo (gov.br), mas não é um site oficial .gov.br.");
    marcaImitada = "gov.br";
  }

  for (const marca of MARCAS) {
    if (marca.soGovBr) continue;
    if (ehOficial(host, marca)) continue;
    const termoEsq = esqueleto(marca.termo);
    const aparece = tokensEsq.includes(termoEsq) || tokens.includes(marca.termo);
    // domínio oficial "pendurado" no início de outro: itau.com.br.seguro.xyz
    const oficialDentro = marca.oficiais.some((o) => o.includes(".") && decodificado.startsWith(o + ".") );
    if (oficialDentro) {
      subir("perigoso");
      motivos.push(`O endereço começa com "${marca.oficiais.find((o) => decodificado.startsWith(o + "."))}", mas o site verdadeiro é ${dp}.`);
      marcaImitada = marca.termo;
      continue;
    }
    if (aparece) {
      const disfarcado = !tokens.includes(marca.termo); // ex.: "paypa1" no lugar de "paypal"
      if (disfarcado || temPalavraRisco || tldRisco || (!marca.soComRisco && decodificado !== host)) {
        subir("suspeito");
        motivos.push(`Usa o nome "${marca.termo}" mas não é um endereço oficial (${marca.oficiais[0]}).`);
        marcaImitada = marca.termo;
      }
      continue;
    }
    // erro de digitação proposital: bradescco, nubamk, paypa1...
    if (marca.termo.length >= 5 && !marca.soComRisco) {
      const bruto = rotuloPrincipal.toLowerCase().replace(/-/g, "");
      const r = esqueleto(bruto);
      if (r.length >= 4) {
        const d = distancia(r, termoEsq);
        const limite = marca.termo.length >= 9 ? 2 : 1;
        // Letras trocadas por números/sósias (paypa1, nubamk) são sempre suspeitas.
        // Erros de digitação comuns (caixas, bradescco) só contam com outro sinal
        // de golpe, para não acusar sites legítimos de nomes parecidos.
        const sosia = d === 0 && bruto !== marca.termo;
        const digitacao = d > 0 && d <= limite && (temPalavraRisco || tldRisco);
        if (sosia || digitacao) {
          subir("suspeito");
          motivos.push(`O nome "${rotuloPrincipal}" é muito parecido com "${marca.termo}", mas não é o site oficial.`);
          marcaImitada = marca.termo;
        }
      }
    }
  }

  // 5) página de login em endereço numérico sem cadeado
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) && u.protocol === "http:" && temPalavraRisco) {
    subir("suspeito");
    motivos.push("Página de acesso em um endereço numérico e sem conexão segura.");
  }

  return { nivel, motivos, marca: marcaImitada };
}
