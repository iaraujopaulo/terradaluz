//go:build !windows

package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
)

func pastaDadosSistema() string {
	if d := os.Getenv("XDG_DATA_HOME"); d != "" {
		return d
	}
	if casa, err := os.UserHomeDir(); err == nil {
		if runtime.GOOS == "darwin" {
			return filepath.Join(casa, "Library", "Application Support")
		}
		return filepath.Join(casa, ".local", "share")
	}
	return ""
}

func extensaoInstalador() string {
	if runtime.GOOS == "darwin" {
		return ".pkg"
	}
	return ".flatpak"
}

// emFlatpak indica que o navegador roda como Flatpak: nesse caso quem instala
// as atualizações é o próprio Flatpak (central de programas ou "flatpak update").
func emFlatpak() bool {
	if os.Getenv("FLATPAK_ID") != "" {
		return true
	}
	_, err := os.Stat("/.flatpak-info")
	return err == nil
}

func candidatosNavegador(pasta string) []string {
	casa, _ := os.UserHomeDir()
	return []string{
		"/app/bin/terra-da-luz",
		filepath.Join(pasta, "TerraDaLuz.AppImage"),
		filepath.Join(pasta, "chrome"),
		filepath.Join(pasta, "..", "chrome"),
		"/opt/terra-da-luz/chrome",
		filepath.Join(casa, "Applications", "TerraDaLuz.AppImage"),
		"/Applications/Terra da Luz.app/Contents/MacOS/Terra da Luz",
	}
}

func modoIEDisponivel() (bool, string) { return false, "" }

func abrirModoIE(cfg *Config, url string) error {
	return errors.New("o modo Internet Explorer existe apenas no Windows")
}

func iniciarNavegador(cfg *Config, args ...string) error {
	exe, err := cfg.caminhoNavegador()
	if err != nil {
		return err
	}
	return iniciarDesanexado(exe, args...)
}

func iniciarDesanexado(exe string, args ...string) error {
	cmd := exec.Command(exe, args...)
	cmd.SysProcAttr = &syscall.SysProcAttr{Setsid: true}
	cmd.Stdin, cmd.Stdout, cmd.Stderr = nil, nil, nil
	if err := cmd.Start(); err != nil {
		return err
	}
	return cmd.Process.Release()
}

func navegadorAberto(cfg *Config) bool {
	exe, err := cfg.caminhoNavegador()
	if err != nil {
		return false
	}
	if runtime.GOOS != "linux" {
		return exec.Command("pgrep", "-f", exe).Run() == nil
	}
	entradas, _ := os.ReadDir("/proc")
	for _, e := range entradas {
		alvo, err := os.Readlink(filepath.Join("/proc", e.Name(), "exe"))
		if err == nil && (alvo == exe || strings.HasPrefix(alvo, "/tmp/.mount_TerraD")) {
			return true
		}
	}
	return false
}

// executarInstalador instala o pacote baixado.
//   - macOS: instalador .pkg (como administrador)
//   - Linux: Flatpak se atualiza sozinho; AppImage é trocado pelo novo
func executarInstalador(cfg *Config, caminho string, elevar bool) error {
	switch {
	case runtime.GOOS == "darwin" && strings.HasSuffix(caminho, ".pkg"):
		if os.Geteuid() == 0 {
			return exec.Command("/usr/sbin/installer", "-pkg", caminho, "-target", "/").Run()
		}
		// pede a senha de administrador na janela padrão do macOS
		script := fmt.Sprintf(`do shell script "/usr/sbin/installer -pkg " & quoted form of %q & " -target /" with administrator privileges`, caminho)
		return exec.Command("/usr/bin/osascript", "-e", script).Run()
	case emFlatpak():
		return errors.New("no Linux o Terra da Luz é atualizado pelo Flatpak: abra a central de programas ou rode \"flatpak update\"")
	case strings.HasSuffix(caminho, ".AppImage"):
		destino, err := cfg.caminhoNavegador()
		if err != nil {
			return err
		}
		tmp := destino + ".novo"
		if err := copiar(caminho, tmp); err != nil {
			return fmt.Errorf("sem permissão para atualizar %s: %w", destino, err)
		}
		if err := os.Chmod(tmp, 0o755); err != nil {
			return err
		}
		return os.Rename(tmp, destino)
	}
	return fmt.Errorf("formato de atualização não suportado nesta plataforma: %s", filepath.Base(caminho))
}

func copiar(de, para string) error {
	a, err := os.Open(de)
	if err != nil {
		return err
	}
	defer a.Close()
	b, err := os.Create(para)
	if err != nil {
		return err
	}
	if _, err := io.Copy(b, a); err != nil {
		b.Close()
		return err
	}
	return b.Close()
}

// registrarHost grava o manifesto do host de mensagens nativas.
func registrarHost(id string, sistema bool) error {
	if !reIDExtensao.MatchString(id) {
		return errors.New("ID de extensão inválido")
	}
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	var pasta string
	casa, _ := os.UserHomeDir()
	switch {
	case runtime.GOOS == "darwin" && sistema:
		pasta = "/Library/Application Support/Chromium/NativeMessagingHosts"
	case runtime.GOOS == "darwin":
		pasta = filepath.Join(casa, "Library", "Application Support", "Chromium", "NativeMessagingHosts")
	case sistema:
		pasta = "/etc/chromium/native-messaging-hosts"
	default:
		config := os.Getenv("XDG_CONFIG_HOME") // no Flatpak: ~/.var/app/<id>/config
		if config == "" {
			config = filepath.Join(casa, ".config")
		}
		pasta = filepath.Join(config, "chromium", "NativeMessagingHosts")
	}
	if err := os.MkdirAll(pasta, 0o755); err != nil {
		return err
	}
	manifesto := map[string]any{
		"name":            "br.terradaluz.ajudante",
		"description":     "Ajudante do navegador Terra da Luz",
		"path":            exe,
		"type":            "stdio",
		"allowed_origins": []string{"chrome-extension://" + id + "/"},
	}
	dados, _ := json.MarshalIndent(manifesto, "", "  ")
	caminho := filepath.Join(pasta, "br.terradaluz.ajudante.json")
	if err := os.WriteFile(caminho, dados, 0o644); err != nil {
		return err
	}
	return nil
}

func gerenciadoPeloSistema() bool { return runtime.GOOS == "linux" && emFlatpak() }
