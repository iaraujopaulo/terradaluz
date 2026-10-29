// Pacote assinatura define o manifesto de atualização do Terra da Luz e a
// assinatura digital (Ed25519) que garante que o pacote veio do projeto.
package assinatura

import (
	"crypto/ed25519"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"unicode"
)

// Arquivo descreve um instalador para uma plataforma.
type Arquivo struct {
	URL     string `json:"url"`
	SHA256  string `json:"sha256"`
	Tamanho int64  `json:"tamanho"`
}

// Manifesto é publicado pelo projeto a cada versão (ex.: atualizacoes/estavel.json).
type Manifesto struct {
	Produto    string             `json:"produto"`
	Versao     string             `json:"versao"`
	Publicado  string             `json:"publicado"`
	Notas      string             `json:"notas"`
	Arquivos   map[string]Arquivo `json:"arquivos"`
	Assinatura string             `json:"assinatura,omitempty"`
}

// BytesCanonicos devolve os bytes que são assinados: o manifesto sem o campo
// de assinatura, serializado pelo Go (ordem de campos fixa e mapas ordenados).
func (m Manifesto) BytesCanonicos() ([]byte, error) {
	m.Assinatura = ""
	return json.Marshal(m)
}

func (m *Manifesto) Assinar(privada ed25519.PrivateKey) error {
	b, err := m.BytesCanonicos()
	if err != nil {
		return err
	}
	m.Assinatura = base64.StdEncoding.EncodeToString(ed25519.Sign(privada, b))
	return nil
}

var ErrAssinaturaInvalida = errors.New("assinatura do manifesto de atualização inválida")

func (m Manifesto) Verificar(publica ed25519.PublicKey) error {
	if len(publica) != ed25519.PublicKeySize {
		return errors.New("chave pública de atualização ausente ou inválida")
	}
	sig, err := base64.StdEncoding.DecodeString(m.Assinatura)
	if err != nil || len(sig) != ed25519.SignatureSize {
		return ErrAssinaturaInvalida
	}
	b, err := m.BytesCanonicos()
	if err != nil {
		return err
	}
	if !ed25519.Verify(publica, b, sig) {
		return ErrAssinaturaInvalida
	}
	return nil
}

// Ler interpreta e verifica um manifesto vindo da rede.
func Ler(dados []byte, publica ed25519.PublicKey) (*Manifesto, error) {
	var m Manifesto
	if err := json.Unmarshal(dados, &m); err != nil {
		return nil, fmt.Errorf("manifesto mal formado: %w", err)
	}
	if err := m.Verificar(publica); err != nil {
		return nil, err
	}
	return &m, nil
}

// CompararVersoes compara "156.0.8078.73-1.2" com outra versão, número a
// número. Devolve <0, 0 ou >0.
func CompararVersoes(a, b string) int {
	pa, pb := numeros(a), numeros(b)
	for i := 0; i < len(pa) || i < len(pb); i++ {
		var x, y int
		if i < len(pa) {
			x = pa[i]
		}
		if i < len(pb) {
			y = pb[i]
		}
		if x != y {
			if x < y {
				return -1
			}
			return 1
		}
	}
	return 0
}

func numeros(v string) []int {
	campos := strings.FieldsFunc(v, func(r rune) bool { return !unicode.IsDigit(r) })
	out := make([]int, 0, len(campos))
	for _, c := range campos {
		n, err := strconv.Atoi(c)
		if err != nil {
			n = 0
		}
		out = append(out, n)
	}
	return out
}
