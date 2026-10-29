// terra-ferramentas: utilitários de publicação do Terra da Luz, usados pelo
// GitHub Actions (e por quem mantém o projeto).
//
//	gerar-chaves        --saida chaves/
//	empacotar-crx       --pasta extensoes/nucleo --chave chaves/nucleo.pem --saida nucleo.crx
//	manifesto-extensoes --url-base https://.../extensoes/ --saida atualizacoes.xml id:versao:arquivo.crx ...
//	assinar-manifesto   --chave chaves/atualizacao.key --versao V --url-base https://... --saida estavel.json windows-x64=Setup.exe ...
package main

import (
	"archive/zip"
	"bytes"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"errors"
	"flag"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"terradaluz.br/ajudante/internal/assinatura"
	"terradaluz.br/ajudante/internal/crx"
)

func main() {
	if len(os.Args) < 2 {
		uso()
	}
	var err error
	switch os.Args[1] {
	case "gerar-chaves":
		err = gerarChaves(os.Args[2:])
	case "empacotar-crx":
		err = empacotarCRX(os.Args[2:])
	case "manifesto-extensoes":
		err = manifestoExtensoes(os.Args[2:])
	case "assinar-manifesto":
		err = assinarManifesto(os.Args[2:])
	case "id":
		err = mostrarID(os.Args[2:])
	default:
		uso()
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "erro:", err)
		os.Exit(1)
	}
}

func uso() {
	fmt.Fprintln(os.Stderr, "uso: terra-ferramentas gerar-chaves|empacotar-crx|manifesto-extensoes|assinar-manifesto|id ...")
	os.Exit(2)
}

// ---------------- chaves ----------------

var extensoesEmbutidas = []string{"nucleo", "tema", "ublock"}

func gerarChaves(args []string) error {
	f := flag.NewFlagSet("gerar-chaves", flag.ExitOnError)
	saida := f.String("saida", "chaves", "pasta onde gravar as chaves")
	f.Parse(args)
	if err := os.MkdirAll(*saida, 0o700); err != nil {
		return err
	}
	publico := map[string]any{}
	ids := map[string]string{}
	chavesManifesto := map[string]string{}
	for _, nome := range extensoesEmbutidas {
		caminho := filepath.Join(*saida, nome+".pem")
		priv, err := lerOuCriarRSA(caminho)
		if err != nil {
			return err
		}
		der, _ := crx.ChavePublicaDER(priv)
		ids[nome] = crx.ID(der)
		chavesManifesto[nome] = base64.StdEncoding.EncodeToString(der)
	}
	caminhoAtt := filepath.Join(*saida, "atualizacao.key")
	var pub ed25519.PublicKey
	if b, err := os.ReadFile(caminhoAtt); err == nil {
		semente, err := base64.StdEncoding.DecodeString(strings.TrimSpace(string(b)))
		if err != nil || len(semente) != ed25519.SeedSize {
			return errors.New("atualizacao.key inválida")
		}
		pub = ed25519.NewKeyFromSeed(semente).Public().(ed25519.PublicKey)
	} else {
		p, priv, _ := ed25519.GenerateKey(rand.Reader)
		pub = p
		if err := os.WriteFile(caminhoAtt, []byte(base64.StdEncoding.EncodeToString(priv.Seed())+"\n"), 0o600); err != nil {
			return err
		}
	}
	publico["ids"] = ids
	publico["chavesManifesto"] = chavesManifesto
	publico["chavePublicaAtualizacao"] = base64.StdEncoding.EncodeToString(pub)
	dados, _ := json.MarshalIndent(publico, "", "  ")
	if err := os.WriteFile(filepath.Join(*saida, "publico.json"), append(dados, '\n'), 0o644); err != nil {
		return err
	}
	fmt.Println(string(dados))
	return nil
}

func lerOuCriarRSA(caminho string) (*rsa.PrivateKey, error) {
	if b, err := os.ReadFile(caminho); err == nil {
		return lerPEM(b)
	}
	priv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return nil, err
	}
	der, _ := x509.MarshalPKCS8PrivateKey(priv)
	return priv, os.WriteFile(caminho, pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: der}), 0o600)
}

func lerPEM(b []byte) (*rsa.PrivateKey, error) {
	bloco, _ := pem.Decode(b)
	if bloco == nil {
		return nil, errors.New("PEM inválido")
	}
	if k, err := x509.ParsePKCS8PrivateKey(bloco.Bytes); err == nil {
		if r, ok := k.(*rsa.PrivateKey); ok {
			return r, nil
		}
	}
	return x509.ParsePKCS1PrivateKey(bloco.Bytes)
}

func mostrarID(args []string) error {
	f := flag.NewFlagSet("id", flag.ExitOnError)
	chave := f.String("chave", "", "chave .pem")
	f.Parse(args)
	b, err := os.ReadFile(*chave)
	if err != nil {
		return err
	}
	priv, err := lerPEM(b)
	if err != nil {
		return err
	}
	der, _ := crx.ChavePublicaDER(priv)
	fmt.Println(crx.ID(der))
	return nil
}

// ---------------- CRX ----------------

func zipDeterministico(pasta string) ([]byte, error) {
	var arquivos []string
	err := filepath.WalkDir(pasta, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		nome := d.Name()
		if d.IsDir() {
			if p != pasta && (strings.HasPrefix(nome, ".") || nome == "testes" || nome == "node_modules") {
				return filepath.SkipDir
			}
			return nil
		}
		if strings.HasPrefix(nome, ".") || strings.HasSuffix(nome, ".pem") {
			return nil
		}
		arquivos = append(arquivos, p)
		return nil
	})
	if err != nil {
		return nil, err
	}
	sort.Strings(arquivos)
	var buf bytes.Buffer
	z := zip.NewWriter(&buf)
	data := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	for _, p := range arquivos {
		rel, _ := filepath.Rel(pasta, p)
		h := &zip.FileHeader{Name: filepath.ToSlash(rel), Method: zip.Deflate, Modified: data}
		w, err := z.CreateHeader(h)
		if err != nil {
			return nil, err
		}
		b, err := os.ReadFile(p)
		if err != nil {
			return nil, err
		}
		w.Write(b)
	}
	if err := z.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func empacotarCRX(args []string) error {
	f := flag.NewFlagSet("empacotar-crx", flag.ExitOnError)
	pasta := f.String("pasta", "", "pasta da extensão (com manifest.json)")
	chave := f.String("chave", "", "chave .pem")
	saida := f.String("saida", "", "arquivo .crx")
	f.Parse(args)
	if _, err := os.Stat(filepath.Join(*pasta, "manifest.json")); err != nil {
		return fmt.Errorf("manifest.json não encontrado em %s", *pasta)
	}
	b, err := os.ReadFile(*chave)
	if err != nil {
		return err
	}
	priv, err := lerPEM(b)
	if err != nil {
		return err
	}
	z, err := zipDeterministico(*pasta)
	if err != nil {
		return err
	}
	pacote, err := crx.Empacotar(z, priv)
	if err != nil {
		return err
	}
	id, _, err := crx.Verificar(pacote)
	if err != nil {
		return err
	}
	if err := os.WriteFile(*saida, pacote, 0o644); err != nil {
		return err
	}
	fmt.Printf("%s %s (%d bytes)\n", id, *saida, len(pacote))
	return nil
}

// manifestoExtensoes gera o XML no formato "gupdate" que o Chromium consulta
// para atualizar extensões instaladas por política.
func manifestoExtensoes(args []string) error {
	f := flag.NewFlagSet("manifesto-extensoes", flag.ExitOnError)
	base := f.String("url-base", "", "endereço público onde ficam os .crx (terminando em /)")
	saida := f.String("saida", "atualizacoes.xml", "arquivo de saída")
	f.Parse(args)
	if !strings.HasPrefix(*base, "https://") {
		return errors.New("--url-base precisa ser https")
	}
	var b strings.Builder
	b.WriteString("<?xml version='1.0' encoding='UTF-8'?>\n<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>\n")
	for _, item := range f.Args() {
		partes := strings.SplitN(item, ":", 3)
		if len(partes) != 3 {
			return fmt.Errorf("item inválido %q (use id:versao:arquivo.crx)", item)
		}
		fmt.Fprintf(&b, "  <app appid='%s'>\n    <updatecheck codebase='%s%s' version='%s' />\n  </app>\n",
			partes[0], strings.TrimSuffix(*base, "/")+"/", filepath.Base(partes[2]), partes[1])
	}
	b.WriteString("</gupdate>\n")
	return os.WriteFile(*saida, []byte(b.String()), 0o644)
}

// ---------------- manifesto de atualização do navegador ----------------

func assinarManifesto(args []string) error {
	f := flag.NewFlagSet("assinar-manifesto", flag.ExitOnError)
	chave := f.String("chave", "", "chave Ed25519 (atualizacao.key)")
	versao := f.String("versao", "", "versão publicada")
	notas := f.String("notas", "", "notas da versão")
	base := f.String("url-base", "", "endereço onde os instaladores ficam (terminando em /)")
	saida := f.String("saida", "estavel.json", "arquivo de saída")
	f.Parse(args)
	b, err := os.ReadFile(*chave)
	if err != nil {
		return err
	}
	semente, err := base64.StdEncoding.DecodeString(strings.TrimSpace(string(b)))
	if err != nil || len(semente) != ed25519.SeedSize {
		return errors.New("chave de atualização inválida")
	}
	if *versao == "" || !strings.HasPrefix(*base, "https://") {
		return errors.New("--versao e --url-base (https) são obrigatórios")
	}
	m := assinatura.Manifesto{
		Produto: "Terra da Luz", Versao: *versao, Notas: *notas,
		Publicado: time.Now().UTC().Format(time.RFC3339), Arquivos: map[string]assinatura.Arquivo{},
	}
	for _, item := range f.Args() {
		plataforma, arquivo, ok := strings.Cut(item, "=")
		if !ok {
			return fmt.Errorf("item inválido %q (use plataforma=arquivo)", item)
		}
		dados, err := os.ReadFile(arquivo)
		if err != nil {
			return err
		}
		soma := sha256.Sum256(dados)
		m.Arquivos[plataforma] = assinatura.Arquivo{
			URL:     strings.TrimSuffix(*base, "/") + "/" + filepath.Base(arquivo),
			SHA256:  hex.EncodeToString(soma[:]),
			Tamanho: int64(len(dados)),
		}
	}
	if err := m.Assinar(ed25519.NewKeyFromSeed(semente)); err != nil {
		return err
	}
	dados, _ := json.MarshalIndent(m, "", "  ")
	return os.WriteFile(*saida, append(dados, '\n'), 0o644)
}
