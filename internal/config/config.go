package config

import (
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Port                   string
	DatabaseURL            string
	RedisURL               string
	EthereumRPC            string
	ContractAddress        string
	PrivateKey             string
	Web3StorageToken       string
	LighthouseToken        string
	PrivyAPIKey            string
	PrivyAppID             string
	DefaultStorageProvider string
	JWTSecret              string
	Environment            string
}

func Load() (*Config, error) {
	// Load .env file if it exists
	_ = godotenv.Load()

	return &Config{
		Port:                   getEnv("PORT", "8080"),
		DatabaseURL:            getEnv("DATABASE_URL", "postgres://user:pass@localhost/privychain?sslmode=disable"),
		RedisURL:               getEnv("REDIS_URL", "redis://localhost:6379"),
		EthereumRPC:            getEnv("ETHEREUM_RPC", "https://api.node.glif.io"),
		ContractAddress:        getEnv("CONTRACT_ADDRESS", ""),
		PrivateKey:             getEnv("PRIVATE_KEY", ""),
		Web3StorageToken:       getEnv("WEB3_STORAGE_TOKEN", ""),
		LighthouseToken:        getEnv("LIGHTHOUSE_TOKEN", ""),
		PrivyAPIKey:            getEnv("PRIVY_API_KEY", ""),
		PrivyAppID:             getEnv("PRIVY_APP_ID", ""),
		DefaultStorageProvider: getEnv("DEFAULT_STORAGE_PROVIDER", "web3storage"),
		JWTSecret:              getEnv("JWT_SECRET", "your-secret-key"),
		Environment:            getEnv("ENVIRONMENT", "development"),
	}, nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

