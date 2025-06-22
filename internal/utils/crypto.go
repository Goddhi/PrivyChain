package utils

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
)

// GenerateRandomBytes generates cryptographically secure random bytes
func GenerateRandomBytes(size int) ([]byte, error) {
	bytes := make([]byte, size)
	if _, err := rand.Read(bytes); err != nil {
		return nil, err
	}
	return bytes, nil
}

// GenerateKey generates a random 256-bit encryption key
func GenerateKey() ([]byte, error) {
	return GenerateRandomBytes(32) // AES-256
}

// EncryptAESGCM encrypts data using AES-GCM
func EncryptAESGCM(plaintext, key []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}

	ciphertext := gcm.Seal(nonce, nonce, plaintext, nil)
	return ciphertext, nil
}

// DecryptAESGCM decrypts data using AES-GCM
func DecryptAESGCM(ciphertext, key []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return nil, errors.New("ciphertext too short")
	}

	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, err
	}

	return plaintext, nil
}

// HashSHA256 creates a SHA-256 hash of the input
func HashSHA256(data []byte) []byte {
	hash := sha256.Sum256(data)
	return hash[:]
}

// HashSHA256Hex creates a SHA-256 hash and returns it as hex string
func HashSHA256Hex(data []byte) string {
	hash := HashSHA256(data)
	return hex.EncodeToString(hash)
}

// SecureCompare performs constant-time comparison of two byte slices
func SecureCompare(a, b []byte) bool {
	if len(a) != len(b) {
		return false
	}

	var result byte
	for i := 0; i < len(a); i++ {
		result |= a[i] ^ b[i]
	}

	return result == 0
}