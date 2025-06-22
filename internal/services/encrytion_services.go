package services

import (
	"encoding/hex"
	"fmt"

	"github.com/goddhi/privychain/internal/models"
	"github.com/goddhi/privychain/internal/utils"
	"github.com/goddhi/privychain/pkg/errors"
	"gorm.io/gorm"
)

type EncryptionService struct {
	db *gorm.DB
}

func NewEncryptionService(db *gorm.DB) *EncryptionService {
	return &EncryptionService{
		db: db,
	}
}

func (s *EncryptionService) EncryptFile(file []byte, userAddress string) ([]byte, error) {
	encKey, err := s.getUserEncryptionKey(userAddress)
	if err != nil {
		return nil, errors.NewEncryptionError("Failed to get encryption key", err)
	}

	encrypted, err := utils.EncryptAESGCM(file, encKey)
	if err != nil {
		return nil, errors.NewEncryptionError("Failed to encrypt file", err)
	}

	return encrypted, nil
}

func (s *EncryptionService) DecryptFile(encryptedFile []byte, userAddress string) ([]byte, error) {
	encKey, err := s.getUserEncryptionKey(userAddress)
	if err != nil {
		return nil, errors.NewDecryptionError("Failed to get encryption key", err)
	}

	plaintext, err := utils.DecryptAESGCM(encryptedFile, encKey)
	if err != nil {
		return nil, errors.NewDecryptionError("Failed to decrypt file", err)
	}

	return plaintext, nil
}

func (s *EncryptionService) getUserEncryptionKey(userAddress string) ([]byte, error) {
	// Check database for existing key
	var encKey models.EncryptionKey
	if err := s.db.Where("user_address = ?", userAddress).First(&encKey).Error; err == nil {
		key, err := hex.DecodeString(encKey.PublicKey)
		if err != nil {
			return nil, fmt.Errorf("failed to decode stored key: %w", err)
		}
		return key, nil
	}

	// Generate new key if not found
	key, err := utils.GenerateKey()
	if err != nil {
		return nil, fmt.Errorf("failed to generate new key: %w", err)
	}

	// Store new key in database
	encKeyRecord := models.EncryptionKey{
		UserAddress: userAddress,
		PublicKey:   hex.EncodeToString(key),
		KeyID:       fmt.Sprintf("auto_%s", userAddress),
	}
	
	if err := s.db.Create(&encKeyRecord).Error; err != nil {
		return nil, fmt.Errorf("failed to store encryption key: %w", err)
	}

	return key, nil
}