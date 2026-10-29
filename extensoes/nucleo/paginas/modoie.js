import { $, enviar } from "./comum.js";

const url = new URLSearchParams(location.search).get("url") || "";
$("#endereco").textContent = url;
$("#aqui").addEventListener("click", async () => {
  // Tira o site da lista e abre aqui mesmo
  const host = new URL(url).hostname;
  await enviar("alternarSempreNoIE", { host });
  location.replace(url);
});
