package services

import (
	"fmt"

	"github.com/goddhi/privychain/internal/config"
	"github.com/goddhi/privychain/internal/storage"
)

type StorageService struct {
	providers       map[string]storage.Provider
	defaultProvider string
}

func NewStorageService(cfg *config.Config) *StorageService {
	providers := make(map[string]storage.Provider)
	
	// Initialize Web3.Storage provider if token is available
	if cfg.Web3StorageToken != "" {
		providers["web3storage"] = storage.NewWeb3StorageProvider(cfg.Web3StorageToken)
	}
	
	// You can add more providers here in the future
	// if cfg.LighthouseToken != "" {
	//     providers["lighthouse"] = storage.NewLighthouseProvider(cfg.LighthouseToken)
	// }

	return &StorageService{
		providers:       providers,
		defaultProvider: cfg.DefaultStorageProvider,
	}
}

// Upload uploads a file using the specified provider (or default)
func (s *StorageService) Upload(file []byte, fileName, providerName string) (string, error) {
	if providerName == "" {
		providerName = s.defaultProvider
	}

	provider, exists := s.providers[providerName]
	if !exists {
		return "", fmt.Errorf("storage provider %s not found", providerName)
	}

	return provider.Upload(file, fileName)
}

// Retrieve retrieves a file using the specified provider (or default)
func (s *StorageService) Retrieve(cid, providerName string) ([]byte, error) {
	if providerName == "" {
		providerName = s.defaultProvider
	}

	provider, exists := s.providers[providerName]
	if !exists {
		return nil, fmt.Errorf("storage provider %s not found", providerName)
	}

	return provider.Retrieve(cid)
}

// GetProvider returns a specific storage provider
func (s *StorageService) GetProvider(name string) (storage.Provider, error) {
	provider, exists := s.providers[name]
	if !exists {
		return nil, fmt.Errorf("storage provider %s not found", name)
	}
	return provider, nil
}

// ListProviders returns all available storage providers
func (s *StorageService) ListProviders() []string {
	providers := make([]string, 0, len(s.providers))
	for name := range s.providers {
		providers = append(providers, name)
	}
	return providers
}

// GetDefaultProvider returns the default storage provider name
func (s *StorageService) GetDefaultProvider() string {
	return s.defaultProvider
}