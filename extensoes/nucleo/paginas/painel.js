import { $, $$, el, enviar, avisar, formatarNumero } from "./comum.js";
import { ler, gravar, BUSCADORES } from "../lib/config.js";

const CORES = ["#2EC4C9", "#0A4F7A", "#F69C4A", "#FFB30F", "#D64545", "#1F9E6E", "#B07CF2", "#E46FA8"];

// ---------- navegação por seções ----------
function mostrarSecao() {
  const id = (location.hash || "#protecao").slice(1);
  const alvo = $("#sec-" + id) ? id : "protecao";
  $$(".secao").forEach((s) => s.classList.toggle("ativa", s.id === "sec-" + alvo));
  $$("#menu a").forEach((a) => { if (a.getAttribute("href") === "#" + alvo) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
  carregar[alvo]?.();
}
window.addEventListener("hashchange", mostrarSecao);

// ---------- opções simples ligadas ao armazenamento ----------
$("#selBuscador").append(...Object.entries(BUSCADORES).map(([id, b]) => el("option", { value: id }, b.nome)));
for (const campo of $$("[data-config]")) {
  const chave = campo.dataset.config;
  const valor = await ler(chave);
  if (campo.type === "checkbox") campo.checked = !!valor;
  else campo.value = valor ?? "";
  campo.addEventListener("change", async () => {
    await gravar({ [chave]: campo.type === "checkbox" ? campo.checked : campo.value.trim() });
    avisar("Preferência salva");
  });
}

function itemVazio(texto) {
  return el("li", { class: "vazio" }, texto);
}

const carregar = {
  // ---------- proteção ----------
  async protecao() {
    const nivel = await ler("nivelProtecao");
    for (const r of $$('input[name="nivel"]')) {
      r.checked = r.value === nivel;
      r.onchange = async () => {
        await enviar("definirNivel", { nivel: r.value });
        avisar("Nível de proteção alterado");
      };
    }
    const sites = await ler("sitesSemProtecao");
    $("#sitesSemProtecao").replaceChildren(
      ...(sites.length ? sites.map((s) => el("li", {}, s, el("button", {
        class: "botao", onclick: async () => { await enviar("alternarSite", { host: s }); carregar.protecao(); }
      }, "Proteger de novo"))) : [itemVazio("Todos os sites estão protegidos.")])
    );
  },

  // ---------- antigolpe ----------
  async antigolpe() {
    const info = await enviar("infoListas");
    $("#infoListas").textContent = info.quando
      ? `${formatarNumero(info.hosts)} sites e ${formatarNumero(info.urls)} páginas de golpe conhecidos · atualizado em ${new Date(info.quando).toLocaleString("pt-BR")}`
      : "As listas ainda não foram baixadas.";
  },

  // ---------- contêineres ----------
  async conteineres() {
    const lista = await ler("conteineres");
    $("#listaConteineres").replaceChildren(...lista.map((c) =>
      el("div", { class: "cartao conteiner", style: { "--cor": c.cor } },
        el("span", { class: "ponto", style: { background: c.cor } }),
        el("strong", {}, c.nome),
        el("button", { class: "botao", onclick: () => enviar("abrirConteiner", { id: c.id, url: "" }).catch((e) => avisar(e.message)) }, "Abrir"),
        el("button", {
          class: "botao perigo", title: "Remover", "aria-label": `Remover ${c.nome}`,
          onclick: async () => {
            if (!confirm(`Remover o contêiner "${c.nome}" da lista? Os dados dele continuam guardados até você apagar o perfil nas configurações.`)) return;
            await enviar("removerConteiner", { id: c.id });
            carregar.conteineres();
          }
        }, "×")
      )
    ));
    const cores = $("#novoConteiner .cores");
    if (!cores.children.length) {
      cores.append(...CORES.map((cor, i) => el("label", { style: { background: cor }, title: cor },
        el("input", { type: "radio", name: "cor", value: cor, checked: i === 0, "aria-label": cor }))));
    }
    const regras = await ler("regrasConteiner");
    $("#regrasConteiner").replaceChildren(...(regras.length ? regras.map((r) => {
      const c = lista.find((x) => x.id === r.conteiner);
      return el("li", {}, el("span", {}, r.host, " → ", el("strong", {}, c ? c.nome : "?")),
        el("button", { class: "botao", onclick: async () => { await enviar("definirConteinerDoSite", { host: r.host, id: null }); carregar.conteineres(); } }, "Remover"));
    }) : [itemVazio("Nenhuma regra. Crie pelo ícone do Terra da Luz em qualquer site.")]));
  },

  // ---------- modo IE ----------
  async modoie() {
    const caixa = $("#statusAjudante");
    caixa.replaceChildren(el("span", { class: "mudo" }, "Verificando…"));
    const r = await enviar("ajudante");
    if (r.disponivel && r.modoIE) {
      caixa.replaceChildren(el("span", { class: "etiqueta ok" }, "Pronto"), `Modo Internet Explorer disponível (motor MSHTML ${r.versaoIE || "11"}).`);
    } else if (r.disponivel) {
      caixa.replaceChildren(el("span", { class: "etiqueta aviso" }, "Indisponível"), "O modo Internet Explorer existe apenas no Windows.");
    } else {
      caixa.replaceChildren(el("span", { class: "etiqueta perigo" }, "Erro"), r.erro);
    }
    const sites = await ler("sitesModoIE");
    $("#sitesIE").replaceChildren(...(sites.length ? sites.map((s) => el("li", {}, s,
      el("button", { class: "botao", onclick: async () => { await gravar({ sitesModoIE: (await ler("sitesModoIE")).filter((x) => x !== s) }); carregar.modoie(); } }, "Remover")
    )) : [itemVazio("Nenhum site configurado.")]));
  },

  // ---------- extensões ----------
  async extensoes() {
    const { atualizacoesExtensoes } = await chrome.storage.local.get("atualizacoesExtensoes");
    const pendentes = atualizacoesExtensoes?.lista || [];
    $("#infoAtualizacoesExt").textContent = atualizacoesExtensoes
      ? `Última verificação: ${new Date(atualizacoesExtensoes.quando).toLocaleString("pt-BR")} · ${pendentes.length} atualização(ões)`
      : "";
    const lista = (await enviar("extensoes")).filter((e) => e.id !== chrome.runtime.id);
    $("#listaExtensoes").replaceChildren(...lista.map((e) => {
      const pend = pendentes.find((p) => p.id === e.id);
      return el("div", { class: "cartao extensao" },
        el("img", { src: e.icone || "../icones/icone-48.png", alt: "" }),
        el("div", { class: "info" },
          el("strong", {}, e.nome),
          el("small", {}, `Versão ${e.versao} · ${e.descricao || ""}`),
          el("div", { class: "selos" },
            e.embutida ? el("span", { class: "etiqueta ok" }, "Embutida") : null,
            e.daLoja ? el("span", { class: "etiqueta" }, "Chrome Web Store") : null,
            pend ? el("span", { class: "etiqueta aviso" }, `Nova versão ${pend.para}`) : null)),
        el("div", { class: "acoes" },
          pend ? el("button", { class: "botao primario", onclick: () => enviar("instalarDaLoja", { texto: e.id }) }, "Atualizar") : null,
          e.opcoes ? el("a", { class: "botao", href: e.opcoes, target: "_blank" }, "Opções") : null,
          el("span", { class: "chave", title: e.ativa ? "Desativar" : "Ativar" },
            el("input", { type: "checkbox", checked: e.ativa, disabled: e.embutida, "aria-label": `Ativar ${e.nome}`,
              onchange: async (ev) => { await enviar("alternarExtensao", { id: e.id, ativa: ev.target.checked }); } }),
            el("span")),
          e.podeRemover ? el("button", { class: "botao perigo", onclick: async () => {
            try { await enviar("removerExtensao", { id: e.id }); carregar.extensoes(); } catch {}
          } }, "Remover") : null)
      );
    }));
  },

  // ---------- atualizações ----------
  async atualizacoes() {
    const ver = navigator.userAgent.match(/Chrome\/([\d.]+)/)?.[1] || "—";
    $("#versaoAtual").textContent = ver;
    $("#situacaoAtualizacao").textContent = "—";
  },

  async novaaba() {},
  async sobre() {
    $("#versaoNucleo").textContent = chrome.runtime.getManifest().version;
  }
};

// ---------- ações ----------
$("#atualizarListas").addEventListener("click", async (ev) => {
  ev.target.disabled = true;
  try {
    const r = await enviar("atualizarListas");
    avisar(r.atualizado ? "Listas atualizadas" : "Não foi possível baixar as listas agora");
  } catch (e) { avisar(e.message); }
  ev.target.disabled = false;
  carregar.antigolpe();
});

$("#novoConteiner").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const f = ev.target;
  await enviar("criarConteiner", { nome: f.nome.value, cor: f.cor.value });
  f.nome.value = "";
  avisar("Contêiner criado");
  carregar.conteineres();
});

$("#novoSiteIE").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  let site = ev.target.site.value.trim().toLowerCase();
  try { site = new URL(site.includes("://") ? site : "http://" + site).hostname.replace(/^www\./, ""); } catch { return avisar("Endereço inválido"); }
  const sites = await ler("sitesModoIE");
  if (!sites.includes(site)) await gravar({ sitesModoIE: [...sites, site] });
  ev.target.reset();
  carregar.modoie();
});

$("#instalarLoja").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  try {
    await enviar("instalarDaLoja", { texto: ev.target.texto.value });
    ev.target.reset();
    avisar("Confirme a instalação na janela do navegador");
  } catch (e) { avisar(e.message); }
});

$("#verificarExtensoes").addEventListener("click", async (ev) => {
  ev.target.disabled = true;
  try {
    const r = await enviar("verificarAtualizacoesExtensoes");
    avisar(r.length ? `${r.length} atualização(ões) encontrada(s)` : "Todas as extensões estão em dia");
  } catch (e) { avisar("Não foi possível verificar: " + e.message); }
  ev.target.disabled = false;
  carregar.extensoes();
});

$("#verificarAtualizacao").addEventListener("click", async (ev) => {
  ev.target.disabled = true;
  $("#situacaoAtualizacao").textContent = "Verificando…";
  try {
    const r = await enviar("verificarAtualizacaoNavegador");
    if (r.disponivel) {
      $("#situacaoAtualizacao").textContent = `Versão ${r.novaVersao} disponível`;
      $("#instalarAtualizacao").classList.remove("oculto");
    } else {
      $("#situacaoAtualizacao").textContent = "Você está na versão mais recente";
    }
  } catch (e) {
    $("#situacaoAtualizacao").textContent = e.message;
  }
  ev.target.disabled = false;
});

$("#instalarAtualizacao").addEventListener("click", async (ev) => {
  if (!confirm("O navegador será fechado para instalar a atualização e abrirá de novo em seguida. Continuar?")) return;
  ev.target.disabled = true;
  try { await enviar("instalarAtualizacaoNavegador", { agora: true }); }
  catch (e) { avisar(e.message); ev.target.disabled = false; }
});

chrome.management.onInstalled.addListener(() => carregar.extensoes());
chrome.management.onUninstalled.addListener(() => carregar.extensoes());

mostrarSecao();
