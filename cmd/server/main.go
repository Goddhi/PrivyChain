package main

import (
	"log"
	// "os"

	"github.com/goddhi/privychain/api"
	"github.com/goddhi/privychain/internal/config"
		"github.com/goddhi/privychain/internal/database"
	"github.com/goddhi/privychain/pkg/logger"
)

func main() {
	// Initialize logger
	logger.Init()

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatal("Failed to load configuration:", err)
	}

	// Initialize database
	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	// Run migrations
	if err := database.Migrate(db); err != nil {
		log.Fatal("Failed to run migrations:", err)
	}

	// Setup routes
	router := api.SetupRoutes(cfg, db)

	// Start server
	port := cfg.Port
	if port == "" {
		port = "8080"
	}

	log.Printf("PrivyChain backend starting on port %s", port)
	log.Fatal(router.Run(":" + port))
}


