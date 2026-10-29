import { $, el, formatarNumero, iconeSite } from "./comum.js";
import { BUSCADORES, ler, gravar, hoje } from "../lib/config.js";

// ---------- relógio e saudação ----------
async function relogio() {
  const agora = new Date();
  $("#relogio").textContent = agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const h = agora.getHours();
  const parte = h < 5 ? "Boa noite" : h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  const nome = await ler("nomePessoa");
  $("#saudacao").textContent = nome ? `${parte}, ${nome}` : parte;
}
relogio();
setInterval(relogio, 15000);

// ---------- busca ----------
let buscadorAtual = "duckduckgo";
async function prepararBusca() {
  buscadorAtual = (await ler("buscador")) || "duckduckgo";
  if (!BUSCADORES[buscadorAtual]) buscadorAtual = "duckduckgo";
  $("#nomeBuscador").textContent = BUSCADORES[buscadorAtual].nome;
  const lista = $("#listaBuscadores");
  lista.replaceChildren(
    ...Object.entries(BUSCADORES).map(([id, b]) =>
      el("li", {
        role: "option",
        "aria-selected": String(id === buscadorAtual),
        onclick: async () => {
          buscadorAtual = id;
          await gravar({ buscador: id });
          $("#nomeBuscador").textContent = b.nome;
          lista.classList.add("oculto");
          prepararBusca();
          $("#termo").focus();
        }
      }, b.nome, id === "duckduckgo" ? el("small", {}, "privado") : id === "google" ? el("small", {}, "rastreia") : null)
    )
  );
}
$("#trocarBuscador").addEventListener("click", (ev) => {
  ev.stopPropagation();
  $("#listaBuscadores").classList.toggle("oculto");
});
document.addEventListener("click", () => $("#listaBuscadores").classList.add("oculto"));

function pareceEndereco(texto) {
  if (/\s/.test(texto)) return false;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(texto)) return true;
  return /^(localhost|[\w-]+(\.[\w-]+)+)(:\d+)?(\/.*)?$/i.test(texto);
}

$("#busca").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const texto = $("#termo").value.trim();
  if (!texto) return;
  let destino;
  if (pareceEndereco(texto)) destino = /^[a-z][a-z0-9+.-]*:\/\//i.test(texto) ? texto : "https://" + texto;
  else destino = BUSCADORES[buscadorAtual].url.replace("%s", encodeURIComponent(texto));
  location.href = destino;
});
prepararBusca();

// ---------- atalhos ----------
async function desenharAtalhos() {
  const [atalhos, mostrarMais] = [await ler("atalhos"), await ler("mostrarSitesMaisVisitados")];
  let itens = atalhos.map((a) => ({ ...a, proprio: true }));
  if (mostrarMais && itens.length < 8) {
    try {
      const top = await chrome.topSites.get();
      for (const t of top) {
        if (itens.length >= 8) break;
        if (!itens.some((i) => i.url === t.url)) itens.push({ nome: t.title || new URL(t.url).hostname, url: t.url });
      }
    } catch {}
  }
  const grade = $("#atalhos");
  grade.replaceChildren(
    ...itens.map((item) => {
      const host = (() => { try { return new URL(item.url).hostname.replace(/^www\./, ""); } catch { return item.url; } })();
      return el("a", { class: "atalho", href: item.url, title: item.url },
        el("div", { class: "icone" }, el("img", { src: iconeSite(item.url, 32), alt: "" })),
        el("span", {}, item.nome || host),
        item.proprio ? el("button", {
          class: "remover", title: "Remover atalho", "aria-label": `Remover ${item.nome}`,
          onclick: async (ev) => {
            ev.preventDefault();
            await gravar({ atalhos: (await ler("atalhos")).filter((a) => a.url !== item.url) });
            desenharAtalhos();
          }
        }, "×") : null
      );
    }),
    itens.length < 12 ? el("button", { class: "atalho novo", onclick: () => $("#dialogoAtalho").showModal() },
      el("div", { class: "icone" }, "+"), el("span", {}, "Adicionar")) : null
  );
}
$("#dialogoAtalho").addEventListener("close", async () => {
  const d = $("#dialogoAtalho");
  const f = $("#formAtalho");
  if (d.returnValue === "salvar") {
    let url = f.url.value.trim();
    if (!/^[a-z]+:\/\//i.test(url)) url = "https://" + url;
    try {
      new URL(url);
      await gravar({ atalhos: [...(await ler("atalhos")), { nome: f.nome.value.trim(), url }] });
      desenharAtalhos();
    } catch {}
  }
  f.reset();
});
desenharAtalhos();

// ---------- proteção de hoje ----------
async function protecao() {
  const e = await ler("estatisticas");
  const zero = e.dia !== hoje();
  $("#nRastreadores").textContent = formatarNumero(zero ? 0 : e.rastreadores + (e.cripto || 0));
  $("#nSocial").textContent = formatarNumero(zero ? 0 : e.social);
  $("#nImpressao").textContent = formatarNumero(zero ? 0 : e.impressao);
  $("#nGolpes").textContent = formatarNumero(zero ? 0 : e.golpes);
  const nivel = await ler("nivelProtecao");
  $("#nivelTexto").textContent = { padrao: "Nível padrão · antigolpe ativo", estrita: "Nível estrito · antigolpe ativo", desligada: "Bloqueio de rastreadores desligado" }[nivel];
}
protecao();
chrome.storage.onChanged.addListener((m) => { if (m.estatisticas || m.nivelProtecao) protecao(); });

// ---------- contêiner ----------
(async () => {
  const { identidadeConteiner } = await chrome.storage.local.get("identidadeConteiner");
  if (identidadeConteiner) {
    const chip = $("#chipConteiner");
    chip.classList.remove("oculto");
    chip.querySelector(".ponto").style.background = identidadeConteiner.cor;
    chip.lastElementChild.textContent = `Contêiner: ${identidadeConteiner.nome}`;
    document.title = `Nova aba — ${identidadeConteiner.nome}`;
  }
})();
