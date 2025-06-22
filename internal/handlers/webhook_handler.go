package handlers

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/goddhi/privychain/internal/models"
	"github.com/goddhi/privychain/internal/types"
	"github.com/goddhi/privychain/pkg/logger"
	"gorm.io/gorm"
)

type WebhookHandler struct {
	db        *gorm.DB
	secretKey string
}

func NewWebhookHandler(db *gorm.DB) *WebhookHandler {
	return &WebhookHandler{
		db:        db,
		secretKey: "your-webhook-secret-key", // Should come from config
	}
}

func (h *WebhookHandler) HandleWebhook(c *gin.Context) {
	// Verify webhook signature
	signature := c.GetHeader("X-Signature-256")
	if !h.verifySignature(c, signature) {
		c.JSON(http.StatusUnauthorized, types.APIResponse{
			Success: false,
			Error:   "Invalid signature",
		})
		return
	}

	var event types.WebhookEvent
	if err := c.ShouldBindJSON(&event); err != nil {
		c.JSON(http.StatusBadRequest, types.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	// Process webhook event based on type
	switch event.Type {
	case "FileUploaded":
		h.handleFileUploaded(event)
	case "RewardClaimed":
		h.handleRewardClaimed(event)
	case "AccessGranted":
		h.handleAccessGranted(event)
	case "AccessRevoked":
		h.handleAccessRevoked(event)
	case "TransactionConfirmed":
		h.handleTransactionConfirmed(event)
	case "TransactionFailed":
		h.handleTransactionFailed(event)
	default:
		logger.Log.Warn("Unknown webhook event type: " + event.Type)
	}

	c.JSON(http.StatusOK, types.APIResponse{
		Success: true,
		Message: "Webhook processed successfully",
	})
}

func (h *WebhookHandler) handleFileUploaded(event types.WebhookEvent) {
	cid, ok := event.Data["cid"].(string)
	if !ok {
		logger.Log.Error("Missing CID in FileUploaded event")
		return
	}

	txHash, ok := event.Data["tx_hash"].(string)
	if !ok {
		logger.Log.Error("Missing tx_hash in FileUploaded event")
		return
	}

	// Update file status in database
	result := h.db.Model(&models.FileRecord{}).
		Where("cid = ?", cid).
		Updates(map[string]interface{}{
			"status":  "confirmed",
			"tx_hash": txHash,
		})

	if result.Error != nil {
		logger.Log.Error("Failed to update file record: " + result.Error.Error())
		return
	}

	if result.RowsAffected == 0 {
		logger.Log.Warn("No file record found for CID: " + cid)
	}

	logger.Log.Info("File upload confirmed: " + cid)
}

func (h *WebhookHandler) handleRewardClaimed(event types.WebhookEvent) {
	cid, ok := event.Data["cid"].(string)
	if !ok {
		logger.Log.Error("Missing CID in RewardClaimed event")
		return
	}

	uploader, ok := event.Data["uploader"].(string)
	if !ok {
		logger.Log.Error("Missing uploader in RewardClaimed event")
		return
	}

	amount, ok := event.Data["amount"].(float64)
	if !ok {
		logger.Log.Error("Missing amount in RewardClaimed event")
		return
	}

	// Update file reward status
	h.db.Model(&models.FileRecord{}).
		Where("cid = ? AND uploader_addr = ?", cid, uploader).
		Update("status", "rewarded")

	logger.Log.Info("Reward claimed for CID: " + cid + " Amount: " + string(rune(amount)))
}

func (h *WebhookHandler) handleAccessGranted(event types.WebhookEvent) {
	cid, ok := event.Data["cid"].(string)
	if !ok {
		logger.Log.Error("Missing CID in AccessGranted event")
		return
	}

	granter, ok := event.Data["granter"].(string)
	if !ok {
		logger.Log.Error("Missing granter in AccessGranted event")
		return
	}

	grantee, ok := event.Data["grantee"].(string)
	if !ok {
		logger.Log.Error("Missing grantee in AccessGranted event")
		return
	}

	// Get expiration time from event data
	var expiresAt time.Time
	if expiresAtFloat, ok := event.Data["expires_at"].(float64); ok {
		expiresAt = time.Unix(int64(expiresAtFloat), 0)
	} else {
		// Default to 1 year from now if not specified
		expiresAt = time.Now().Add(365 * 24 * time.Hour)
	}

	// Create or update access grant record
	accessGrant := models.AccessGrant{
		CID:         cid,
		GranterAddr: granter,
		GranteeAddr: grantee,
		ExpiresAt:   expiresAt,
		IsActive:    true,
	}

	if err := h.db.Create(&accessGrant).Error; err != nil {
		logger.Log.Error("Failed to create access grant: " + err.Error())
		return
	}

	logger.Log.Info("Access granted for CID: " + cid + " to: " + grantee)
}

func (h *WebhookHandler) handleAccessRevoked(event types.WebhookEvent) {
	cid, ok := event.Data["cid"].(string)
	if !ok {
		logger.Log.Error("Missing CID in AccessRevoked event")
		return
	}

	grantee, ok := event.Data["grantee"].(string)
	if !ok {
		logger.Log.Error("Missing grantee in AccessRevoked event")
		return
	}

	// Deactivate access grant
	result := h.db.Model(&models.AccessGrant{}).
		Where("cid = ? AND grantee_addr = ?", cid, grantee).
		Update("is_active", false)

	if result.Error != nil {
		logger.Log.Error("Failed to revoke access: " + result.Error.Error())
		return
	}

	logger.Log.Info("Access revoked for CID: " + cid + " from: " + grantee)
}

func (h *WebhookHandler) handleTransactionConfirmed(event types.WebhookEvent) {
	txHash, ok := event.Data["tx_hash"].(string)
	if !ok {
		logger.Log.Error("Missing tx_hash in TransactionConfirmed event")
		return
	}

	// Update all records with this transaction hash
	h.db.Model(&models.FileRecord{}).
		Where("tx_hash = ?", txHash).
		Update("status", "confirmed")

	logger.Log.Info("Transaction confirmed: " + txHash)
}

func (h *WebhookHandler) handleTransactionFailed(event types.WebhookEvent) {
	txHash, ok := event.Data["tx_hash"].(string)
	if !ok {
		logger.Log.Error("Missing tx_hash in TransactionFailed event")
		return
	}

	// Update all records with this transaction hash
	h.db.Model(&models.FileRecord{}).
		Where("tx_hash = ?", txHash).
		Update("status", "failed")

	logger.Log.Info("Transaction failed: " + txHash)
}

func (h *WebhookHandler) verifySignature(c *gin.Context, signature string) bool {
	if h.secretKey == "" || signature == "" {
		return false
	}

	// Remove "sha256=" prefix if present
	signature = strings.TrimPrefix(signature, "sha256=")

	// Get raw body
	body, exists := c.Get("rawBody")
	if !exists {
		return false
	}

	bodyBytes, ok := body.([]byte)
	if !ok {
		return false
	}

	// Calculate expected signature
	mac := hmac.New(sha256.New, []byte(h.secretKey))
	mac.Write(bodyBytes)
	expectedSignature := hex.EncodeToString(mac.Sum(nil))

	// Compare signatures
	return hmac.Equal([]byte(signature), []byte(expectedSignature))
}

// Blockchain event webhook handlers
func (h *WebhookHandler) HandleBlockchainEvent(c *gin.Context) {
	var event struct {
		Event       string                 `json:"event"`
		Address     string                 `json:"address"`
		BlockNumber uint64                 `json:"blockNumber"`
		TxHash      string                 `json:"transactionHash"`
		Data        map[string]interface{} `json:"data"`
	}

	if err := c.ShouldBindJSON(&event); err != nil {
		c.JSON(http.StatusBadRequest, types.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	switch event.Event {
	case "FileUploaded":
		h.processFileUploadedEvent(event.Data, event.TxHash)
	case "RewardClaimed":
		h.processRewardClaimedEvent(event.Data, event.TxHash)
	case "AccessGranted":
		h.processAccessGrantedEvent(event.Data, event.TxHash)
	}

	c.JSON(http.StatusOK, types.APIResponse{
		Success: true,
		Message: "Blockchain event processed",
	})
}

func (h *WebhookHandler) processFileUploadedEvent(data map[string]interface{}, txHash string) {
	// Extract event data and update database accordingly
	logger.Log.Info("Processing FileUploaded blockchain event: " + txHash)
}

func (h *WebhookHandler) processRewardClaimedEvent(data map[string]interface{}, txHash string) {
	// Extract event data and update database accordingly
	logger.Log.Info("Processing RewardClaimed blockchain event: " + txHash)
}

func (h *WebhookHandler) processAccessGrantedEvent(data map[string]interface{}, txHash string) {
	// Extract event data and update database accordingly
	logger.Log.Info("Processing AccessGranted blockchain event: " + txHash)
}