package assinatura

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/json"
	"testing"
)

func TestAssinarEVerificar(t *testing.T) {
	pub, priv, _ := ed25519.GenerateKey(rand.Reader)
	m := Manifesto{Produto: "Terra da Luz", Versao: "156.0.8078.73-1.0", Arquivos: map[string]Arquivo{
		"windows-x64": {URL: "https://exemplo/x.exe", SHA256: "ab", Tamanho: 10},
		"linux-x64":   {URL: "https://exemplo/x.AppImage", SHA256: "cd", Tamanho: 20},
	}}
	if err := m.Assinar(priv); err != nil {
		t.Fatal(err)
	}
	dados, _ := json.MarshalIndent(m, "", "  ") // formatação diferente não importa
	lido, err := Ler(dados, pub)
	if err != nil {
		t.Fatal(err)
	}
	if lido.Versao != m.Versao {
		t.Fatal("versão diferente")
	}
	lido.Arquivos["windows-x64"] = Arquivo{URL: "https://malicioso/x.exe", SHA256: "ab", Tamanho: 10}
	if lido.Verificar(pub) == nil {
		t.Fatal("manifesto adulterado foi aceito")
	}
	outra, _, _ := ed25519.GenerateKey(rand.Reader)
	if m.Verificar(outra) == nil {
		t.Fatal("aceitou chave errada")
	}
}

func TestCompararVersoes(t *testing.T) {
	casos := []struct {
		a, b string
		r    int
	}{
		{"156.0.8078.73-1.0", "156.0.8078.73-1.0", 0},
		{"156.0.8078.73-1.0", "156.0.8078.74-1.0", -1},
		{"157.0.1.1-1", "156.9.9.9-9", 1},
		{"156.0.8078.73-1.2", "156.0.8078.73-1.10", -1},
		{"156.0.8078.73", "156.0.8078.73-1", -1},
	}
	for _, c := range casos {
		if g := CompararVersoes(c.a, c.b); g != c.r {
			t.Errorf("%s vs %s = %d, esperado %d", c.a, c.b, g, c.r)
		}
	}
}
