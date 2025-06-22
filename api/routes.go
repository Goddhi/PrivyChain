package api

import (
	// "net/http"

	"github.com/gin-gonic/gin"
	"github.com/goddhi/privychain/internal/config"
	"github.com/goddhi/privychain/internal/handlers"
	"github.com/goddhi/privychain/internal/middleware"
	"github.com/goddhi/privychain/internal/services"
	"github.com/goddhi/privychain/internal/utils"
	"gorm.io/gorm"
)

func SetupRoutes(cfg *config.Config, db *gorm.DB) *gin.Engine {
	r := gin.New()

	// Add middleware
	r.Use(gin.Logger())
	r.Use(gin.Recovery())
	r.Use(middleware.CORS())
	r.Use(middleware.RateLimit())

	// Initialize services (fixed constructors)
	encryptionService := services.NewEncryptionService(db)
	storageService := services.NewStorageService(cfg)
	blockchainService := services.NewBlockchainService(cfg)
	authService := services.NewAuthService(cfg.JWTSecret)

	// Initialize handlers (correct parameters)
	fileHandler := handlers.NewFileHandler(db, encryptionService, storageService, blockchainService, authService)
	userHandler := handlers.NewUserHandler(db)
	webhookHandler := handlers.NewWebhookHandler(db)

	// API routes
	api := r.Group("/api/v1")
	{
		// File operations
		api.POST("/upload", fileHandler.Upload)
		api.POST("/retrieve", fileHandler.Retrieve)
		api.POST("/claim-reward", fileHandler.ClaimReward)

		// User operations
		api.GET("/users/:address/files", userHandler.GetUserFiles)
		api.GET("/users/:address/stats", userHandler.GetUserStats)
		api.GET("/users/:address/profile", userHandler.GetUserProfile)
		api.GET("/users/:address/activity", userHandler.GetUserActivity)

		// Access control
		api.POST("/access/grant", fileHandler.GrantAccess)
		api.POST("/access/revoke", fileHandler.RevokeAccess)

		// Blockchain operations
		api.GET("/transaction/:txHash/status", fileHandler.GetTransactionStatus)

		// Webhooks
		api.POST("/webhook", webhookHandler.HandleWebhook)
		api.POST("/webhook/blockchain", webhookHandler.HandleBlockchainEvent)

		// Health check
		api.GET("/health", healthCheckHandler)
	}

	return r
}

// Health check handler
func healthCheckHandler(c *gin.Context) {
	utils.SuccessResponse(c, map[string]interface{}{
		"status":    "healthy",
		"service":   "privychain-backend",
		"timestamp": "2024-01-01T00:00:00Z", // You'd use time.Now() in real implementation
		"version":   "1.0.0",
	})
}

