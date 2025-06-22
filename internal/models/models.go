package models

import (
	"time"
	"gorm.io/gorm"
)

type FileRecord struct {
	ID              uint           `json:"id" gorm:"primaryKey"`
	CID             string         `json:"cid" gorm:"uniqueIndex"`
	UploaderAddr    string         `json:"uploader_address"`
	FileSize        int64          `json:"file_size"`
	IsEncrypted     bool           `json:"is_encrypted"`
	FileName        string         `json:"file_name"`
	ContentType     string         `json:"content_type"`
	Metadata        string         `json:"metadata"`
	StorageProvider string         `json:"storage_provider"`
	TxHash          string         `json:"tx_hash"`
	Status          string         `json:"status"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `gorm:"index"`
}

type EncryptionKey struct {
	UserAddress string         `json:"user_address" gorm:"primaryKey"`
	PublicKey   string         `json:"public_key"`
	KeyID       string         `json:"key_id"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index"`
}

type AccessGrant struct {
	ID          uint           `json:"id" gorm:"primaryKey"`
	CID         string         `json:"cid"`
	GranterAddr string         `json:"granter_address"`
	GranteeAddr string         `json:"grantee_address"`
	ExpiresAt   time.Time      `json:"expires_at"`
	IsActive    bool           `json:"is_active"`
	CreatedAt   time.Time      `json:"created_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index"`
}

type UserStats struct {
	TotalFiles     int64 `json:"total_files"`
	TotalSize      int64 `json:"total_size_bytes"`
	EncryptedFiles int64 `json:"encrypted_files"`
	RewardsEarned  int64 `json:"rewards_earned"`
}