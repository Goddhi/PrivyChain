package utils

import (
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/mail"
	"regexp"
	"strings"

	"github.com/ethereum/go-ethereum/common"
	"github.com/goddhi/privychain/internal/types"
)

// ValidationError represents a validation error
type ValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

// ValidationErrors represents multiple validation errors
type ValidationErrors []ValidationError

func (v ValidationErrors) Error() string {
	if len(v) == 0 {
		return "validation failed"
	}
	
	messages := make([]string, len(v))
	for i, err := range v {
		messages[i] = fmt.Sprintf("%s: %s", err.Field, err.Message)
	}
	
	return strings.Join(messages, ", ")
}

// Simple validation functions

// IsRequired checks if a field is not empty
func IsRequired(field, value string) *ValidationError {
	if strings.TrimSpace(value) == "" {
		return &ValidationError{Field: field, Message: "Field is required"}
	}
	return nil
}

// IsValidEmail checks if email is valid
func IsValidEmail(field, value string) *ValidationError {
	if value != "" {
		if _, err := mail.ParseAddress(value); err != nil {
			return &ValidationError{Field: field, Message: "Invalid email format"}
		}
	}
	return nil
}

// IsValidEthereumAddress checks if Ethereum address is valid
func IsValidEthereumAddress(field, value string) *ValidationError {
	if value != "" && !common.IsHexAddress(value) {
		return &ValidationError{Field: field, Message: "Invalid Ethereum address"}
	}
	return nil
}

// IsValidSignature checks if signature is valid format
func IsValidSignature(field, value string) *ValidationError {
	if value != "" {
		cleaned := strings.TrimPrefix(value, "0x")
		if len(cleaned) != 130 { // 65 bytes * 2 hex chars
			return &ValidationError{Field: field, Message: "Invalid signature length"}
		}
		
		if _, err := hex.DecodeString(cleaned); err != nil {
			return &ValidationError{Field: field, Message: "Invalid signature format"}
		}
	}
	return nil
}

// IsValidCID checks if CID is valid format
func IsValidCID(field, value string) *ValidationError {
	if value != "" {
		// Basic CID validation
		if !regexp.MustCompile(`^Qm[1-9A-HJ-NP-Za-km-z]{44}$`).MatchString(value) {
			return &ValidationError{Field: field, Message: "Invalid CID format"}
		}
	}
	return nil
}

// IsValidFileSize checks if file size is within limits
func IsValidFileSize(field string, size, maxSize int64) *ValidationError {
	if size <= 0 {
		return &ValidationError{Field: field, Message: "File size must be greater than 0"}
	}
	if size > maxSize {
		return &ValidationError{Field: field, Message: fmt.Sprintf("File size exceeds maximum of %d bytes", maxSize)}
	}
	return nil
}

// IsValidJSON checks if string is valid JSON
func IsValidJSON(field, value string) *ValidationError {
	if value != "" {
		var js json.RawMessage
		if err := json.Unmarshal([]byte(value), &js); err != nil {
			return &ValidationError{Field: field, Message: "Invalid JSON format"}
		}
	}
	return nil
}

// Validation helpers for request types

// ValidateUploadRequest validates file upload request
func ValidateUploadRequest(req *types.UploadRequest) ValidationErrors {
	var errors ValidationErrors
	
	// Required fields
	if err := IsRequired("file", string(req.File)); err != nil {
		errors = append(errors, *err)
	}
	if err := IsRequired("file_name", req.FileName); err != nil {
		errors = append(errors, *err)
	}
	if err := IsRequired("user_address", req.UserAddress); err != nil {
		errors = append(errors, *err)
	}
	if err := IsRequired("signature", req.Signature); err != nil {
		errors = append(errors, *err)
	}
	
	// Format validations
	if err := IsValidEthereumAddress("user_address", req.UserAddress); err != nil {
		errors = append(errors, *err)
	}
	if err := IsValidSignature("signature", req.Signature); err != nil {
		errors = append(errors, *err)
	}
	if err := IsValidFileSize("file", int64(len(req.File)), 100*1024*1024*1024); err != nil { // 100GB max
		errors = append(errors, *err)
	}
	
	// File name length
	if len(req.FileName) > 255 {
		errors = append(errors, ValidationError{Field: "file_name", Message: "File name too long (max 255 characters)"})
	}
	
	return errors
}

// ValidateRetrieveRequest validates file retrieve request
func ValidateRetrieveRequest(req *types.RetrieveRequest) ValidationErrors {
	var errors ValidationErrors
	
	// Required fields
	if err := IsRequired("cid", req.CID); err != nil {
		errors = append(errors, *err)
	}
	if err := IsRequired("user_address", req.UserAddress); err != nil {
		errors = append(errors, *err)
	}
	if err := IsRequired("signature", req.Signature); err != nil {
		errors = append(errors, *err)
	}
	
	// Format validations
	if err := IsValidCID("cid", req.CID); err != nil {
		errors = append(errors, *err)
	}
	if err := IsValidEthereumAddress("user_address", req.UserAddress); err != nil {
		errors = append(errors, *err)
	}
	if err := IsValidSignature("signature", req.Signature); err != nil {
		errors = append(errors, *err)
	}
	
	return errors
}

// ValidateAccessGrantRequest validates access grant request
func ValidateAccessGrantRequest(req *types.AccessGrantRequest) ValidationErrors {
	var errors ValidationErrors
	
	// Required fields
	if err := IsRequired("cid", req.CID); err != nil {
		errors = append(errors, *err)
	}
	if err := IsRequired("grantee", req.Grantee); err != nil {
		errors = append(errors, *err)
	}
	if err := IsRequired("granter", req.Granter); err != nil {
		errors = append(errors, *err)
	}
	if err := IsRequired("signature", req.Signature); err != nil {
		errors = append(errors, *err)
	}
	
	// Format validations
	if err := IsValidCID("cid", req.CID); err != nil {
		errors = append(errors, *err)
	}
	if err := IsValidEthereumAddress("grantee", req.Grantee); err != nil {
		errors = append(errors, *err)
	}
	if err := IsValidEthereumAddress("granter", req.Granter); err != nil {
		errors = append(errors, *err)
	}
	if err := IsValidSignature("signature", req.Signature); err != nil {
		errors = append(errors, *err)
	}
	
	// Duration validation (max 1 year)
	if req.Duration > 365*24*3600 {
		errors = append(errors, ValidationError{Field: "duration", Message: "Duration cannot exceed 1 year"})
	}
	
	return errors
}

// Simple sanitization functions

// SanitizeFileName removes dangerous characters from filename
func SanitizeFileName(filename string) string {
	// Remove dangerous characters
	dangerous := []string{"/", "\\", "..", "<", ">", ":", "\"", "|", "?", "*"}
	
	sanitized := filename
	for _, char := range dangerous {
		sanitized = strings.ReplaceAll(sanitized, char, "_")
	}
	
	// Limit length
	if len(sanitized) > 255 {
		sanitized = sanitized[:255]
	}
	
	return sanitized
}

// SanitizeString removes basic HTML/script content
func SanitizeString(input string) string {
	// Remove HTML tags
	htmlTag := regexp.MustCompile(`<[^>]*>`)
	cleaned := htmlTag.ReplaceAllString(input, "")
	
	// Remove dangerous patterns
	dangerous := []string{"javascript:", "data:", "vbscript:"}
	
	for _, pattern := range dangerous {
		cleaned = strings.ReplaceAll(strings.ToLower(cleaned), pattern, "")
	}
	
	return strings.TrimSpace(cleaned)
}