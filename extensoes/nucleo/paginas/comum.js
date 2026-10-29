// Utilidades compartilhadas pelas páginas do Núcleo.
export async function enviar(tipo, dados = {}) {
  const r = await chrome.runtime.sendMessage({ tipo, ...dados });
  if (!r) throw new Error("Sem resposta do Núcleo.");
  if (!r.ok) throw new Error(r.erro);
  return r.dados;
}

export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

export function el(tag, attrs = {}, ...filhos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (k === "style" && typeof v === "object") Object.assign(e.style, v);
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const f of filhos.flat()) {
    if (f === null || f === undefined || f === false) continue;
    e.append(f instanceof Node ? f : document.createTextNode(String(f)));
  }
  return e;
}

let temporizador;
export function avisar(texto) {
  let a = document.querySelector(".aviso-flutuante");
  if (!a) {
    a = el("div", { class: "aviso-flutuante", role: "status", "aria-live": "polite" });
    document.body.append(a);
  }
  a.textContent = texto;
  a.classList.add("visivel");
  clearTimeout(temporizador);
  temporizador = setTimeout(() => a.classList.remove("visivel"), 3200);
}

export function formatarNumero(n) {
  return new Intl.NumberFormat("pt-BR").format(n || 0);
}

export function iconeSite(url, tamanho = 32) {
  const u = new URL(chrome.runtime.getURL("/_favicon/"));
  u.searchParams.set("pageUrl", url);
  u.searchParams.set("size", String(tamanho));
  return u.toString();
}
