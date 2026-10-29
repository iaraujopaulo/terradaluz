package main

import (
	"bytes"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"terradaluz.br/ajudante/internal/assinatura"
)

const idTeste = "abcdefghijklmnopabcdefghijklmnop"

func mensagem(v any) []byte {
	d, _ := json.Marshal(v)
	var b bytes.Buffer
	binary.Write(&b, binary.LittleEndian, uint32(len(d)))
	b.Write(d)
	return b.Bytes()
}

func lerRespostas(t *testing.T, r io.Reader) []map[string]any {
	var out []map[string]any
	for {
		var n uint32
		if binary.Read(r, binary.LittleEndian, &n) != nil {
			return out
		}
		b := make([]byte, n)
		io.ReadFull(r, b)
		var m map[string]any
		if err := json.Unmarshal(b, &m); err != nil {
			t.Fatal(err)
		}
		out = append(out, m)
	}
}

func TestProtocoloNativo(t *testing.T) {
	cfg := &Config{IDsPermitidos: []string{idTeste}, Plataforma: "linux-x64", pasta: t.TempDir()}
	var entrada bytes.Buffer
	entrada.Write(mensagem(map[string]any{"comando": "versao"}))
	entrada.Write(mensagem(map[string]any{"comando": "abrirIE", "url": "javascript:alert(1)"}))
	entrada.Write(mensagem(map[string]any{"comando": "abrirConteiner", "conteiner": map[string]string{"id": "../x", "nome": "a", "cor": "#ffffff"}}))
	entrada.Write(mensagem(map[string]any{"comando": "inexistente"}))
	var saida bytes.Buffer
	if err := servirMensagens(cfg, "chrome-extension://"+idTeste+"/", &entrada, &saida); err != io.EOF {
		t.Fatalf("esperava EOF, veio %v", err)
	}
	r := lerRespostas(t, &saida)
	if len(r) != 4 {
		t.Fatalf("esperava 4 respostas, veio %d", len(r))
	}
	if r[0]["ok"] != true || r[0]["versao"] != versaoAjudante {
		t.Errorf("versao: %v", r[0])
	}
	for i := 1; i < 4; i++ {
		if r[i]["ok"] != false {
			t.Errorf("resposta %d deveria falhar: %v", i, r[i])
		}
	}
}

func TestOrigemNaoAutorizada(t *testing.T) {
	cfg := &Config{IDsPermitidos: []string{idTeste}}
	var saida bytes.Buffer
	err := servirMensagens(cfg, "chrome-extension://pppppppppppppppppppppppppppppppp/", bytes.NewReader(mensagem(map[string]any{"comando": "versao"})), &saida)
	if err == nil {
		t.Fatal("aceitou extensão não autorizada")
	}
}

func TestVerificarEBaixarAtualizacao(t *testing.T) {
	pub, priv, _ := ed25519.GenerateKey(rand.Reader)
	pacote := []byte("instalador falso do Terra da Luz")
	soma := sha256.Sum256(pacote)
	var srv *httptest.Server
	srv = httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/estavel.json":
			m := assinatura.Manifesto{Produto: "Terra da Luz", Versao: "156.0.8078.73-2.0", Arquivos: map[string]assinatura.Arquivo{
				"linux-x64": {URL: srv.URL + "/TerraDaLuz.AppImage", SHA256: hex.EncodeToString(soma[:]), Tamanho: int64(len(pacote))},
			}}
			m.Assinar(priv)
			json.NewEncoder(w).Encode(m)
		case "/TerraDaLuz.AppImage":
			w.Write(pacote)
		}
	}))
	defer srv.Close()
	cliente = srv.Client()
	pasta := t.TempDir()
	os.WriteFile(filepath.Join(pasta, "versao.txt"), []byte("156.0.8078.73-1.0"), 0o644)
	t.Setenv("XDG_DATA_HOME", t.TempDir())
	cfg := &Config{ManifestoAtualizacao: srv.URL + "/estavel.json", ChavePublicaAtualizacao: base64.StdEncoding.EncodeToString(pub), Plataforma: "linux-x64", pasta: pasta}

	r, err := verificarAtualizacao(cfg)
	if err != nil {
		t.Fatal(err)
	}
	if !r.Disponivel || r.NovaVersao != "156.0.8078.73-2.0" {
		t.Fatalf("resultado inesperado %+v", r)
	}
	// baixar usa um cliente próprio; trocamos o transporte padrão para confiar no servidor de teste
	http.DefaultTransport = srv.Client().Transport
	caminho, err := baixar(cfg, r.arquivo, r.NovaVersao)
	if err != nil {
		t.Fatal(err)
	}
	if b, _ := os.ReadFile(caminho); !bytes.Equal(b, pacote) {
		t.Fatal("conteúdo baixado diferente")
	}
	// pacote com hash errado é descartado
	ruim := r.arquivo
	ruim.SHA256 = hex.EncodeToString(make([]byte, 32))
	os.Remove(caminho)
	if _, err := baixar(cfg, ruim, r.NovaVersao); err == nil {
		t.Fatal("aceitou pacote com SHA-256 errado")
	}
	// chave pública errada: manifesto rejeitado
	outra, _, _ := ed25519.GenerateKey(rand.Reader)
	cfg.ChavePublicaAtualizacao = base64.StdEncoding.EncodeToString(outra)
	if _, err := verificarAtualizacao(cfg); err == nil {
		t.Fatal("aceitou manifesto assinado por outra chave")
	}
}
