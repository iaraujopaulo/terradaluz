import { $, el, enviar, avisar, formatarNumero, iconeSite } from "./comum.js";

const [aba] = await chrome.tabs.query({ active: true, currentWindow: true });
const url = aba?.url || "";

async function desenhar() {
  const e = await enviar("estadoAba", { tabId: aba.id, url });

  if (e.identidade) {
    const c = $("#conteinerAtual");
    c.classList.remove("oculto");
    c.replaceChildren(el("span", { class: "ponto", style: { background: e.identidade.cor } }), e.identidade.nome);
  }

  $("#host").textContent = e.web ? e.host : "Página do navegador";
  $("#favicon").src = iconeSite(url || "chrome://newtab", 32);
  $("#cadeado").textContent = !e.web ? "" : e.seguro ? "Conexão segura (HTTPS)" : "Conexão sem cadeado";

  const selo = $("#selo");
  const alerta = $("#alertaSite");
  if (e.analise.nivel === "perigoso") {
    selo.className = "etiqueta perigo"; selo.textContent = "Perigoso";
  } else if (e.analise.nivel === "suspeito") {
    selo.className = "etiqueta aviso"; selo.textContent = "Suspeito";
  } else if (e.web && !e.seguro) {
    selo.className = "etiqueta aviso"; selo.textContent = "Sem cadeado";
  } else {
    selo.className = "etiqueta ok"; selo.textContent = "Seguro";
  }
  if (e.analise.motivos.length) {
    alerta.classList.remove("oculto");
    alerta.textContent = e.analise.motivos[0];
  }

  const blocos = ["#blocoProtecao", "#blocoIE", "#blocoConteiner"];
  if (!e.web) blocos.forEach((b) => $(b).classList.add("oculto"));

  const chave = $("#protecaoSite");
  chave.checked = e.protegido && e.nivel !== "desligada";
  chave.disabled = e.nivel === "desligada";
  $("#descProtecao").textContent = e.nivel === "desligada" ? "Desligada no Painel" : e.protegido ? "Ativa neste site" : "Desligada neste site";

  const p = e.bloqueios.porCategoria || {};
  $("#cTotal").textContent = e.bloqueios.total === null ? "—" : formatarNumero(e.bloqueios.total);
  $("#cRastreadores").textContent = formatarNumero((p.rastreadores || 0) + (p.cripto || 0));
  $("#cSocial").textContent = formatarNumero(p.social || 0);
  $("#cImpressao").textContent = formatarNumero(p.impressao || 0);

  $("#sempreIE").checked = e.sempreIE;

  if (e.identidade) {
    $("#blocoConteiner").classList.add("oculto");
  } else {
    $("#listaConteineres").replaceChildren(...e.conteineres.map((c) =>
      el("button", {
        onclick: async () => {
          try { await enviar("abrirConteiner", { id: c.id, url }); window.close(); }
          catch (err) { avisar(err.message); }
        }
      }, el("span", { class: "ponto", style: { background: c.cor } }), c.nome)
    ));
    const sel = $("#conteinerSempre");
    sel.replaceChildren(
      el("option", { value: "" }, "Nenhum"),
      ...e.conteineres.map((c) => el("option", { value: c.id, selected: c.id === e.conteinerDoSite }, c.nome))
    );
  }
}

$("#protecaoSite").addEventListener("change", async () => {
  const r = await enviar("alternarSite", { host: new URL(url).hostname });
  avisar(r.protegido ? `Proteção ligada em ${r.dominio}` : `Proteção desligada em ${r.dominio}`);
  chrome.tabs.reload(aba.id);
  desenhar();
});

$("#abrirIE").addEventListener("click", async () => {
  try {
    await enviar("abrirIE", { url });
    window.close();
  } catch (err) {
    avisar(err.message);
  }
});

$("#sempreIE").addEventListener("change", async () => {
  const ligado = await enviar("alternarSempreNoIE", { host: new URL(url).hostname });
  avisar(ligado ? "Este site vai abrir sempre no modo IE" : "Este site volta a abrir no modo moderno");
});

$("#conteinerSempre").addEventListener("change", async (ev) => {
  await enviar("definirConteinerDoSite", { host: new URL(url).hostname, id: ev.target.value || null });
  avisar(ev.target.value ? "Pronto: este site abrirá sempre no contêiner escolhido" : "Regra removida");
});

desenhar().catch((e) => avisar(e.message));
