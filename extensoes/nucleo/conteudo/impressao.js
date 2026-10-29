// Modo "Estrito": camada extra contra impressão digital, somada às proteções
// nativas em C++ (ruído em canvas e medidas de texto, já ligadas por padrão).
// Roda no mundo da própria página, antes de qualquer script do site.
(() => {
  "use strict";
  const semente = crypto.getRandomValues(new Uint32Array(1))[0];
  let estado = semente || 1;
  const aleatorio = () => {
    estado ^= estado << 13; estado ^= estado >>> 17; estado ^= estado << 5;
    return ((estado >>> 0) % 1000) / 1000;
  };
  const definir = (obj, prop, valor) => {
    try {
      Object.defineProperty(obj, prop, { get: () => valor, configurable: true });
    } catch {}
  };

  // Hardware: valores comuns para não destacar o computador da pessoa
  definir(Navigator.prototype, "hardwareConcurrency", 4);
  if ("deviceMemory" in Navigator.prototype) definir(Navigator.prototype, "deviceMemory", 8);
  if (navigator.getBattery) {
    Navigator.prototype.getBattery = function () {
      return Promise.reject(new DOMException("Recurso desativado pelo Terra da Luz", "NotAllowedError"));
    };
  }

  // Áudio: ruído mínimo, imperceptível ao ouvido
  const originalCanal = AudioBuffer.prototype.getChannelData;
  const tocados = new WeakSet();
  AudioBuffer.prototype.getChannelData = function (...args) {
    const dados = originalCanal.apply(this, args);
    if (!tocados.has(dados)) {
      tocados.add(dados);
      for (let i = 0; i < dados.length; i += 97) dados[i] += (aleatorio() - 0.5) * 1e-7;
    }
    return dados;
  };
  const originalAnalisar = AnalyserNode.prototype.getFloatFrequencyData;
  AnalyserNode.prototype.getFloatFrequencyData = function (arr) {
    originalAnalisar.call(this, arr);
    for (let i = 0; i < arr.length; i += 31) arr[i] += (aleatorio() - 0.5) * 1e-4;
  };

  // Lista de fontes por medição: limita o que a página consegue descobrir
  if (document.fonts && document.fonts.check) {
    const originalCheck = document.fonts.check.bind(document.fonts);
    const comuns = /arial|helvetica|times|courier|verdana|georgia|segoe|roboto|noto|sans-serif|serif|monospace|system-ui/i;
    document.fonts.check = (fonte, texto) => (comuns.test(fonte) ? originalCheck(fonte, texto) : false);
  }
})();
