//go:build windows

package main

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"unsafe"
)

const (
	detachedProcess       = 0x00000008
	createNewProcessGroup = 0x00000200
	createNoWindow        = 0x08000000
)

func pastaDadosSistema() string {
	local := os.Getenv("LOCALAPPDATA")
	// A tarefa agendada roda como SYSTEM: os downloads ficam ao lado do
	// ajudante, em Arquivos de Programas, onde só administradores escrevem.
	if local == "" || strings.Contains(strings.ToLower(local), `\systemprofile\`) {
		if exe, err := os.Executable(); err == nil {
			return filepath.Dir(exe)
		}
		return os.Getenv("ProgramData")
	}
	return local
}

func extensaoInstalador() string { return ".exe" }

func candidatosNavegador(pasta string) []string {
	c := []string{
		filepath.Join(pasta, "..", "Application", "chrome.exe"),
		filepath.Join(pasta, "..", "chrome.exe"),
		filepath.Join(pasta, "chrome.exe"),
	}
	for _, base := range []string{os.Getenv("ProgramFiles"), os.Getenv("LOCALAPPDATA")} {
		if base != "" {
			c = append(c, filepath.Join(base, "TerraDaLuz", "Application", "chrome.exe"))
		}
	}
	for i := range c {
		c[i] = filepath.Clean(c[i])
	}
	return c
}

func modoIEDisponivel() (bool, string) {
	exe, _ := os.Executable()
	host := filepath.Join(filepath.Dir(exe), "TerraIE.exe")
	mshtml := filepath.Join(os.Getenv("SystemRoot"), "System32", "mshtml.dll")
	_, e1 := os.Stat(host)
	_, e2 := os.Stat(mshtml)
	if e1 != nil || e2 != nil {
		return false, ""
	}
	return true, "11"
}

func abrirModoIE(cfg *Config, url string) error {
	ok, _ := modoIEDisponivel()
	if !ok {
		return errors.New("o componente do modo Internet Explorer não está instalado")
	}
	host := filepath.Join(cfg.pasta, "TerraIE.exe")
	return iniciarDesanexado(host, url)
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
	cmd.SysProcAttr = &syscall.SysProcAttr{CreationFlags: detachedProcess | createNewProcessGroup}
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
	script := fmt.Sprintf(`@(Get-Process -Name chrome -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq '%s' }).Count`,
		strings.ReplaceAll(exe, "'", "''"))
	cmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-Command", script)
	cmd.SysProcAttr = &syscall.SysProcAttr{CreationFlags: createNoWindow, HideWindow: true}
	saida, err := cmd.Output()
	if err != nil {
		return true // na dúvida, não instalar por cima do navegador aberto
	}
	return strings.TrimSpace(string(saida)) != "0"
}

var argumentosInstalador = []string{"/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART", "/SP-", "/CLOSEAPPLICATIONS"}

func executarInstalador(cfg *Config, caminho string, elevar bool) error {
	if !elevar {
		cmd := exec.Command(caminho, argumentosInstalador...)
		cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
		return cmd.Run()
	}
	return executarComoAdministrador(caminho, strings.Join(argumentosInstalador, " "))
}

// ---- ShellExecuteExW com o verbo "runas" (pede permissão pelo UAC) ----

type shellExecuteInfo struct {
	cbSize       uint32
	fMask        uint32
	hwnd         uintptr
	lpVerb       *uint16
	lpFile       *uint16
	lpParameters *uint16
	lpDirectory  *uint16
	nShow        int32
	hInstApp     uintptr
	lpIDList     uintptr
	lpClass      *uint16
	hkeyClass    uintptr
	dwHotKey     uint32
	hIconMonitor uintptr
	hProcess     syscall.Handle
}

const (
	seeMaskNoCloseProcess = 0x00000040
	seeMaskNoAsync        = 0x00000100
	swHide                = 0
)

var procShellExecuteEx = syscall.NewLazyDLL("shell32.dll").NewProc("ShellExecuteExW")

func executarComoAdministrador(arquivo, parametros string) error {
	verbo, _ := syscall.UTF16PtrFromString("runas")
	arq, _ := syscall.UTF16PtrFromString(arquivo)
	par, _ := syscall.UTF16PtrFromString(parametros)
	info := shellExecuteInfo{fMask: seeMaskNoCloseProcess | seeMaskNoAsync, lpVerb: verbo, lpFile: arq, lpParameters: par, nShow: swHide}
	info.cbSize = uint32(unsafe.Sizeof(info))
	r, _, err := procShellExecuteEx.Call(uintptr(unsafe.Pointer(&info)))
	if r == 0 {
		return fmt.Errorf("não foi possível iniciar o instalador como administrador: %v", err)
	}
	if info.hProcess == 0 {
		return nil
	}
	defer syscall.CloseHandle(info.hProcess)
	if _, err := syscall.WaitForSingleObject(info.hProcess, syscall.INFINITE); err != nil {
		return err
	}
	var codigo uint32
	if err := syscall.GetExitCodeProcess(info.hProcess, &codigo); err != nil {
		return err
	}
	if codigo != 0 {
		return fmt.Errorf("o instalador terminou com o código %d", codigo)
	}
	return nil
}

func registrarHost(id string, sistema bool) error {
	return errors.New("no Windows o host é registrado pelo instalador do Terra da Luz")
}

func gerenciadoPeloSistema() bool { return false }
