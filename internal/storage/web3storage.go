package storage

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/goddhi/privychain/pkg/errors"
)

// Provider defines the interface for storage providers
type Provider interface {
	Upload(file []byte, fileName string) (string, error)
	Retrieve(cid string) ([]byte, error)
	GetInfo() ProviderInfo
}

type ProviderInfo struct {
	Name             string
	Type             string
	MaxFileSize      int64
	SupportedFormats []string
}

// Web3StorageProvider implements the Provider interface for Web3.Storage
type Web3StorageProvider struct {
	token   string
	client  *http.Client
	baseURL string
}

// Web3StorageResponse represents the response from Web3.Storage API
type Web3StorageResponse struct {
	CID string `json:"cid"`
}

// NewWeb3StorageProvider creates a new Web3.Storage provider
func NewWeb3StorageProvider(token string) *Web3StorageProvider {
	return &Web3StorageProvider{
		token:   token,
		baseURL: "https://api.web3.storage",
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// Upload uploads a file to Web3.Storage
func (w *Web3StorageProvider) Upload(file []byte, fileName string) (string, error) {
	url := w.baseURL + "/upload"
	
	req, err := http.NewRequest("POST", url, bytes.NewReader(file))
	if err != nil {
		return "", errors.NewStorageError("Failed to create upload request", err)
	}
	
	// Set headers
	req.Header.Set("Authorization", "Bearer "+w.token)
	req.Header.Set("Content-Type", "application/octet-stream")
	req.Header.Set("X-Name", fileName)
	
	// Make request
	resp, err := w.client.Do(req)
	if err != nil {
		return "", errors.NewStorageError("Web3.Storage upload request failed", err)
	}
	defer resp.Body.Close()
	
	// Check response status
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", errors.NewStorageError(
			fmt.Sprintf("Web3.Storage API error %d: %s", resp.StatusCode, string(body)), nil)
	}
	
	// Parse response
	var result Web3StorageResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", errors.NewStorageError("Failed to parse Web3.Storage response", err)
	}
	
	if result.CID == "" {
		return "", errors.NewStorageError("No CID returned from Web3.Storage", nil)
	}
	
	return result.CID, nil
}

// Retrieve retrieves a file from Web3.Storage via IPFS gateway
func (w *Web3StorageProvider) Retrieve(cid string) ([]byte, error) {
	// Use Web3.Storage gateway
	url := fmt.Sprintf("https://w3s.link/ipfs/%s", cid)
	
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, errors.NewStorageError("Failed to create retrieve request", err)
	}
	
	// Make request
	resp, err := w.client.Do(req)
	if err != nil {
		return nil, errors.NewStorageError("Web3.Storage retrieve request failed", err)
	}
	defer resp.Body.Close()
	
	// Check response status
	if resp.StatusCode != http.StatusOK {
		return nil, errors.NewStorageError(
			fmt.Sprintf("Failed to retrieve file from Web3.Storage: %d", resp.StatusCode), nil)
	}
	
	// Read file content
	fileData, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, errors.NewStorageError("Failed to read file content", err)
	}
	
	return fileData, nil
}

// GetInfo returns provider information
func (w *Web3StorageProvider) GetInfo() ProviderInfo {
	return ProviderInfo{
		Name:             "Web3.Storage",
		Type:             "IPFS",
		MaxFileSize:      32 * 1024 * 1024 * 1024, // 32GB
		SupportedFormats: []string{"*"}, // All formats
	}
}