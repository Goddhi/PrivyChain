package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/goddhi/privychain/internal/models"
	"github.com/goddhi/privychain/internal/types"
	"gorm.io/gorm"
)

type UserHandler struct {
	db *gorm.DB
}

func NewUserHandler(db *gorm.DB) *UserHandler {
	return &UserHandler{
		db: db,
	}
}

func (h *UserHandler) GetUserFiles(c *gin.Context) {
	userAddr := c.Param("address")
	
	// Parse pagination parameters
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset := (page - 1) * limit
	
	// Parse filters
	status := c.Query("status")
	encrypted := c.Query("encrypted")
	sortBy := c.DefaultQuery("sort", "created_at")
	order := c.DefaultQuery("order", "desc")
	
	query := h.db.Where("uploader_addr = ?", userAddr)
	
	// Apply filters
	if status != "" {
		query = query.Where("status = ?", status)
	}
	
	if encrypted != "" {
		isEncrypted := encrypted == "true"
		query = query.Where("is_encrypted = ?", isEncrypted)
	}
	
	// Count total files
	var total int64
	query.Model(&models.FileRecord{}).Count(&total)
	
	// Get files with pagination
	var files []models.FileRecord
	if err := query.Order(sortBy + " " + order).
		Offset(offset).
		Limit(limit).
		Find(&files).Error; err != nil {
		c.JSON(http.StatusInternalServerError, types.APIResponse{
			Success: false,
			Error:   "Database error",
		})
		return
	}
	
	response := map[string]interface{}{
		"files": files,
		"pagination": map[string]interface{}{
			"page":        page,
			"limit":       limit,
			"total":       total,
			"total_pages": (total + int64(limit) - 1) / int64(limit),
		},
	}
	
	c.JSON(http.StatusOK, types.APIResponse{
		Success: true,
		Data:    response,
	})
}

func (h *UserHandler) GetUserStats(c *gin.Context) {
	userAddr := c.Param("address")
	
	var stats models.UserStats
	
	// Total files
	h.db.Model(&models.FileRecord{}).Where("uploader_addr = ?", userAddr).Count(&stats.TotalFiles)
	
	// Total size
	h.db.Model(&models.FileRecord{}).
		Where("uploader_addr = ?", userAddr).
		Select("COALESCE(SUM(file_size), 0)").
		Scan(&stats.TotalSize)
	
	// Encrypted files
	h.db.Model(&models.FileRecord{}).
		Where("uploader_addr = ? AND is_encrypted = ?", userAddr, true).
		Count(&stats.EncryptedFiles)
	
	// Calculate rewards earned (mock calculation)
	h.db.Model(&models.FileRecord{}).
		Where("uploader_addr = ? AND status = ?", userAddr, "confirmed").
		Count(&stats.RewardsEarned)
	
	c.JSON(http.StatusOK, types.APIResponse{
		Success: true,
		Data:    stats,
	})
}

func (h *UserHandler) GetUserProfile(c *gin.Context) {
	userAddr := c.Param("address")
	
	var profile struct {
		Address        string    `json:"address"`
		TotalFiles     int64     `json:"total_files"`
		TotalSize      int64     `json:"total_size"`
		EncryptedFiles int64     `json:"encrypted_files"`
		RewardsEarned  int64     `json:"rewards_earned"`
		JoinedAt       time.Time `json:"joined_at"`
		LastActivity   time.Time `json:"last_activity"`
	}
	
	profile.Address = userAddr
	
	// Get user stats
	h.db.Model(&models.FileRecord{}).Where("uploader_addr = ?", userAddr).Count(&profile.TotalFiles)
	h.db.Model(&models.FileRecord{}).
		Where("uploader_addr = ?", userAddr).
		Select("COALESCE(SUM(file_size), 0)").
		Scan(&profile.TotalSize)
	h.db.Model(&models.FileRecord{}).
		Where("uploader_addr = ? AND is_encrypted = ?", userAddr, true).
		Count(&profile.EncryptedFiles)
	
	// Get join date (first upload)
	var firstFile models.FileRecord
	if err := h.db.Where("uploader_addr = ?", userAddr).
		Order("created_at ASC").
		First(&firstFile).Error; err == nil {
		profile.JoinedAt = firstFile.CreatedAt
	}
	
	// Get last activity
	var lastFile models.FileRecord
	if err := h.db.Where("uploader_addr = ?", userAddr).
		Order("created_at DESC").
		First(&lastFile).Error; err == nil {
		profile.LastActivity = lastFile.CreatedAt
	}
	
	c.JSON(http.StatusOK, types.APIResponse{
		Success: true,
		Data:    profile,
	})
}

func (h *UserHandler) GetUserActivity(c *gin.Context) {
	userAddr := c.Param("address")
	days, _ := strconv.Atoi(c.DefaultQuery("days", "30"))
	
	// Get activity for the last N days
	startDate := time.Now().AddDate(0, 0, -days)
	
	var activity []struct {
		Date  string `json:"date"`
		Count int64  `json:"count"`
		Size  int64  `json:"size"`
	}
	
	if err := h.db.Model(&models.FileRecord{}).
		Select("DATE(created_at) as date, COUNT(*) as count, COALESCE(SUM(file_size), 0) as size").
		Where("uploader_addr = ? AND created_at >= ?", userAddr, startDate).
		Group("DATE(created_at)").
		Order("date DESC").
		Scan(&activity).Error; err != nil {
		c.JSON(http.StatusInternalServerError, types.APIResponse{
			Success: false,
			Error:   "Database error",
		})
		return
	}
	
	c.JSON(http.StatusOK, types.APIResponse{
		Success: true,
		Data:    activity,
	})
}