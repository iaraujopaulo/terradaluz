#!/usr/bin/env python3
"""Gera o símbolo do Terra da Luz (SVG, PNGs e ICOs) e os arquivos de marca
que substituem os do Chromium.

Desenho: um sol nascendo sobre o mar do Ceará, dentro de um círculo.
- Céu do amanhecer (anil -> âmbar)
- Sol dourado com raios em leque
- Mar em duas ondas (turquesa e azul profundo)
- Fina borda clara que lembra uma lente/escudo

Uso:  python3 marca/gerar_marca.py
Requer apenas Pillow e numpy.
"""
from pathlib import Path
import math
import numpy as np
from PIL import Image

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
OVERLAY = RAIZ / "chromium" / "overlay" / "chrome" / "app" / "theme"

# ---------- paleta ----------
CEU_TOPO = (0x1B, 0x2A, 0x5E)
CEU_HORIZONTE = (0xF6, 0x9C, 0x4A)
SOL_CENTRO = (0xFF, 0xF1, 0xB0)
SOL_BORDA = (0xFF, 0xB3, 0x0F)
RAIO = (0xFF, 0xC8, 0x3D)
MAR_CLARO = (0x2E, 0xC4, 0xC9)
MAR_ESCURO = (0x0A, 0x4F, 0x7A)
ONDA_FUNDO = (0x07, 0x37, 0x5C)

# geometria em um quadro de 512
C = 256.0
R_DISCO = 244.0
HORIZONTE = 300.0
SOL_R = 86.0
RAIO_INT, RAIO_EXT = 106.0, 168.0
N_RAIOS = 9


def onda1(x):
    return 316 + 10 * np.sin((x / 512) * 2 * math.pi * 1.5 + 0.6)


def onda2(x):
    return 372 + 12 * np.sin((x / 512) * 2 * math.pi * 1.2 + 2.2)


def mistura(a, b, t):
    t = np.clip(t, 0, 1)[..., None]
    return np.array(a, float) * (1 - t) + np.array(b, float) * t


def renderizar(tamanho: int) -> Image.Image:
    ss = 4 if tamanho >= 64 else 8
    n = tamanho * ss
    esc = 512.0 / n
    ys, xs = np.mgrid[0:n, 0:n].astype(float)
    x = (xs + 0.5) * esc
    y = (ys + 0.5) * esc

    img = mistura(CEU_TOPO, CEU_HORIZONTE, (y - 40) / (HORIZONTE - 40))

    # raios do sol (leque acima do horizonte)
    dx, dy = x - C, y - HORIZONTE
    r = np.hypot(dx, dy)
    ang = np.degrees(np.arctan2(-dy, dx))  # 0..180 acima do horizonte
    passo = 180.0 / N_RAIOS
    meio = np.abs((ang % passo) - passo / 2)
    largura = 5.5 - (r - RAIO_INT) / (RAIO_EXT - RAIO_INT) * 2.5
    em_raio = (r > RAIO_INT) & (r < RAIO_EXT) & (meio < largura)
    img[em_raio] = mistura(RAIO, CEU_HORIZONTE, (r[em_raio] - RAIO_INT) / (RAIO_EXT - RAIO_INT) * 0.55)

    # disco solar
    sol = r < SOL_R
    img[sol] = mistura(SOL_CENTRO, SOL_BORDA, r[sol] / SOL_R)

    # mar
    m1 = y > onda1(x)
    img[m1] = mistura(MAR_CLARO, MAR_ESCURO, (y[m1] - 310) / 120)
    # reflexo do sol na água
    refl = m1 & (np.abs(x - C) < (60 - (y - 316) * 0.5)) & (((y - 316) % 14) < 5) & (y < 365)
    img[refl] = mistura(SOL_CENTRO, MAR_CLARO, (y[refl] - 316) / 60)
    m2 = y > onda2(x)
    img[m2] = mistura(MAR_ESCURO, ONDA_FUNDO, (y[m2] - 370) / 120)

    # recorte circular + borda clara
    d = np.hypot(x - C, y - C)
    borda = (d > R_DISCO - 9) & (d <= R_DISCO)
    img[borda] = img[borda] * 0.55 + np.array([255, 255, 255]) * 0.45
    alfa = (d <= R_DISCO).astype(float) * 255

    rgba = np.dstack([img, alfa]).clip(0, 255).astype(np.uint8)
    im = Image.fromarray(rgba, "RGBA")
    return im.resize((tamanho, tamanho), Image.LANCZOS)


def svg() -> str:
    raios = []
    passo = 180.0 / N_RAIOS
    for i in range(N_RAIOS):
        a = math.radians(passo * i + passo / 2)
        w0, w1 = math.radians(5.5 / RAIO_INT * 57.3), math.radians(3.0 / RAIO_EXT * 57.3)
        pts = []
        for rr, w in ((RAIO_INT, w0), (RAIO_EXT, w1), (RAIO_EXT, -w1), (RAIO_INT, -w0)):
            pts.append(f"{C + rr*math.cos(a+w):.1f},{HORIZONTE - rr*math.sin(a+w):.1f}")
        raios.append(f'<polygon points="{" ".join(pts)}"/>')

    def caminho_onda(f, base_y):
        xs = np.linspace(0, 512, 33)
        pts = " ".join(f"L{xx:.1f},{f(xx):.1f}" for xx in xs)
        return f"M0,{f(0):.1f} {pts} L512,512 L0,512 Z"

    hx = lambda c: "#%02X%02X%02X" % c
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Terra da Luz">
  <title>Terra da Luz</title>
  <defs>
    <clipPath id="disco"><circle cx="256" cy="256" r="{R_DISCO:.0f}"/></clipPath>
    <linearGradient id="ceu" x1="0" y1="40" x2="0" y2="{HORIZONTE:.0f}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="{hx(CEU_TOPO)}"/><stop offset="1" stop-color="{hx(CEU_HORIZONTE)}"/>
    </linearGradient>
    <radialGradient id="sol" cx="256" cy="{HORIZONTE:.0f}" r="{SOL_R:.0f}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="{hx(SOL_CENTRO)}"/><stop offset="1" stop-color="{hx(SOL_BORDA)}"/>
    </radialGradient>
    <linearGradient id="mar" x1="0" y1="310" x2="0" y2="430" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="{hx(MAR_CLARO)}"/><stop offset="1" stop-color="{hx(MAR_ESCURO)}"/>
    </linearGradient>
    <linearGradient id="fundo" x1="0" y1="370" x2="0" y2="490" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="{hx(MAR_ESCURO)}"/><stop offset="1" stop-color="{hx(ONDA_FUNDO)}"/>
    </linearGradient>
  </defs>
  <g clip-path="url(#disco)">
    <rect width="512" height="512" fill="url(#ceu)"/>
    <g fill="{hx(RAIO)}" opacity="0.95">{"".join(raios)}</g>
    <circle cx="256" cy="{HORIZONTE:.0f}" r="{SOL_R:.0f}" fill="url(#sol)"/>
    <path d="{caminho_onda(onda1, 316)}" fill="url(#mar)"/>
    <path d="{caminho_onda(onda2, 372)}" fill="url(#fundo)"/>
  </g>
  <circle cx="256" cy="256" r="{R_DISCO-4.5:.1f}" fill="none" stroke="#FFFFFF" stroke-opacity="0.45" stroke-width="9"/>
</svg>
'''


def salvar_png(caminho: Path, tam: int, cache: dict):
    caminho.parent.mkdir(parents=True, exist_ok=True)
    if tam not in cache:
        cache[tam] = renderizar(tam)
    cache[tam].save(caminho)


def main():
    cache = {}
    (AQUI / "simbolo.svg").write_text(svg(), encoding="utf-8")
    for t in (16, 24, 32, 48, 64, 128, 256, 512, 1024):
        salvar_png(AQUI / "png" / f"terra-da-luz-{t}.png", t, cache)
    ico_tams = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    base = renderizar(256)
    base.save(AQUI / "terra-da-luz.ico", sizes=ico_tams)

    # ---- substituição dos arquivos de marca do Chromium ----
    ch = OVERLAY / "chromium"
    for t in (16, 24, 48, 64, 128, 256):
        salvar_png(ch / f"product_logo_{t}.png", t, cache)
    for t in (24, 48, 64, 128, 256):
        salvar_png(ch / "linux" / f"product_logo_{t}.png", t, cache)
    for escala, mult in (("default_100_percent", 1), ("default_200_percent", 2)):
        d = OVERLAY / escala / "chromium"
        salvar_png(d / "product_logo_16.png", 16 * mult, cache)
        salvar_png(d / "product_logo_32.png", 32 * mult, cache)
        if mult == 1:
            salvar_png(d / "linux" / "product_logo_16.png", 16, cache)
            salvar_png(d / "linux" / "product_logo_32.png", 32, cache)
    (ch / "product_logo.svg").write_text(svg(), encoding="utf-8")
    win = ch / "win"
    win.mkdir(parents=True, exist_ok=True)
    for nome in ("chromium.ico", "app_list.ico"):
        base.save(win / nome, sizes=ico_tams)
    salvar_png(win / "tiles" / "Logo.png", 150, cache)
    salvar_png(win / "tiles" / "SmallLogo.png", 70, cache)

    # ícones das extensões embutidas e do instalador
    for t in (16, 32, 48, 128):
        salvar_png(RAIZ / "extensoes" / "nucleo" / "icones" / f"icone-{t}.png", t, cache)
    base.save(RAIZ / "instalador" / "windows" / "terra-da-luz.ico", sizes=ico_tams)
    base.save(RAIZ / "iehost" / "terra-da-luz.ico", sizes=ico_tams)

    # folha de apresentação
    folha = Image.new("RGBA", (1200, 520), (250, 246, 238, 255))
    folha.alpha_composite(renderizar(440), (40, 40))
    x = 540
    for t in (128, 64, 48, 32, 16):
        folha.alpha_composite(cache.get(t) or renderizar(t), (x, 260 - t // 2))
        x += t + 40
    folha.save(AQUI / "apresentacao.png")

    # ---- macOS: app.icns (ícone do aplicativo) e catálogo de ícones ----
    mac = ch / "mac"
    mac.mkdir(parents=True, exist_ok=True)
    renderizar(1024).save(mac / "app.icns", sizes=[(16, 16), (32, 32), (64, 64), (128, 128), (256, 256), (512, 512), (1024, 1024)])
    catalogo = AQUI / "macos" / "Assets.xcassets"
    conjunto = catalogo / "AppIcon.appiconset"
    conjunto.mkdir(parents=True, exist_ok=True)
    for t in (16, 32, 64, 128, 256, 512):
        salvar_png(conjunto / f"appicon_{t}.png", t, cache)
    import json as _json
    imagens = []
    for tam, escalas in ((16, (16, 32)), (32, (32, 64)), (128, (128, 256)), (256, (256, 512))):
        for escala, arq in zip(("1x", "2x"), escalas):
            imagens.append({"filename": f"appicon_{arq}.png", "idiom": "mac", "scale": escala, "size": f"{tam}x{tam}"})
    info = {"author": "xcode", "version": 1}
    (conjunto / "Contents.json").write_text(_json.dumps({"images": imagens, "info": info}, indent=2))
    (catalogo / "Contents.json").write_text(_json.dumps({"info": info}, indent=2))

    # ---- Linux (Flatpak): ícones no padrão hicolor ----
    for t in (16, 24, 32, 48, 64, 128, 256, 512):
        salvar_png(RAIZ / "instalador" / "linux" / "icones" / f"{t}.png", t, cache)
    (RAIZ / "instalador" / "linux" / "icones" / "terra-da-luz.svg").write_text(svg(), encoding="utf-8")
    print("marca gerada")


if __name__ == "__main__":
    main()
