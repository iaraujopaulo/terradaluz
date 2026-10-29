// Contadores locais de bloqueios (ficam só neste computador).
import { ler, gravar, hoje } from "./config.js";

const CATEGORIA_POR_REGRA = { 1: "rastreadores", 2: "social", 3: "social", 4: "impressao", 5: "cripto" };

export async function contar(categoria, n = 1) {
  const e = await ler("estatisticas");
  const dia = hoje();
  const atual = e.dia === dia ? e : { dia, rastreadores: 0, impressao: 0, cripto: 0, social: 0, golpes: 0, total: e.total || 0 };
  atual[categoria] = (atual[categoria] || 0) + n;
  atual.total = (atual.total || 0) + n;
  await gravar({ estatisticas: atual });
}

// O navegador guarda os bloqueios dos últimos 5 minutos; lemos a cada minuto.
export async function coletarBloqueios() {
  const { ultimaColeta = Date.now() - 60000 } = await chrome.storage.session.get("ultimaColeta");
  const agora = Date.now();
  try {
    const { rulesMatchedInfo } = await chrome.declarativeNetRequest.getMatchedRules({ minTimeStamp: ultimaColeta });
    const somas = {};
    for (const info of rulesMatchedInfo) {
      if (info.rule.rulesetId !== "rastreadores") continue;
      const cat = CATEGORIA_POR_REGRA[info.rule.ruleId];
      if (cat) somas[cat] = (somas[cat] || 0) + 1;
    }
    for (const [cat, n] of Object.entries(somas)) await contar(cat, n);
  } catch (e) {
    // limite de chamadas atingido: tentamos de novo no próximo minuto
  }
  await chrome.storage.session.set({ ultimaColeta: agora });
}

export async function bloqueiosDaAba(tabId) {
  try {
    const { rulesMatchedInfo } = await chrome.declarativeNetRequest.getMatchedRules({ tabId });
    const dominios = new Map();
    for (const info of rulesMatchedInfo) {
      if (info.rule.rulesetId !== "rastreadores") continue;
      dominios.set(info.rule.ruleId, (dominios.get(info.rule.ruleId) || 0) + 1);
    }
    let total = 0;
    const porCategoria = {};
    for (const [id, n] of dominios) {
      total += n;
      const c = CATEGORIA_POR_REGRA[id];
      porCategoria[c] = (porCategoria[c] || 0) + n;
    }
    return { total, porCategoria };
  } catch {
    return { total: null, porCategoria: {} };
  }
}
