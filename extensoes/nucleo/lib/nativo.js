// Conversa com o "ajudante" nativo do Terra da Luz (terra-ajudante), que
// abre o modo Internet Explorer, inicia contêineres e instala atualizações.
import { HOST_NATIVO } from "./config.js";

export async function nativo(mensagem, tempoLimiteMs = 15000) {
  const pedido = new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendNativeMessage(HOST_NATIVO, mensagem, (resposta) => {
        const erro = chrome.runtime.lastError;
        if (erro) {
          reject(new Error(traduzirErro(erro.message)));
          return;
        }
        if (!resposta) {
          reject(new Error("O ajudante do Terra da Luz não respondeu."));
          return;
        }
        if (resposta.ok === false) {
          reject(new Error(resposta.erro || "O ajudante informou um erro."));
          return;
        }
        resolve(resposta);
      });
    } catch (e) {
      reject(e);
    }
  });
  const limite = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("O ajudante demorou demais para responder.")), tempoLimiteMs)
  );
  return Promise.race([pedido, limite]);
}

function traduzirErro(msg = "") {
  if (/not found|não encontrado/i.test(msg)) {
    return "O ajudante do Terra da Luz não está instalado neste computador. Reinstale o navegador.";
  }
  if (/forbidden|proibido/i.test(msg)) {
    return "O ajudante recusou o pedido desta extensão.";
  }
  if (/exited/i.test(msg)) {
    return "O ajudante fechou inesperadamente.";
  }
  return msg;
}

export async function ajudanteDisponivel() {
  try {
    const r = await nativo({ comando: "versao" }, 4000);
    return { disponivel: true, ...r };
  } catch (e) {
    return { disponivel: false, erro: e.message };
  }
}
