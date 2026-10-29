// terra-ajudante: programa auxiliar do navegador Terra da Luz.
//
// Modos de uso:
//
//	terra-ajudante chrome-extension://<id>/   (iniciado pelo navegador: mensagens nativas)
//	terra-ajudante atualizar                  (tarefa agendada: verifica e instala atualizações)
//	terra-ajudante aplicar --arquivo X --sha256 Y [--reabrir]
//	terra-ajudante verificar                  (mostra se há versão nova)
//	terra-ajudante registrar-host <id>        (Linux/macOS: registra o host de mensagens nativas)
//	terra-ajudante versao
package main

import (
	"flag"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"
)

var versaoAjudante = "1.0.0" // substituída na compilação: -ldflags "-X main.versaoAjudante=..."

func main() {
	cfg, err := carregarConfig()
	if err != nil {
		fmt.Fprintln(os.Stderr, "erro na configuração:", err)
		os.Exit(2)
	}
	iniciarLog(cfg)

	if len(os.Args) > 1 && strings.HasPrefix(os.Args[1], "chrome-extension://") {
		if err := servirMensagens(cfg, os.Args[1], os.Stdin, os.Stdout); err != nil && err != io.EOF {
			log.Println("mensagens nativas:", err)
			os.Exit(1)
		}
		return
	}

	if len(os.Args) < 2 {
		ajuda()
		os.Exit(2)
	}
	switch os.Args[1] {
	case "versao", "--version", "-v":
		fmt.Printf("terra-ajudante %s · navegador %s · %s\n", versaoAjudante, cfg.versaoInstalada(), cfg.Plataforma)
	case "verificar":
		r, err := verificarAtualizacao(cfg)
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
		if r.Disponivel {
			fmt.Printf("Versão %s disponível (instalada: %s)\n", r.NovaVersao, r.VersaoAtual)
		} else {
			fmt.Printf("Você está na versão mais recente (%s)\n", r.VersaoAtual)
		}
	case "atualizar":
		if err := atualizarAutomaticamente(cfg); err != nil {
			log.Println("atualização automática:", err)
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
	case "aplicar":
		fs := flag.NewFlagSet("aplicar", flag.ExitOnError)
		arquivo := fs.String("arquivo", "", "instalador baixado")
		sha := fs.String("sha256", "", "SHA-256 esperado do instalador")
		reabrir := fs.Bool("reabrir", false, "abrir o navegador de novo depois de instalar")
		elevar := fs.Bool("elevar", false, "pedir permissão de administrador (Windows)")
		fs.Parse(os.Args[2:])
		if err := aplicarQuandoFechar(cfg, *arquivo, *sha, *reabrir, *elevar); err != nil {
			log.Println("aplicar atualização:", err)
			os.Exit(1)
		}
	case "registrar-host":
		if len(os.Args) < 3 {
			fmt.Fprintln(os.Stderr, "uso: terra-ajudante registrar-host <id-da-extensao> [--sistema]")
			os.Exit(2)
		}
		sistema := len(os.Args) > 3 && os.Args[3] == "--sistema"
		if err := registrarHost(os.Args[2], sistema); err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
	default:
		ajuda()
		os.Exit(2)
	}
}

func ajuda() {
	fmt.Fprintln(os.Stderr, `terra-ajudante — ajudante do navegador Terra da Luz
  verificar        mostra se há atualização
  atualizar        baixa, confere a assinatura e instala (usado pela tarefa agendada)
  versao           mostra as versões
  registrar-host   registra o host de mensagens nativas (Linux/macOS)`)
}

func iniciarLog(cfg *Config) {
	dir := cfg.pastaDados()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		log.SetOutput(io.Discard)
		return
	}
	caminho := filepath.Join(dir, "ajudante.log")
	if st, err := os.Stat(caminho); err == nil && st.Size() > 2<<20 {
		os.Rename(caminho, caminho+".antigo")
	}
	f, err := os.OpenFile(caminho, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		log.SetOutput(io.Discard)
		return
	}
	log.SetOutput(f)
	log.SetFlags(log.LstdFlags)
}
