// Marcas muito imitadas em golpes no Brasil e no mundo.
// "termo" é a palavra que aparece em endereços falsos; "oficiais" são os
// domínios verdadeiros (qualquer subdomínio deles também é aceito).
export const MARCAS = [
  { termo: "caixa", oficiais: ["caixa.gov.br", "caixa.com.br"] },
  { termo: "bancodobrasil", oficiais: ["bb.com.br", "bancodobrasil.com.br"] },
  { termo: "itau", oficiais: ["itau.com.br", "itau.com", "itaupersonnalite.com.br", "itaucard.com.br"] },
  { termo: "bradesco", oficiais: ["bradesco.com.br", "bradescoseguros.com.br", "bradescocartoes.com.br"] },
  { termo: "santander", oficiais: ["santander.com.br", "santander.com"] },
  { termo: "nubank", oficiais: ["nubank.com.br", "nu.com.br", "nubank.com"] },
  { termo: "inter", oficiais: ["bancointer.com.br", "inter.co"], soComRisco: true },
  { termo: "picpay", oficiais: ["picpay.com", "picpay.com.br"] },
  { termo: "mercadopago", oficiais: ["mercadopago.com.br", "mercadopago.com"] },
  { termo: "mercadolivre", oficiais: ["mercadolivre.com.br", "mercadolibre.com", "mercadolivre.com"] },
  { termo: "pagseguro", oficiais: ["pagseguro.uol.com.br", "pagbank.com.br", "uol.com.br"] },
  { termo: "pagbank", oficiais: ["pagbank.com.br", "pagseguro.uol.com.br"] },
  { termo: "sicoob", oficiais: ["sicoob.com.br"] },
  { termo: "sicredi", oficiais: ["sicredi.com.br"] },
  { termo: "receita", oficiais: ["gov.br", "receita.fazenda.gov.br"], soComRisco: true },
  { termo: "detran", oficiais: ["gov.br"], aceitaSufixo: ".gov.br" },
  { termo: "serasa", oficiais: ["serasa.com.br", "serasaexperian.com.br"] },
  { termo: "correios", oficiais: ["correios.com.br"] },
  { termo: "magalu", oficiais: ["magazineluiza.com.br", "magalu.com", "magalu.com.br"] },
  { termo: "americanas", oficiais: ["americanas.com.br", "americanas.com"] },
  { termo: "shopee", oficiais: ["shopee.com.br", "shopee.com"] },
  { termo: "netflix", oficiais: ["netflix.com"] },
  { termo: "whatsapp", oficiais: ["whatsapp.com", "whatsapp.net", "wa.me"] },
  { termo: "instagram", oficiais: ["instagram.com"] },
  { termo: "facebook", oficiais: ["facebook.com", "fb.com", "facebook.net", "fbcdn.net"] },
  { termo: "google", oficiais: ["google.com", "google.com.br", "googleusercontent.com", "gstatic.com", "googleapis.com", "youtube.com", "goo.gl", "g.co"] },
  { termo: "gmail", oficiais: ["google.com", "gmail.com"] },
  { termo: "microsoft", oficiais: ["microsoft.com", "live.com", "office.com", "microsoftonline.com", "msn.com", "outlook.com", "bing.com", "azure.com", "windows.net"] },
  { termo: "outlook", oficiais: ["outlook.com", "live.com", "office.com", "microsoft.com"] },
  { termo: "office365", oficiais: ["office.com", "microsoft.com", "microsoftonline.com"] },
  { termo: "apple", oficiais: ["apple.com", "icloud.com"] },
  { termo: "icloud", oficiais: ["icloud.com", "apple.com"] },
  { termo: "paypal", oficiais: ["paypal.com", "paypal.me", "paypalobjects.com"] },
  { termo: "amazon", oficiais: ["amazon.com", "amazon.com.br", "amazonaws.com", "media-amazon.com", "amazon.dev"] },
  { termo: "binance", oficiais: ["binance.com"] },
  { termo: "metamask", oficiais: ["metamask.io"] },
  { termo: "steam", oficiais: ["steampowered.com", "steamcommunity.com"], soComRisco: true },
  { termo: "gov", oficiais: ["gov.br"], aceitaSufixo: ".gov.br", soGovBr: true }
];

// Palavras típicas de páginas falsas de login, cobrança ou "atualização".
export const PALAVRAS_RISCO = [
  "login", "logon", "signin", "entrar", "acesso", "acessar", "seguro", "segura", "seguranca", "security",
  "verifica", "verificar", "verify", "validar", "valida", "atualiza", "atualizar", "atualizacao", "update",
  "conta", "account", "cadastro", "recadastro", "desbloqueio", "desbloquear", "bloqueio", "suporte",
  "support", "sac", "pix", "token", "premio", "premiado", "resgate", "resgatar", "brinde", "oferta",
  "cliente", "clientes", "senha", "password", "auth", "online", "app", "apps", "portal", "regularizar",
  "regularize", "pendencia", "pendente", "debito", "fatura", "boleto", "restituicao", "multa", "rastreio",
  "encomenda", "taxa", "wallet", "recover", "recovery"
];

// Terminações de domínio muito usadas em golpes por serem baratas.
export const TLDS_RISCO = [
  "xyz", "top", "online", "site", "info", "click", "live", "shop", "icu", "buzz", "cyou", "rest",
  "monster", "sbs", "cfd", "lol", "quest", "loan", "work", "fun", "space", "website", "tk", "ml",
  "ga", "cf", "gq", "pw", "zip", "mov", "bond", "today", "support", "help", "vip", "life"
];
