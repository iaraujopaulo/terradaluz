package main

import (
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/url"
	"regexp"
	"strings"
)

const tamanhoMaximoMensagem = 1 << 20 // o navegador aceita até 1 MB do host

type pedido struct {
	Comando   string          `json:"comando"`
	URL       string          `json:"url"`
	Agora     bool            `json:"agora"`
	Conteiner json.RawMessage `json:"conteiner"`
}

type conteiner struct {
	ID   string `json:"id"`
	Nome string `json:"nome"`
	Cor  string `json:"cor"`
}

var (
	reIDExtensao  = regexp.MustCompile(`^[a-p]{32}$`)
	reIDConteiner = regexp.MustCompile(`^[a-z0-9-]{1,60}$`)
	reCor         = regexp.MustCompile(`^#[0-9A-Fa-f]{6}$`)
)

func origemParaID(origem string) (string, error) {
	id := strings.TrimSuffix(strings.TrimPrefix(origem, "chrome-extension://"), "/")
	if !reIDExtensao.MatchString(id) {
		return "", errors.New("origem inválida")
	}
	return id, nil
}

// servirMensagens implementa o protocolo de mensagens nativas do Chromium:
// cada mensagem é um JSON precedido de 4 bytes com o tamanho (ordem nativa,
// little-endian em x86/ARM).
func servirMensagens(cfg *Config, origem string, entrada io.Reader, saida io.Writer) error {
	idExt, err := origemParaID(origem)
	if err != nil {
		return err
	}
	// O navegador já só permite as origens listadas no manifesto do host;
	// conferimos de novo por segurança.
	if len(cfg.IDsPermitidos) > 0 && !cfg.idPermitido(idExt) {
		escrever(saida, map[string]any{"ok": false, "erro": "extensão não autorizada"})
		return fmt.Errorf("extensão não autorizada: %s", idExt)
	}
	for {
		var tam uint32
		if err := binary.Read(entrada, binary.LittleEndian, &tam); err != nil {
			return err
		}
		if tam == 0 || tam > tamanhoMaximoMensagem {
			return fmt.Errorf("tamanho de mensagem inválido: %d", tam)
		}
		buf := make([]byte, tam)
		if _, err := io.ReadFull(entrada, buf); err != nil {
			return err
		}
		var p pedido
		var resposta map[string]any
		if err := json.Unmarshal(buf, &p); err != nil {
			resposta = map[string]any{"ok": false, "erro": "mensagem inválida"}
		} else {
			resposta = tratar(cfg, idExt, p)
		}
		if err := escrever(saida, resposta); err != nil {
			return err
		}
	}
}

func escrever(saida io.Writer, v any) error {
	dados, err := json.Marshal(v)
	if err != nil {
		return err
	}
	if err := binary.Write(saida, binary.LittleEndian, uint32(len(dados))); err != nil {
		return err
	}
	_, err = saida.Write(dados)
	return err
}

func falha(err error) map[string]any {
	return map[string]any{"ok": false, "erro": err.Error()}
}

func tratar(cfg *Config, idExt string, p pedido) map[string]any {
	switch p.Comando {
	case "versao":
		disponivel, versaoIE := modoIEDisponivel()
		return map[string]any{
			"ok": true, "versao": versaoAjudante, "navegador": cfg.versaoInstalada(),
			"plataforma": cfg.Plataforma, "modoIE": disponivel, "versaoIE": versaoIE,
		}

	case "abrirIE":
		u, err := validarURL(p.URL, true)
		if err != nil {
			return falha(err)
		}
		if err := abrirModoIE(cfg, u); err != nil {
			log.Println("modo IE:", err)
			return falha(err)
		}
		return map[string]any{"ok": true}

	case "abrirConteiner":
		var c conteiner
		if err := json.Unmarshal(p.Conteiner, &c); err != nil || !reIDConteiner.MatchString(c.ID) || !reCor.MatchString(c.Cor) {
			return falha(errors.New("contêiner inválido"))
		}
		nome := []rune(strings.TrimSpace(c.Nome))
		if len(nome) == 0 || len(nome) > 40 {
			return falha(errors.New("nome de contêiner inválido"))
		}
		destino := ""
		if p.URL != "" {
			u, err := validarURL(p.URL, false)
			if err != nil {
				return falha(err)
			}
			destino = u
		}
		frag := url.Values{"id": {c.ID}, "nome": {string(nome)}, "cor": {c.Cor}, "destino": {destino}}
		entrada := "chrome-extension://" + idExt + "/paginas/conteiner.html#" + frag.Encode()
		if err := iniciarNavegador(cfg, "--profile-directory=Conteiner-"+c.ID, entrada); err != nil {
			return falha(err)
		}
		return map[string]any{"ok": true}

	case "verificarAtualizacao":
		r, err := verificarAtualizacao(cfg)
		if err != nil {
			return falha(err)
		}
		return map[string]any{"ok": true, "disponivel": r.Disponivel, "novaVersao": r.NovaVersao, "versaoAtual": r.VersaoAtual, "notas": r.Notas}

	case "instalarAtualizacao":
		r, err := prepararInstalacaoImediata(cfg, p.Agora)
		if err != nil {
			return falha(err)
		}
		return r

	default:
		return falha(fmt.Errorf("comando desconhecido: %q", p.Comando))
	}
}

func validarURL(bruta string, aceitarArquivo bool) (string, error) {
	u, err := url.Parse(strings.TrimSpace(bruta))
	if err != nil || len(bruta) > 8192 {
		return "", errors.New("endereço inválido")
	}
	switch u.Scheme {
	case "http", "https":
		if u.Host == "" {
			return "", errors.New("endereço inválido")
		}
	case "file":
		if !aceitarArquivo {
			return "", errors.New("endereço inválido")
		}
	default:
		return "", errors.New("só endereços http, https ou de arquivo podem ser abertos")
	}
	return u.String(), nil
}
