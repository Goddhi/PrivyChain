package types

import "time"

type UploadRequest struct {
	File         []byte                 `json:"file" binding:"required"`
	FileName     string                 `json:"file_name" binding:"required"`
	ContentType  string                 `json:"content_type"`
	ShouldEncrypt bool                  `json:"should_encrypt"`
	Metadata     map[string]interface{} `json:"metadata"`
	UserAddress  string                 `json:"user_address" binding:"required"`
	Signature    string                 `json:"signature" binding:"required"`
}

type RetrieveRequest struct {
	CID         string `json:"cid" binding:"required"`
	UserAddress string `json:"user_address" binding:"required"`
	Signature   string `json:"signature" binding:"required"`
}

type AccessGrantRequest struct {
	CID       string `json:"cid" binding:"required"`
	Grantee   string `json:"grantee" binding:"required"`
	Duration  int64  `json:"duration"`
	Granter   string `json:"granter" binding:"required"`
	Signature string `json:"signature" binding:"required"`
}

type UploadResponse struct {
	CID         string `json:"cid"`
	TxHash      string `json:"tx_hash"`
	FileSize    int64  `json:"file_size"`
	IsEncrypted bool   `json:"is_encrypted"`
	Status      string `json:"status"`
}

type RetrieveResponse struct {
	File        []byte `json:"file"`
	FileName    string `json:"file_name"`
	ContentType string `json:"content_type"`
	Metadata    string `json:"metadata"`
}

type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
	Message string      `json:"message,omitempty"`
}

type WebhookEvent struct {
	Type    string                 `json:"type"`
	TxHash  string                 `json:"tx_hash"`
	Data    map[string]interface{} `json:"data"`
	BlockNumber uint64             `json:"block_number"`
	Timestamp   time.Time          `json:"timestamp"`
}