# Terra da Luz

<img src="marca/png/terra-da-luz-256.png" width="128" align="right" alt="Símbolo do Terra da Luz">

Navegador híbrido: o motor **Blink** e o isolamento de processos do **Chromium**, sem a telemetria do Google (**ungoogled-chromium**), com a **filosofia de privacidade do Firefox** reimplementada por cima.

| Característica | Chromium | Firefox | **Terra da Luz** |
|---|---|---|---|
| Motor | Blink | Gecko | **Blink** (melhor compatibilidade) |
| Isolamento | Processo por site | Fission | **Processo por site** (herdado do Chromium) |
| Privacidade | Ligado ao Google | Bloqueio rigoroso | **Sem telemetria + bloqueio rigoroso** |
| Extensões | Só Manifest V3 | MV2 e MV3 | **MV2 e MV3** (o ungoogled-chromium mantém o MV2, então o uBlock Origin completo funciona) |
| Sites antigos | — | — | **Modo Internet Explorer** (motor do IE 11 do Windows) |

---

## O que já vem pronto

| Pedido | Como foi feito | Onde está |
|---|---|---|
| Remover a telemetria do Google | Base ungoogled-chromium 156 + políticas que desligam métricas, verificação de senhas vazadas, corretor online e login do Google | `politicas/`, `chromium/` |
| Bloqueador nativo de rastreadores | Regras no motor `declarativeNetRequest`, que roda em C++ dentro do Chromium. Níveis Padrão / Estrita / Desligada, como no Firefox. Remove códigos de rastreio dos links (`utm_`, `fbclid`, `gclid`…) | `extensoes/nucleo/regras/` |
| uBlock Origin embutido | Instalado e atualizado automaticamente por política (versão completa, MV2) | `.github/workflows/extensoes.yml` |
| Proteção contra impressão digital | **Patch em C++** que liga por padrão o ruído em canvas, medidas de texto e retângulos; no nível Estrita, disfarce extra de áudio, processador, bateria e fontes | `chromium/patches/terra/protecoes-padrao.patch` |
| Isolamento de cookies por site | Cookies de terceiros bloqueados + armazenamento particionado (equivale à Proteção Total de Cookies do Firefox) | `politicas/politicas.json` |
| Contêineres (como os Multi-Account Containers) | Cada contêiner é um perfil separado do navegador: cookies, logins, cache e histórico isolados. Regras “sempre abrir este site no contêiner X” | `extensoes/nucleo/lib/recursos.js` |
| Buscador padrão privado | DuckDuckGo na barra de endereços e na nova aba (dá para trocar) | `politicas/initial_preferences` |
| Antiphishing e antigolpe | Análise local de cada endereço (imitação de bancos, gov.br, lojas; letras de outros alfabetos; “@” disfarçado) + listas públicas URLhaus e OpenPhish + bloqueio de downloads perigosos + DNS seguro Quad9 (bloqueia domínios de malware) + HTTPS-First | `extensoes/nucleo/lib/analise.js` |
| Modo Internet Explorer | Botão “Recarregar no modo Internet Explorer”, menu do botão direito e lista de sites que sempre abrem no IE. Abre uma janela do Terra da Luz com o motor MSHTML (IE 11) do Windows | `iehost/TerraIE.cs` |
| Atualização automática | Tarefa agendada verifica a cada 6 h e ao ligar o PC; confere a **assinatura digital Ed25519** e o SHA-256 do pacote; instala quando o navegador fecha. Extensões embutidas se atualizam pelo servidor do projeto | `ajudante/` |
| Extensões da Chrome Web Store | Central de extensões no Painel + botão “Adicionar ao Terra da Luz” na própria loja + verificação de atualizações (com sua permissão) | `extensoes/nucleo/paginas/painel.html` |
| Interface bonita e moderna | Nova aba com relógio, busca e atalhos; Painel; janela do ícone; tema “Areia”; modo escuro automático | `extensoes/nucleo/paginas/`, `extensoes/tema/` |
| Símbolo | Sol nascendo sobre o mar do Ceará | `marca/` |

---

## 1. Experimente hoje (5 minutos, sem compilar nada)

Você pode ver a interface, o antigolpe, o bloqueio e o Modo IE funcionando **no Chrome ou no Edge que você já tem**:

1. Extraia esta pasta em `C:\TerraDaLuz`.
2. Clique com o botão direito em `ferramentas\experimentar-no-windows.ps1` › **Executar com o PowerShell**.
3. No Chrome, abra `chrome://extensions`, ligue **Modo do desenvolvedor**, clique em **Carregar sem compactação** e escolha `C:\TerraDaLuz\extensoes\nucleo`.
4. Abra uma nova aba. 🎉

> Os contêineres e a atualização automática só funcionam no navegador Terra da Luz compilado (eles dependem do executável próprio).

---

## 2. Gerar o seu navegador (sem instalar nada no seu computador)

O Chromium tem mais de 30 milhões de linhas de código; compilar em um computador comum leva um dia inteiro e precisa de ~100 GB livres. Por isso tudo foi preparado para o **GitHub Actions** compilar de graça para você.

### Jeito automático (recomendado)

Um script faz tudo: cria o repositório, envia o projeto, cadastra as chaves, ativa o site de atualizações e inicia a compilação dos três instaladores.

1. **Crie uma conta** em [github.com](https://github.com) (se ainda não tiver).
2. Deixe o **chaves-PRIVADAS-terra-da-luz-v2.zip** (ou só o **CHAVES_TERRA.txt**) na pasta *Downloads* ou ao lado da pasta do projeto.
3. Rode o script:
   - **Windows**: clique com o botão direito em `CONFIGURAR-GITHUB.ps1` › **Executar com o PowerShell**.
   - **Linux / macOS**: `bash CONFIGURAR-GITHUB.sh`
4. Quando o navegador abrir, entre no GitHub e digite o código que aparece na janela do script.
5. Pronto. Em 10 a 20 horas os instaladores aparecem em *Releases* e no site do projeto. Para lançar uma versão nova no futuro, rode o script de novo (ou use o botão do passo 6 abaixo).

### Jeito manual (pelo site do GitHub)

1. **Crie um repositório público** chamado `terra-da-luz` (público = minutos de compilação ilimitados e grátis) e **envie os arquivos** desta pasta: *Add file › Upload files*, arraste tudo e confirme. Não envie o zip das chaves.
2. **Cadastre as chaves** (um único segredo com todas elas):
   1. Abra o arquivo **CHAVES_TERRA.txt** (vem solto e também dentro do **chaves-PRIVADAS-terra-da-luz-v2.zip**) no Bloco de Notas.
   2. Selecione tudo (*Ctrl+A*) e copie (*Ctrl+C*).
   3. No repositório: *Settings › Secrets and variables › Actions › New repository secret*.
   4. *Name*: `CHAVES_TERRA` · *Secret*: cole o texto · *Add secret*.
3. **Libere a publicação**: *Settings › Actions › General › Workflow permissions › Read and write permissions › Save*.
4. **Publique as extensões**: aba *Actions* › **Publicar extensões embutidas** › *Run workflow*. Leva ~2 minutos e cria o site.
5. **Ative o site de atualizações**: *Settings › Pages › Source: Deploy from a branch › gh-pages / (root) › Save*.
6. **Compile os três instaladores**: aba *Actions* › **Lançar nova versão (Windows, Linux e macOS)** › *Run workflow*. Cada sistema leva de 10 a 20 horas, em etapas encadeadas; pode fechar a página.
7. **Baixe os instaladores** em *Releases* ou no site do projeto (`https://SEU-USUARIO.github.io/terra-da-luz/`). Daqui em diante, quem instalar recebe as próximas versões sozinho.

> O endereço do site e do servidor de atualizações é descoberto automaticamente a partir do nome do seu repositório; não precisa editar nenhum arquivo.

⚠️ **As chaves são o que garante as atualizações automáticas.** Elas assinam cada versão; os navegadores instalados só aceitam atualizações assinadas por elas. Guarde o zip das chaves em um pendrive: se ele se perder, quem já instalou o Terra da Luz não recebe mais atualizações e precisa reinstalar. Nunca envie o zip nem o `SEGREDO-CHAVES_TERRA.txt` para o repositório: quem tiver essas chaves consegue publicar atualizações para todos os seus usuários.

### Os três instaladores

| Sistema | Arquivo | Como instalar | Como se atualiza |
|---|---|---|---|
| **Windows** 10 e 11 | `TerraDaLuz-Setup-<versão>-x64.exe` | Dois cliques e *Avançar* | Tarefa agendada confere a assinatura e instala ao fechar o navegador |
| **Linux** (qualquer distribuição) | `TerraDaLuz-<versão>-x86_64.flatpak` | Dois cliques (abre a central de programas) ou `flatpak install --user TerraDaLuz-*.flatpak` | Pela central de programas ou `flatpak update` (repositório assinado com GPG no GitHub Pages) |
| **macOS** 12 ou mais novo | `TerraDaLuz-<versão>-macOS.pkg` | Dois cliques; um único arquivo serve para Apple Silicon e Intel | Serviço do sistema (launchd) confere a assinatura e instala |

- **Linux**: o Flatpak já vem no Fedora, Linux Mint, Pop!_OS, elementary, openSUSE e outras. No Ubuntu, instale antes com `sudo apt install flatpak gnome-software-plugin-flatpak`. O navegador roda isolado pela sandbox do Flatpak, com o isolamento de processos do Chromium funcionando dentro dela (zypak). O Modo Internet Explorer não existe fora do Windows.
- **macOS**: no fim da instalação o Mac abre o perfil “Terra da Luz”; aprove em *Ajustes do Sistema › Geral › Gerenciamento de Dispositivos* para ligar a proteção e as extensões embutidas. Como o pacote não tem assinatura paga da Apple, na primeira vez clique com o botão direito no `.pkg` › *Abrir*, ou vá em *Ajustes do Sistema › Privacidade e Segurança › Abrir mesmo assim*.
- As receitas de cada instalador estão em `instalador/windows`, `instalador/linux` e `instalador/macos`.

### Quando sair um Chromium novo

O ungoogled-chromium publica versões novas a cada poucas semanas (correções de segurança). Para atualizar: veja as últimas versões em [Windows](https://github.com/ungoogled-software/ungoogled-chromium-windows/tags), [Linux](https://github.com/ungoogled-software/ungoogled-chromium-portablelinux/tags) e [macOS](https://github.com/ungoogled-software/ungoogled-chromium-macos/tags), troque os campos `tag` em `terra.config.json` e rode **Lançar nova versão** (ou o script de configuração de novo). Se algum patch do Terra da Luz deixar de se encaixar na versão nova, a primeira etapa da compilação para logo no início e mostra qual arquivo precisa de ajuste.

---

## 3. Como as peças se encaixam

```
┌────────────────────────── Terra da Luz (chrome.exe) ──────────────────────────┐
│ Chromium 156 + patches do ungoogled-chromium + 5 patches do Terra da Luz       │
│   • marca e modo de instalação próprio (não colide com Chrome/Chromium)        │
│   • proteções contra impressão digital ligadas por padrão (C++)                │
│   • libera SÓ as extensões embutidas do projeto em PCs domésticos              │
│                                                                                │
│  Extensões embutidas (instaladas e atualizadas por política):                  │
│   ├─ Núcleo  → nova aba, painel, escudo, antigolpe, contêineres, modo IE       │
│   ├─ uBlock Origin (MV2 completo)                                              │
│   └─ Tema Areia                                                                │
└───────────────┬────────────────────────────────────────────────────────────────┘
                │ mensagens nativas (JSON)
┌───────────────▼─────────────┐      ┌───────────────────────────────┐
│ terra-ajudante.exe (Go)     │─────▶│ TerraIE.exe (C#, MSHTML IE11) │
│  • atualizações assinadas   │      └───────────────────────────────┘
│  • abre contêineres         │      Tarefa agendada (SYSTEM): terra-ajudante atualizar
└───────────────┬─────────────┘
                │ https
┌───────────────▼─────────────────────────────────────────────────────┐
│ GitHub Pages: atualizacoes/estavel.json (assinado) + extensoes/*.crx │
│ GitHub Releases: TerraDaLuz-Setup-<versão>-x64.exe                    │
└──────────────────────────────────────────────────────────────────────┘
```

### Pastas

| Pasta | Conteúdo |
|---|---|
| `marca/` | Símbolo (SVG, PNG, ICO) e o gerador `gerar_marca.py` |
| `chromium/` | Patches verificados contra o Chromium 156.0.8078.73, ícones que substituem os do Chromium, `integrar.py` |
| `extensoes/nucleo/` | O Núcleo (interface e proteções) e seus testes |
| `extensoes/tema/` | Tema “Areia” |
| `ajudante/` | Ajudante e ferramentas de publicação em Go (sem dependências externas), com testes |
| `iehost/` | Janela do Modo Internet Explorer |
| `instalador/` | Instalador do Windows (Inno Setup) e gerador das políticas |
| `politicas/` | Políticas, preferências iniciais e as chaves **públicas** do projeto |
| `.github/workflows/` | Compilação, publicação e testes automáticos |
| `pre-compilados/` | Ajudante já compilado (para o modo “Experimente hoje”) |

---

## 4. Segurança: o que protege e o que não protege

- **Atualizações** só são instaladas se a assinatura Ed25519 do manifesto bater com a chave pública gravada no instalador e o SHA-256 do pacote bater com o manifesto. Um servidor invadido sem a chave privada não consegue enviar nada.
- **Extensões fora da loja**: o Chromium bloqueia, em PCs domésticos, extensões instaladas por política fora da Chrome Web Store (proteção contra vírus). O patch do Terra da Luz libera **apenas** o endereço do seu projeto; qualquer outro continua bloqueado.
- **Antigolpe**: a análise é feita no computador; nenhum endereço visitado é enviado. Ele não substitui o Google Safe Browsing (removido pelo ungoogled-chromium por privacidade), mas soma listas públicas, heurísticas para golpes brasileiros e o DNS da Quad9.
- **Modo Internet Explorer**: o motor do IE 11 não recebe mais melhorias. Use só para sistemas antigos em que você confia — a própria janela avisa isso.
- **Instalador sem assinatura de código**: o Windows SmartScreen vai mostrar “Editor desconhecido” até você assinar o instalador com um certificado de assinatura de código (custa a partir de ~US$ 200/ano; a [SignPath](https://signpath.org) oferece grátis para projetos de código aberto).

## 5. Limitações conhecidas e próximos passos

- **Ainda não foi compilado de ponta a ponta.** Os patches foram conferidos contra o código-fonte real do Chromium 156.0.8078.73 e se aplicam sem erros sobre o ungoogled-chromium; o Núcleo, o ajudante e o empacotamento têm testes automáticos. A primeira compilação completa acontece no seu GitHub Actions — se algo falhar, o registro do Actions mostra onde.
- **Espaço em disco no macOS**: o Chromium precisa de ~100 GB durante a compilação. Se as máquinas gratuitas do GitHub ficarem sem espaço, rode **Compilar navegador (macOS)** escolhendo uma máquina maior no campo *Máquina* (as máquinas maiores do GitHub são pagas), ou compile num Mac próprio com o `build.sh` do ungoogled-chromium-macos e depois use `instalador/macos/construir-pkg.sh`.
- **Assinaturas pagas**: sem certificado da Microsoft e sem conta de desenvolvedor da Apple (US$ 99/ano), o Windows mostra “Editor desconhecido” e o macOS pede *Abrir mesmo assim* na primeira vez. O Flatpak não tem esse problema.
- **Bloqueio de anúncios 100% em C++**: hoje o bloqueio nativo usa o `declarativeNetRequest` (C++) e o uBlock Origin (JavaScript). Integrar um motor como o `adblock-rust` direto no código do Chromium é o próximo grande passo.
- **Firefox e CEF**: o código do Firefox (Gecko) não é misturado ao Chromium — os dois motores são incompatíveis. O “híbrido” é trazer os recursos de privacidade do Firefox para o Chromium. O CEF serve para embutir um navegador em outro programa e perderia o suporte a extensões; por isso a base é o ungoogled-chromium completo.

## Licenças

Código do Terra da Luz: BSD-3-Clause (a mesma do Chromium). Chromium e ungoogled-chromium: BSD. uBlock Origin: GPLv3 (distribuído sem modificações, a partir dos lançamentos oficiais). Firefox é marca registrada da Mozilla Foundation; Chrome e Chrome Web Store são marcas do Google. O Terra da Luz não é afiliado a nenhuma delas.
