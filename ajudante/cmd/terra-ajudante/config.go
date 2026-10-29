package main

import (
	"bytes"
	"crypto/ed25519"
	"encoding/base64"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

// Config fica em terra-ajudante.json, ao lado do executável. O instalador a
// escreve com os dados do repositório que publica as versões.
type Config struct {
	ManifestoAtualizacao    string   `json:"manifestoAtualizacao"`
	ChavePublicaAtualizacao string   `json:"chavePublicaAtualizacao"`
	IDsPermitidos           []string `json:"idsPermitidos"`
	Navegador               string   `json:"navegador"`
	Plataforma              string   `json:"plataforma"`

	pasta string
}

// Valores gravados na compilação pelo CI (-ldflags -X), usados quando o
// arquivo de configuração não traz os campos.
var (
	manifestoPadrao    = ""
	chavePublicaPadrao = ""
	idsPadrao          = ""
)

func carregarConfig() (*Config, error) {
	exe, err := os.Executable()
	if err != nil {
		return nil, err
	}
	exe, _ = filepath.EvalSymlinks(exe)
	cfg := &Config{pasta: filepath.Dir(exe)}
	if dados, err := os.ReadFile(filepath.Join(cfg.pasta, "terra-ajudante.json")); err == nil {
		dados = bytes.TrimPrefix(dados, []byte("\xef\xbb\xbf")) // tolera BOM do Bloco de Notas
		if err := json.Unmarshal(dados, cfg); err != nil {
			return nil, err
		}
	}
	if cfg.ManifestoAtualizacao == "" {
		cfg.ManifestoAtualizacao = manifestoPadrao
	}
	if cfg.ChavePublicaAtualizacao == "" {
		cfg.ChavePublicaAtualizacao = chavePublicaPadrao
	}
	if len(cfg.IDsPermitidos) == 0 && idsPadrao != "" {
		cfg.IDsPermitidos = strings.Split(idsPadrao, ",")
	}
	if cfg.Plataforma == "" {
		cfg.Plataforma = runtime.GOOS + "-" + map[string]string{"amd64": "x64", "arm64": "arm64", "386": "x86"}[runtime.GOARCH]
		cfg.Plataforma = strings.Replace(cfg.Plataforma, "darwin", "macos", 1)
	}
	return cfg, nil
}

func (c *Config) chavePublica() (ed25519.PublicKey, error) {
	b, err := base64.StdEncoding.DecodeString(strings.TrimSpace(c.ChavePublicaAtualizacao))
	if err != nil || len(b) != ed25519.PublicKeySize {
		return nil, errors.New("chave pública de atualização não configurada")
	}
	return ed25519.PublicKey(b), nil
}

// versaoInstalada é gravada pelo instalador em versao.txt.
func (c *Config) versaoInstalada() string {
	b, err := os.ReadFile(filepath.Join(c.pasta, "versao.txt"))
	if err != nil {
		return "0"
	}
	return strings.TrimSpace(string(b))
}

func (c *Config) idPermitido(id string) bool {
	for _, p := range c.IDsPermitidos {
		if strings.TrimSpace(p) == id {
			return true
		}
	}
	return false
}

func (c *Config) pastaDados() string {
	if base := pastaDadosSistema(); base != "" {
		return filepath.Join(base, "TerraDaLuz")
	}
	return filepath.Join(os.TempDir(), "TerraDaLuz")
}

func (c *Config) caminhoNavegador() (string, error) {
	if c.Navegador != "" {
		p := c.Navegador
		if !filepath.IsAbs(p) {
			p = filepath.Join(c.pasta, p)
		}
		if _, err := os.Stat(p); err == nil {
			return filepath.Clean(p), nil
		}
	}
	for _, p := range candidatosNavegador(c.pasta) {
		if _, err := os.Stat(p); err == nil {
			return p, nil
		}
	}
	return "", errors.New("não encontrei o executável do Terra da Luz")
}
