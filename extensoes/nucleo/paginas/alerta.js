import { $, el, enviar } from "./comum.js";

const p = new URLSearchParams(location.search);
const url = p.get("url") || "";
const nivel = p.get("nivel") || "perigoso";
let motivos = [];
try { motivos = JSON.parse(p.get("motivos") || "[]"); } catch {}

let host = "";
try { host = new URL(url).hostname; } catch {}

if (nivel === "suspeito") {
  document.body.classList.add("suspeito");
  $("#titulo").textContent = "Cuidado: este site parece falso";
  $("#explicacao").textContent = "O endereço tem sinais típicos de páginas que imitam bancos, lojas ou o governo para roubar dados.";
}
$("#endereco").textContent = url;
$("#motivos").replaceChildren(...motivos.map((m) => el("li", {}, m)));

$("#voltar").addEventListener("click", () => {
  if (history.length > 1) history.back();
  else chrome.tabs.getCurrent((t) => chrome.tabs.update(t.id, { url: "chrome://newtab/" }));
});

$("#continuar").addEventListener("click", async () => {
  if (!host || !/^https?:/i.test(url)) return;
  await enviar("liberarSite", { host, minutos: 60 });
  location.replace(url);
});
