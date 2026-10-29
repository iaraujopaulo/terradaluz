// Rode com:  node extensoes/nucleo/testes/analise.test.mjs
import { analisarEndereco, decodificarPunycode } from "../lib/analise.js";
import assert from "node:assert/strict";

const seguros = [
  "https://www.itau.com.br/", "https://internetbanking.caixa.gov.br/sinbc/#!nb/login",
  "https://www.google.com.br/search?q=teste", "https://login.microsoftonline.com/common/oauth2",
  "https://www.gov.br/receitafederal/pt-br", "https://caixadeferramentas.com.br/",
  "https://www.intercom.com/", "https://brainly.com.br/", "https://www.americanas.com.br/",
  "https://detran.ce.gov.br/", "https://caixas.com.br/produtos", "https://www.bb.com.br/site/",
  "https://app.nubank.com.br/beta/login", "https://www.paypal.com/br/signin",
  "https://github.com/ungoogled-software/ungoogled-chromium", "https://pt.wikipedia.org/wiki/Fortaleza",
  "https://www.mercadolivre.com.br/ofertas", "https://web.whatsapp.com/", "https://accounts.google.com/signin",
  "https://www.bradescoseguros.com.br/", "https://meu.inter.co/login", "https://www.netflix.com/login",
  "https://appleinsider.com/", "https://www.receitas.com/", "https://steamcommunity.com/login",
  "http://192.168.0.1/", "https://xn--maana-pta.com/"
];
const golpes = [
  ["http://itau-seguranca.xyz/login", "suspeito"],
  ["https://caixa.gov.br.atualizacao-cadastral.com/", "perigoso"],
  ["https://bradescco.com.br/acesso", "suspeito"],
  ["https://nubank-desbloqueio.online/", "suspeito"],
  ["https://gov.br-receita.site/restituicao", "perigoso"],
  ["https://www.paypa1.com/", "suspeito"],
  ["https://xn--pypal-4ve.com/", "suspeito"],
  ["https://www.itau.com.br@evil.example/", "suspeito"],
  ["https://santander-cliente.top/", "suspeito"],
  ["http://45.12.33.9/caixa/login.php", "suspeito"],
  ["https://receita-federal-restituicao.online/consulta", "suspeito"],
  ["https://correios-rastreio-taxa.com/", "suspeito"],
  ["https://evil.example/x", "perigoso", { hostsPerigosos: new Set(["evil.example"]) }],
];
let falhas = 0;
for (const url of seguros) {
  const r = analisarEndereco(url);
  if (r.nivel !== "ok") { falhas++; console.log("FALSO POSITIVO:", url, r); }
}
for (const [url, esperado, listas] of golpes) {
  const r = analisarEndereco(url, listas);
  if (r.nivel !== esperado) { falhas++; console.log("NÃO DETECTADO:", url, "esperado", esperado, r); }
  else console.log("ok", r.nivel.padEnd(9), url, "—", r.motivos[0]);
}
assert.equal(decodificarPunycode("xn--pypal-4ve"), "pаypal");
assert.equal(decodificarPunycode("xn--maana-pta"), "mañana");
console.log(falhas ? `${falhas} falha(s)` : "todos os testes passaram");
process.exit(falhas ? 1 : 0);
