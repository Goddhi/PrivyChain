package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/goddhi/privychain/internal/models"
	"github.com/goddhi/privychain/internal/services"
	"github.com/goddhi/privychain/internal/types"
	"github.com/goddhi/privychain/internal/utils"
	"gorm.io/gorm"
)

type FileHandler struct {
	db                *gorm.DB
	encryptionService *services.EncryptionService
	storageService    *services.StorageService
	blockchainService *services.BlockchainService
	authService       *services.AuthService
}

func NewFileHandler(
	db *gorm.DB,
	encryptionService *services.EncryptionService,
	storageService *services.StorageService,
	blockchainService *services.BlockchainService,
	authService *services.AuthService,
) *FileHandler {
	return &FileHandler{
		db:                db,
		encryptionService: encryptionService,
		storageService:    storageService,
		blockchainService: blockchainService,
		authService:       authService,
	}
}

func (h *FileHandler) Upload(c *gin.Context) {
	var req types.UploadRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ValidationErrorResponse(c, utils.ValidationErrors{{Field: "request", Message: err.Error()}})
		return
	}

	// Validate request
	if errors := utils.ValidateUploadRequest(&req); len(errors) > 0 {
		utils.ValidationErrorResponse(c, errors)
		return
	}

	// Verify signature
	if !h.authService.VerifySignature(req.UserAddress, req.Signature, string(req.File)) {
		utils.UnauthorizedResponse(c, "Invalid signature")
		return
	}

	// Encrypt file if requested
	fileToUpload := req.File
	if req.ShouldEncrypt {
		encrypted, err := h.encryptionService.EncryptFile(req.File, req.UserAddress)
		if err != nil {
			utils.ErrorResponse(c, http.StatusInternalServerError, "Encryption failed")
			return
		}
		fileToUpload = encrypted
	}

	// Upload to storage
	cid, err := h.storageService.Upload(fileToUpload, req.FileName, "")
	if err != nil {
		utils.ErrorResponse(c, http.StatusInternalServerError, "Storage upload failed")
		return
	}

	// Prepare metadata
	metadataBytes, _ := json.Marshal(req.Metadata)
	metadataStr := string(metadataBytes)

	// Record in database
	fileRecord := models.FileRecord{
		CID:             cid,
		UploaderAddr:    req.UserAddress,
		FileSize:        int64(len(req.File)),
		IsEncrypted:     req.ShouldEncrypt,
		FileName:        req.FileName,
		ContentType:     req.ContentType,
		Metadata:        metadataStr,
		StorageProvider: "web3storage",
		Status:          "pending",
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	if err := h.db.Create(&fileRecord).Error; err != nil {
		utils.ErrorResponse(c, http.StatusInternalServerError, "Database error")
		return
	}

	// Record on blockchain (async)
	go func() {
		txHash, err := h.blockchainService.RecordUpload(cid, req.UserAddress, int64(len(req.File)), req.ShouldEncrypt, metadataStr)
		if err != nil {
			// Update database with failed status
			h.db.Model(&fileRecord).Update("status", "failed")
			return
		}

		// Update database with transaction hash and confirmed status
		h.db.Model(&fileRecord).Updates(map[string]interface{}{
			"tx_hash": txHash,
			"status":  "confirmed",
		})
	}()

	response := types.UploadResponse{
		CID:         cid,
		FileSize:    int64(len(req.File)),
		IsEncrypted: req.ShouldEncrypt,
		Status:      "pending",
	}

	utils.SuccessResponse(c, response)
}

func (h *FileHandler) Retrieve(c *gin.Context) {
	var req types.RetrieveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ValidationErrorResponse(c, utils.ValidationErrors{{Field: "request", Message: err.Error()}})
		return
	}

	// Validate request
	if errors := utils.ValidateRetrieveRequest(&req); len(errors) > 0 {
		utils.ValidationErrorResponse(c, errors)
		return
	}

	// Verify signature
	if !h.authService.VerifySignature(req.UserAddress, req.Signature, req.CID) {
		utils.UnauthorizedResponse(c, "Invalid signature")
		return
	}

	// Get file record
	var fileRecord models.FileRecord
	if err := h.db.Where("cid = ?", req.CID).First(&fileRecord).Error; err != nil {
		utils.NotFoundResponse(c, "File not found")
		return
	}

	// Check access permissions
	if !h.hasFileAccess(req.CID, req.UserAddress) {
		utils.ForbiddenResponse(c, "Access denied")
		return
	}

	// Retrieve from storage
	fileData, err := h.storageService.Retrieve(req.CID, fileRecord.StorageProvider)
	if err != nil {
		utils.ErrorResponse(c, http.StatusInternalServerError, "File retrieval failed")
		return
	}

	// Decrypt if necessary
	if fileRecord.IsEncrypted {
		decrypted, err := h.encryptionService.DecryptFile(fileData, req.UserAddress)
		if err != nil {
			utils.ErrorResponse(c, http.StatusInternalServerError, "Decryption failed")
			return
		}
		fileData = decrypted
	}

	response := types.RetrieveResponse{
		File:        fileData,
		FileName:    fileRecord.FileName,
		ContentType: fileRecord.ContentType,
		Metadata:    fileRecord.Metadata,
	}

	utils.SuccessResponse(c, response)
}

// ClaimReward allows users to claim rewards for their uploaded files
func (h *FileHandler) ClaimReward(c *gin.Context) {
	var req struct {
		CID         string `json:"cid" binding:"required"`
		UserAddress string `json:"user_address" binding:"required"`
		Signature   string `json:"signature" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ValidationErrorResponse(c, utils.ValidationErrors{{Field: "request", Message: err.Error()}})
		return
	}

	// Verify signature
	if !h.authService.VerifySignature(req.UserAddress, req.Signature, req.CID) {
		utils.UnauthorizedResponse(c, "Invalid signature")
		return
	}

	// Check if file exists and user is the uploader
	var fileRecord models.FileRecord
	if err := h.db.Where("cid = ? AND uploader_addr = ?", req.CID, req.UserAddress).First(&fileRecord).Error; err != nil {
		utils.NotFoundResponse(c, "File not found or not uploaded by user")
		return
	}

	// Check if reward already claimed
	if fileRecord.Status == "rewarded" {
		utils.ConflictResponse(c, "Reward already claimed")
		return
	}

	// Check if file is confirmed on blockchain
	if fileRecord.Status != "confirmed" {
		utils.ErrorResponse(c, http.StatusBadRequest, "File not yet confirmed on blockchain")
		return
	}

	// Claim reward on blockchain
	txHash, err := h.blockchainService.ClaimReward(req.CID, req.UserAddress)
	if err != nil {
		utils.ErrorResponse(c, http.StatusInternalServerError, "Failed to claim reward on blockchain")
		return
	}

	// Update database status
	h.db.Model(&fileRecord).Updates(map[string]interface{}{
		"status":     "rewarded",
		"updated_at": time.Now(),
	})

	utils.SuccessResponse(c, map[string]interface{}{
		"cid":         req.CID,
		"tx_hash":     txHash,
		"status":      "reward_claimed",
		"claimed_at":  time.Now(),
	})
}

// GrantAccess grants access to a file
func (h *FileHandler) GrantAccess(c *gin.Context) {
	var req types.AccessGrantRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ValidationErrorResponse(c, utils.ValidationErrors{{Field: "request", Message: err.Error()}})
		return
	}

	// Validate request
	if errors := utils.ValidateAccessGrantRequest(&req); len(errors) > 0 {
		utils.ValidationErrorResponse(c, errors)
		return
	}

	// Verify granter signature
	if !h.authService.VerifySignature(req.Granter, req.Signature, req.CID+req.Grantee) {
		utils.UnauthorizedResponse(c, "Invalid signature")
		return
	}

	// Verify granter owns the file
	var fileRecord models.FileRecord
	if err := h.db.Where("cid = ? AND uploader_addr = ?", req.CID, req.Granter).First(&fileRecord).Error; err != nil {
		utils.ForbiddenResponse(c, "Not authorized to grant access")
		return
	}

	// Create access grant in database
	expiresAt := time.Now().Add(time.Duration(req.Duration) * time.Second)
	if req.Duration == 0 {
		expiresAt = time.Date(2099, 12, 31, 23, 59, 59, 0, time.UTC)
	}

	grant := models.AccessGrant{
		CID:         req.CID,
		GranterAddr: req.Granter,
		GranteeAddr: req.Grantee,
		ExpiresAt:   expiresAt,
		IsActive:    true,
		CreatedAt:   time.Now(),
	}

	if err := h.db.Create(&grant).Error; err != nil {
		utils.ErrorResponse(c, http.StatusInternalServerError, "Failed to create access grant")
		return
	}

	// Grant access on blockchain (async)
	go func() {
		txHash, err := h.blockchainService.GrantAccessOnChain(req.CID, req.Granter, req.Grantee, req.Duration)
		if err != nil {
			// Could log error but don't fail the request since database is updated
			return
		}

		// Update grant with transaction hash
		h.db.Model(&grant).Update("tx_hash", txHash)
	}()

	utils.SuccessResponse(c, map[string]interface{}{
		"cid":        req.CID,
		"grantee":    req.Grantee,
		"expires_at": expiresAt,
		"granted_at": time.Now(),
	})
}

// RevokeAccess revokes access to a file
func (h *FileHandler) RevokeAccess(c *gin.Context) {
	var req struct {
		CID       string `json:"cid" binding:"required"`
		Grantee   string `json:"grantee" binding:"required"`
		Granter   string `json:"granter" binding:"required"`
		Signature string `json:"signature" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ValidationErrorResponse(c, utils.ValidationErrors{{Field: "request", Message: err.Error()}})
		return
	}

	// Verify granter signature
	if !h.authService.VerifySignature(req.Granter, req.Signature, req.CID+req.Grantee+"revoke") {
		utils.UnauthorizedResponse(c, "Invalid signature")
		return
	}

	// Update access grant
	result := h.db.Model(&models.AccessGrant{}).Where("cid = ? AND granter_addr = ? AND grantee_addr = ?", 
		req.CID, req.Granter, req.Grantee).Update("is_active", false)

	if result.RowsAffected == 0 {
		utils.NotFoundResponse(c, "Access grant not found")
		return
	}

	utils.SuccessResponse(c, map[string]interface{}{
		"cid":     req.CID,
		"grantee": req.Grantee,
		"status":  "revoked",
	})
}

// GetTransactionStatus gets the status of a blockchain transaction
func (h *FileHandler) GetTransactionStatus(c *gin.Context) {
	txHash := c.Param("txHash")
	
	if txHash == "" {
		utils.ValidationErrorResponse(c, utils.ValidationErrors{{Field: "txHash", Message: "Transaction hash required"}})
		return
	}

	status, err := h.blockchainService.GetTransactionStatus(txHash)
	if err != nil {
		utils.ErrorResponse(c, http.StatusInternalServerError, "Failed to get transaction status")
		return
	}

	utils.SuccessResponse(c, map[string]interface{}{
		"tx_hash": txHash,
		"status":  status,
	})
}

// Helper functions

func (h *FileHandler) hasFileAccess(cid, userAddr string) bool {
	// Check if user is the uploader
	var fileRecord models.FileRecord
	if err := h.db.Where("cid = ? AND uploader_addr = ?", cid, userAddr).First(&fileRecord).Error; err == nil {
		return true
	}

	// Check access grants
	var grant models.AccessGrant
	if err := h.db.Where("cid = ? AND grantee_addr = ? AND is_active = ? AND expires_at > ?", 
		cid, userAddr, true, time.Now()).First(&grant).Error; err == nil {
		return true
	}

	return false
}

