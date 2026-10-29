// Chrome Web Store: troca o botão "Usar no Chrome" por "Adicionar ao Terra da Luz".
(() => {
  const ID = /\/detail\/(?:[^/]+\/)?([a-p]{32})/;
  let botao;

  function idAtual() {
    const m = location.pathname.match(ID);
    return m ? m[1] : null;
  }

  function garantirBotao() {
    const id = idAtual();
    if (!id) {
      botao?.remove();
      botao = null;
      return;
    }
    if (botao && botao.dataset.id === id) return;
    botao?.remove();
    botao = document.createElement("button");
    botao.dataset.id = id;
    botao.type = "button";
    botao.textContent = "Adicionar ao Terra da Luz";
    Object.assign(botao.style, {
      position: "fixed", right: "24px", bottom: "24px", zIndex: "2147483647",
      padding: "14px 22px", borderRadius: "999px", border: "0", cursor: "pointer",
      font: "600 15px system-ui, sans-serif", color: "#fff",
      background: "linear-gradient(135deg, #0A4F7A, #2EC4C9)",
      boxShadow: "0 8px 24px rgba(10, 79, 122, .35)"
    });
    botao.addEventListener("click", async () => {
      botao.disabled = true;
      botao.textContent = "Abrindo instalação…";
      try {
        const r = await chrome.runtime.sendMessage({ tipo: "instalarDaLoja", texto: id });
        botao.textContent = r && r.ok ? "Confirme na janela de instalação" : "Não foi possível instalar";
      } catch {
        botao.textContent = "Não foi possível instalar";
      }
      setTimeout(() => { botao.disabled = false; botao.textContent = "Adicionar ao Terra da Luz"; }, 4000);
    });
    document.documentElement.append(botao);
  }

  garantirBotao();
  // a loja é uma aplicação de página única: observa mudanças de endereço
  let ultimo = location.href;
  new MutationObserver(() => {
    if (location.href !== ultimo) {
      ultimo = location.href;
      garantirBotao();
    }
  }).observe(document, { subtree: true, childList: true });
})();
