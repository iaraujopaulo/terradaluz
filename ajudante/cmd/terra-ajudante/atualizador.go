package main

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"terradaluz.br/ajudante/internal/assinatura"
)

type resultadoVerificacao struct {
	Disponivel  bool
	NovaVersao  string
	VersaoAtual string
	Notas       string
	arquivo     assinatura.Arquivo
}

var cliente = &http.Client{Timeout: 30 * time.Second}

func baixarManifesto(cfg *Config) (*assinatura.Manifesto, error) {
	if !strings.HasPrefix(cfg.ManifestoAtualizacao, "https://") {
		return nil, errors.New("endereço de atualização não configurado (precisa ser https)")
	}
	pub, err := cfg.chavePublica()
	if err != nil {
		return nil, err
	}
	req, _ := http.NewRequest("GET", cfg.ManifestoAtualizacao, nil)
	req.Header.Set("User-Agent", "TerraDaLuz-Atualizador/"+versaoAjudante)
	req.Header.Set("Cache-Control", "no-cache")
	resp, err := cliente.Do(req)
	if err != nil {
		return nil, fmt.Errorf("sem conexão com o servidor de atualizações: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("servidor de atualizações respondeu %d", resp.StatusCode)
	}
	dados, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, err
	}
	return assinatura.Ler(dados, pub)
}

func verificarAtualizacao(cfg *Config) (*resultadoVerificacao, error) {
	m, err := baixarManifesto(cfg)
	if err != nil {
		return nil, err
	}
	r := &resultadoVerificacao{VersaoAtual: cfg.versaoInstalada(), NovaVersao: m.Versao, Notas: m.Notas}
	arq, ok := m.Arquivos[cfg.Plataforma]
	if !ok {
		return r, nil // ainda não há pacote para esta plataforma
	}
	r.arquivo = arq
	r.Disponivel = assinatura.CompararVersoes(m.Versao, r.VersaoAtual) > 0
	return r, nil
}

func pastaDownloads(cfg *Config) string {
	return filepath.Join(cfg.pastaDados(), "Atualizacoes")
}

// baixar grava o instalador e confere tamanho e SHA-256 do manifesto assinado.
func baixar(cfg *Config, arq assinatura.Arquivo, versao string) (string, error) {
	if !strings.HasPrefix(arq.URL, "https://") {
		return "", errors.New("pacote de atualização sem https")
	}
	dir := pastaDownloads(cfg)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	nome := filepath.Base(arq.URL)
	if nome == "" || nome == "." || strings.ContainsAny(nome, `\/:*?"<>|`) {
		nome = "TerraDaLuz-" + versao + extensaoInstalador()
	}
	destino := filepath.Join(dir, nome)
	if conferirArquivo(destino, arq.SHA256, arq.Tamanho) == nil {
		return destino, nil // já baixado antes
	}
	baixador := &http.Client{Timeout: 60 * time.Minute}
	resp, err := baixador.Get(arq.URL)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("download respondeu %d", resp.StatusCode)
	}
	tmp := destino + ".parcial"
	f, err := os.Create(tmp)
	if err != nil {
		return "", err
	}
	h := sha256.New()
	n, err := io.Copy(io.MultiWriter(f, h), io.LimitReader(resp.Body, arq.Tamanho+1))
	f.Close()
	if err != nil {
		os.Remove(tmp)
		return "", err
	}
	if n != arq.Tamanho || !strings.EqualFold(hex.EncodeToString(h.Sum(nil)), arq.SHA256) {
		os.Remove(tmp)
		return "", errors.New("o pacote baixado não confere com a assinatura; download descartado")
	}
	if err := os.Rename(tmp, destino); err != nil {
		return "", err
	}
	return destino, nil
}

func conferirArquivo(caminho, shaEsperado string, tamanho int64) error {
	f, err := os.Open(caminho)
	if err != nil {
		return err
	}
	defer f.Close()
	h := sha256.New()
	n, err := io.Copy(h, f)
	if err != nil {
		return err
	}
	if tamanho > 0 && n != tamanho {
		return errors.New("tamanho diferente")
	}
	if !strings.EqualFold(hex.EncodeToString(h.Sum(nil)), shaEsperado) {
		return errors.New("SHA-256 diferente")
	}
	return nil
}

// atualizarAutomaticamente é chamada pela tarefa agendada (Windows: conta
// SYSTEM; Linux: timer do systemd do usuário).
func atualizarAutomaticamente(cfg *Config) error {
	if gerenciadoPeloSistema() {
		log.Println("atualizações instaladas pelo Flatpak; nada a fazer")
		return nil
	}
	r, err := verificarAtualizacao(cfg)
	if err != nil {
		return err
	}
	if !r.Disponivel {
		log.Printf("sem atualização (instalada %s, publicada %s)", r.VersaoAtual, r.NovaVersao)
		return nil
	}
	caminho, err := baixar(cfg, r.arquivo, r.NovaVersao)
	if err != nil {
		return err
	}
	if navegadorAberto(cfg) {
		log.Printf("versão %s baixada; será instalada quando o navegador for fechado", r.NovaVersao)
		return nil
	}
	log.Printf("instalando versão %s", r.NovaVersao)
	return executarInstalador(cfg, caminho, false)
}

// prepararInstalacaoImediata é pedida pelo Painel ("Instalar e reiniciar").
// Baixa e confere o pacote; depois um processo separado espera o navegador
// fechar, instala e abre o navegador de novo.
func prepararInstalacaoImediata(cfg *Config, agora bool) (map[string]any, error) {
	r, err := verificarAtualizacao(cfg)
	if err != nil {
		return nil, err
	}
	if !r.Disponivel {
		return map[string]any{"ok": true, "reiniciando": false, "mensagem": "Você já está na versão mais recente."}, nil
	}
	if gerenciadoPeloSistema() {
		return map[string]any{"ok": true, "reiniciando": false, "mensagem": "Abra a central de programas do Linux (ou rode \"flatpak update\") para instalar a versão " + r.NovaVersao + "."}, nil
	}
	caminho, err := baixar(cfg, r.arquivo, r.NovaVersao)
	if err != nil {
		return nil, err
	}
	if !agora {
		return map[string]any{"ok": true, "reiniciando": false, "mensagem": "Atualização baixada. Ela será instalada quando você fechar o navegador."}, nil
	}
	exe, _ := os.Executable()
	err = iniciarDesanexado(exe, "aplicar", "--arquivo", caminho, "--sha256", r.arquivo.SHA256, "--reabrir", "--elevar")
	if err != nil {
		return nil, err
	}
	return map[string]any{"ok": true, "reiniciando": true}, nil
}

func aplicarQuandoFechar(cfg *Config, caminho, sha string, reabrir, elevar bool) error {
	if caminho == "" || sha == "" {
		return errors.New("arquivo e sha256 são obrigatórios")
	}
	limite := time.Now().Add(15 * time.Minute)
	for navegadorAberto(cfg) {
		if time.Now().After(limite) {
			return errors.New("o navegador não foi fechado; a atualização fica para depois")
		}
		time.Sleep(2 * time.Second)
	}
	// confere de novo logo antes de executar
	if err := conferirArquivo(caminho, sha, 0); err != nil {
		return fmt.Errorf("instalador alterado depois do download: %w", err)
	}
	if err := executarInstalador(cfg, caminho, elevar); err != nil {
		return err
	}
	if reabrir {
		time.Sleep(2 * time.Second)
		return iniciarNavegador(cfg, "--restore-last-session")
	}
	return nil
}
