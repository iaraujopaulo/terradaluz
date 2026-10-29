import { $, enviar } from "./comum.js";

const p = new URLSearchParams(location.hash.slice(1));
const conteiner = { id: p.get("id") || "", nome: p.get("nome") || "Contêiner", cor: p.get("cor") || "#2EC4C9" };
const destino = p.get("destino") || "";

$("#cor").style.background = conteiner.cor;
$("#nome").textContent = conteiner.nome;
document.title = `Contêiner: ${conteiner.nome}`;

if (/^[a-z0-9-]{1,60}$/.test(conteiner.id) && /^#[0-9a-f]{6}$/i.test(conteiner.cor)) {
  await enviar("definirIdentidade", { conteiner });
}
if (/^https?:\/\//i.test(destino)) location.replace(destino);
else chrome.tabs.getCurrent((t) => chrome.tabs.update(t.id, { url: "chrome://newtab/" }));
