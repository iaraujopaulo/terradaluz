package crx

import (
	"archive/zip"
	"bytes"
	"crypto/rand"
	"crypto/rsa"
	"testing"
)

func zipDeTeste(t *testing.T) []byte {
	var b bytes.Buffer
	z := zip.NewWriter(&b)
	w, _ := z.Create("manifest.json")
	w.Write([]byte(`{"manifest_version":3,"name":"t","version":"1"}`))
	z.Close()
	return b.Bytes()
}

func TestEmpacotarEVerificar(t *testing.T) {
	priv, _ := rsa.GenerateKey(rand.Reader, 2048)
	z := zipDeTeste(t)
	pacote, err := Empacotar(z, priv)
	if err != nil {
		t.Fatal(err)
	}
	id, conteudo, err := Verificar(pacote)
	if err != nil {
		t.Fatal(err)
	}
	pub, _ := ChavePublicaDER(priv)
	if id != ID(pub) || len(id) != 32 {
		t.Fatalf("id inesperado %q", id)
	}
	if !bytes.Equal(conteudo, z) {
		t.Fatal("zip alterado")
	}
	// adulterar o zip invalida a assinatura
	pacote[len(pacote)-5] ^= 0xff
	if _, _, err := Verificar(pacote); err == nil {
		t.Fatal("pacote adulterado foi aceito")
	}
}

// ID conhecido: a chave pública do exemplo da documentação do Chromium gera
// sempre o mesmo ID; aqui conferimos só o alfabeto a-p.
func TestAlfabetoID(t *testing.T) {
	id := ID([]byte("qualquer coisa"))
	for _, c := range id {
		if c < 'a' || c > 'p' {
			t.Fatalf("caractere fora de a-p: %c", c)
		}
	}
}
