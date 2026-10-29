// Pacote crx empacota extensões no formato CRX3 do Chromium, assinadas com
// RSA-SHA256, sem depender de ferramentas externas.
//
// Formato:
//
//	"Cr24" | uint32 LE 3 | uint32 LE tamanho_cabecalho | CrxFileHeader (protobuf) | ZIP
//
//	message CrxFileHeader {
//	  repeated AsymmetricKeyProof sha256_with_rsa = 2;
//	  optional bytes signed_header_data = 10000;   // SignedData serializado
//	}
//	message AsymmetricKeyProof { optional bytes public_key = 1; optional bytes signature = 2; }
//	message SignedData { optional bytes crx_id = 1; }
//
// Assinatura = RSA-PKCS1v15-SHA256("CRX3 SignedData\x00" | uint32 LE len(signed_header_data) | signed_header_data | ZIP)
package crx

import (
	"bytes"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/binary"
	"errors"
	"fmt"
)

const prefixoAssinatura = "CRX3 SignedData\x00"

// IDBytes devolve os 16 bytes do identificador da extensão (crx_id).
func IDBytes(chavePublicaDER []byte) []byte {
	h := sha256.Sum256(chavePublicaDER)
	return h[:16]
}

// ID devolve o identificador da extensão como o Chromium mostra (32 letras a-p).
func ID(chavePublicaDER []byte) string {
	var b bytes.Buffer
	for _, c := range IDBytes(chavePublicaDER) {
		b.WriteByte('a' + (c >> 4))
		b.WriteByte('a' + (c & 0x0f))
	}
	return b.String()
}

func ChavePublicaDER(priv *rsa.PrivateKey) ([]byte, error) {
	return x509.MarshalPKIXPublicKey(&priv.PublicKey)
}

// --- protobuf mínimo ---
func varint(n uint64) []byte {
	var b [binary.MaxVarintLen64]byte
	k := binary.PutUvarint(b[:], n)
	return b[:k]
}

func campoBytes(numero int, dados []byte) []byte {
	var out []byte
	out = append(out, varint(uint64(numero<<3|2))...)
	out = append(out, varint(uint64(len(dados)))...)
	return append(out, dados...)
}

func dadosParaAssinar(signedHeader, zip []byte) []byte {
	var b bytes.Buffer
	b.WriteString(prefixoAssinatura)
	var n [4]byte
	binary.LittleEndian.PutUint32(n[:], uint32(len(signedHeader)))
	b.Write(n[:])
	b.Write(signedHeader)
	b.Write(zip)
	return b.Bytes()
}

// Empacotar cria um CRX3 a partir de um ZIP com o conteúdo da extensão.
func Empacotar(zip []byte, priv *rsa.PrivateKey) ([]byte, error) {
	pubDER, err := ChavePublicaDER(priv)
	if err != nil {
		return nil, err
	}
	signedHeader := campoBytes(1, IDBytes(pubDER))
	digest := sha256.Sum256(dadosParaAssinar(signedHeader, zip))
	sig, err := rsa.SignPKCS1v15(rand.Reader, priv, crypto.SHA256, digest[:])
	if err != nil {
		return nil, err
	}
	prova := append(campoBytes(1, pubDER), campoBytes(2, sig)...)
	cabecalho := append(campoBytes(2, prova), campoBytes(10000, signedHeader)...)

	var out bytes.Buffer
	out.WriteString("Cr24")
	var n [4]byte
	binary.LittleEndian.PutUint32(n[:], 3)
	out.Write(n[:])
	binary.LittleEndian.PutUint32(n[:], uint32(len(cabecalho)))
	out.Write(n[:])
	out.Write(cabecalho)
	out.Write(zip)
	return out.Bytes(), nil
}

// --- leitura (usada nos testes e para conferir pacotes antes de publicar) ---

type campo struct {
	numero int
	dados  []byte
}

func lerCampos(b []byte) ([]campo, error) {
	var out []campo
	for len(b) > 0 {
		chave, k := binary.Uvarint(b)
		if k <= 0 {
			return nil, errors.New("protobuf inválido")
		}
		b = b[k:]
		if chave&7 != 2 {
			return nil, fmt.Errorf("tipo de campo não suportado: %d", chave&7)
		}
		tam, k := binary.Uvarint(b)
		if k <= 0 || uint64(len(b)-k) < tam {
			return nil, errors.New("protobuf truncado")
		}
		b = b[k:]
		out = append(out, campo{int(chave >> 3), b[:tam]})
		b = b[tam:]
	}
	return out, nil
}

// Verificar confere um CRX3 e devolve o ID da extensão e o ZIP interno.
func Verificar(crx []byte) (id string, zip []byte, err error) {
	if len(crx) < 12 || string(crx[:4]) != "Cr24" || binary.LittleEndian.Uint32(crx[4:8]) != 3 {
		return "", nil, errors.New("não é um arquivo CRX3")
	}
	tam := binary.LittleEndian.Uint32(crx[8:12])
	if uint64(len(crx)) < 12+uint64(tam) {
		return "", nil, errors.New("CRX truncado")
	}
	cab, zip := crx[12:12+tam], crx[12+tam:]
	campos, err := lerCampos(cab)
	if err != nil {
		return "", nil, err
	}
	var signedHeader []byte
	var provas [][]byte
	for _, c := range campos {
		switch c.numero {
		case 10000:
			signedHeader = c.dados
		case 2:
			provas = append(provas, c.dados)
		}
	}
	sh, err := lerCampos(signedHeader)
	if err != nil || len(sh) != 1 || sh[0].numero != 1 {
		return "", nil, errors.New("signed_header_data inválido")
	}
	crxID := sh[0].dados
	for _, p := range provas {
		pc, err := lerCampos(p)
		if err != nil {
			continue
		}
		var pub, sig []byte
		for _, c := range pc {
			if c.numero == 1 {
				pub = c.dados
			} else if c.numero == 2 {
				sig = c.dados
			}
		}
		if !bytes.Equal(IDBytes(pub), crxID) {
			continue
		}
		chave, err := x509.ParsePKIXPublicKey(pub)
		if err != nil {
			continue
		}
		rsaPub, ok := chave.(*rsa.PublicKey)
		if !ok {
			continue
		}
		digest := sha256.Sum256(dadosParaAssinar(signedHeader, zip))
		if rsa.VerifyPKCS1v15(rsaPub, crypto.SHA256, digest[:], sig) == nil {
			return ID(pub), zip, nil
		}
	}
	return "", nil, errors.New("nenhuma assinatura válida corresponde ao ID da extensão")
}
