package errors


import (
	"fmt"
	"runtime"
	"time"
)

// PrivyChainError represents a custom error with additional context
type PrivyChainError struct {
	Code      string                 `json:"code"`
	Message   string                 `json:"message"`
	Details   map[string]interface{} `json:"details,omitempty"`
	Cause     error                  `json:"cause,omitempty"`
	Timestamp time.Time              `json:"timestamp"`
	File      string                 `json:"file,omitempty"`
	Line      int                    `json:"line,omitempty"`
	Stack     string                 `json:"stack,omitempty"`
}

// Error implements the error interface
func (e *PrivyChainError) Error() string {
	if e.Cause != nil {
		return fmt.Sprintf("%s: %s (caused by: %v)", e.Code, e.Message, e.Cause)
	}
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

// Unwrap returns the underlying cause
func (e *PrivyChainError) Unwrap() error {
	return e.Cause
}

// WithDetail adds a detail to the error
func (e *PrivyChainError) WithDetail(key string, value interface{}) *PrivyChainError {
	if e.Details == nil {
		e.Details = make(map[string]interface{})
	}
	e.Details[key] = value
	return e
}

// WithCause adds a cause to the error
func (e *PrivyChainError) WithCause(cause error) *PrivyChainError {
	e.Cause = cause
	return e
}

// WithStack adds stack trace information
func (e *PrivyChainError) WithStack() *PrivyChainError {
	if _, file, line, ok := runtime.Caller(1); ok {
		e.File = file
		e.Line = line
	}
	
	// Capture stack trace
	buf := make([]byte, 1024*4)
	n := runtime.Stack(buf, false)
	e.Stack = string(buf[:n])
	
	return e
}

// Error codes
const (
	// General errors
	ErrCodeInternal      = "INTERNAL_ERROR"
	ErrCodeValidation    = "VALIDATION_ERROR"
	ErrCodeNotFound      = "NOT_FOUND"
	ErrCodeUnauthorized  = "UNAUTHORIZED"
	ErrCodeForbidden     = "FORBIDDEN"
	ErrCodeConflict      = "CONFLICT"
	ErrCodeRateLimit     = "RATE_LIMIT_EXCEEDED"
	ErrCodeServiceDown   = "SERVICE_UNAVAILABLE"
	
	// Authentication errors
	ErrCodeAuth          = "AUTH_ERROR"
	ErrCodeInvalidToken  = "INVALID_TOKEN"
	ErrCodeExpiredToken  = "EXPIRED_TOKEN"
	ErrCodeInvalidSignature = "INVALID_SIGNATURE"
	
	// File operation errors
	ErrCodeFileUpload    = "FILE_UPLOAD_ERROR"
	ErrCodeFileDownload  = "FILE_DOWNLOAD_ERROR"
	ErrCodeFileNotFound  = "FILE_NOT_FOUND"
	ErrCodeFileTooLarge  = "FILE_TOO_LARGE"
	ErrCodeInvalidFile   = "INVALID_FILE"
	
	// Encryption errors
	ErrCodeEncryption    = "ENCRYPTION_ERROR"
	ErrCodeDecryption    = "DECRYPTION_ERROR"
	ErrCodeKeyGeneration = "KEY_GENERATION_ERROR"
	ErrCodeKeyNotFound   = "ENCRYPTION_KEY_NOT_FOUND"
	
	// Storage errors
	ErrCodeStorage       = "STORAGE_ERROR"
	ErrCodeStorageUpload = "STORAGE_UPLOAD_ERROR"
	ErrCodeStorageRetrieve = "STORAGE_RETRIEVE_ERROR"
	ErrCodeStorageDelete = "STORAGE_DELETE_ERROR"
	ErrCodeCIDInvalid    = "INVALID_CID"
	
	// Blockchain errors
	ErrCodeBlockchain    = "BLOCKCHAIN_ERROR"
	ErrCodeTransaction   = "TRANSACTION_ERROR"
	ErrCodeContractCall  = "CONTRACT_CALL_ERROR"
	ErrCodeInsufficientFunds = "INSUFFICIENT_FUNDS"
	ErrCodeGasEstimation = "GAS_ESTIMATION_ERROR"
	
	// Database errors
	ErrCodeDatabase      = "DATABASE_ERROR"
	ErrCodeDatabaseConnection = "DATABASE_CONNECTION_ERROR"
	ErrCodeDatabaseQuery = "DATABASE_QUERY_ERROR"
	ErrCodeMigration     = "MIGRATION_ERROR"
	
	// External service errors
	ErrCodeExternalAPI   = "EXTERNAL_API_ERROR"
	ErrCodePrivyAPI      = "PRIVY_API_ERROR"
	ErrCodeWeb3Storage   = "WEB3_STORAGE_ERROR"
	ErrCodeLighthouse    = "LIGHTHOUSE_ERROR"
	
	// Configuration errors
	ErrCodeConfig        = "CONFIGURATION_ERROR"
	ErrCodeMissingConfig = "MISSING_CONFIGURATION"
	ErrCodeInvalidConfig = "INVALID_CONFIGURATION"
	
	// Access control errors
	ErrCodeAccessDenied  = "ACCESS_DENIED"
	ErrCodeInsufficientPermissions = "INSUFFICIENT_PERMISSIONS"
	ErrCodeExpiredAccess = "EXPIRED_ACCESS"
	
	// Quota and limits
	ErrCodeQuotaExceeded = "QUOTA_EXCEEDED"
	ErrCodeStorageLimit  = "STORAGE_LIMIT_EXCEEDED"
	ErrCodeFileSizeLimit = "FILE_SIZE_LIMIT_EXCEEDED"
)

// Error constructors

// NewError creates a new PrivyChainError
func NewError(code, message string) *PrivyChainError {
	return &PrivyChainError{
		Code:      code,
		Message:   message,
		Timestamp: time.Now(),
	}
}

// NewErrorWithCause creates a new error with a cause
func NewErrorWithCause(code, message string, cause error) *PrivyChainError {
	return &PrivyChainError{
		Code:      code,
		Message:   message,
		Cause:     cause,
		Timestamp: time.Now(),
	}
}

// Specific error constructors

func NewInternalError(message string, cause error) *PrivyChainError {
	return NewErrorWithCause(ErrCodeInternal, message, cause).WithStack()
}

func NewValidationError(message string) *PrivyChainError {
	return NewError(ErrCodeValidation, message)
}

func NewNotFoundError(resource string) *PrivyChainError {
	return NewError(ErrCodeNotFound, fmt.Sprintf("%s not found", resource))
}

func NewUnauthorizedError(message string) *PrivyChainError {
	if message == "" {
		message = "Unauthorized access"
	}
	return NewError(ErrCodeUnauthorized, message)
}

func NewForbiddenError(message string) *PrivyChainError {
	if message == "" {
		message = "Access forbidden"
	}
	return NewError(ErrCodeForbidden, message)
}

func NewConflictError(resource string) *PrivyChainError {
	return NewError(ErrCodeConflict, fmt.Sprintf("%s already exists", resource))
}

func NewRateLimitError(message string) *PrivyChainError {
	if message == "" {
		message = "Rate limit exceeded"
	}
	return NewError(ErrCodeRateLimit, message)
}

// Authentication errors

func NewAuthError(message string) *PrivyChainError {
	return NewError(ErrCodeAuth, message)
}

func NewInvalidTokenError() *PrivyChainError {
	return NewError(ErrCodeInvalidToken, "Invalid or malformed token")
}

func NewExpiredTokenError() *PrivyChainError {
	return NewError(ErrCodeExpiredToken, "Token has expired")
}

func NewInvalidSignatureError() *PrivyChainError {
	return NewError(ErrCodeInvalidSignature, "Invalid signature")
}

// File operation errors

func NewFileUploadError(message string, cause error) *PrivyChainError {
	return NewErrorWithCause(ErrCodeFileUpload, message, cause)
}

func NewFileDownloadError(message string, cause error) *PrivyChainError {
	return NewErrorWithCause(ErrCodeFileDownload, message, cause)
}

func NewFileNotFoundError(cid string) *PrivyChainError {
	return NewError(ErrCodeFileNotFound, fmt.Sprintf("File with CID %s not found", cid)).
		WithDetail("cid", cid)
}

func NewFileTooLargeError(size, maxSize int64) *PrivyChainError {
	return NewError(ErrCodeFileTooLarge, 
		fmt.Sprintf("File size %d exceeds maximum allowed size %d", size, maxSize)).
		WithDetail("file_size", size).
		WithDetail("max_size", maxSize)
}

func NewInvalidFileError(message string) *PrivyChainError {
	return NewError(ErrCodeInvalidFile, message)
}

// Encryption errors

func NewEncryptionError(message string, cause error) *PrivyChainError {
	return NewErrorWithCause(ErrCodeEncryption, message, cause)
}

func NewDecryptionError(message string, cause error) *PrivyChainError {
	return NewErrorWithCause(ErrCodeDecryption, message, cause)
}

func NewKeyGenerationError(cause error) *PrivyChainError {
	return NewErrorWithCause(ErrCodeKeyGeneration, "Failed to generate encryption key", cause)
}

func NewKeyNotFoundError(userAddress string) *PrivyChainError {
	return NewError(ErrCodeKeyNotFound, 
		fmt.Sprintf("Encryption key not found for user %s", userAddress)).
		WithDetail("user_address", userAddress)
}

// Storage errors

func NewStorageError(message string, cause error) *PrivyChainError {
	return NewErrorWithCause(ErrCodeStorage, message, cause)
}

func NewStorageUploadError(provider string, cause error) *PrivyChainError {
	return NewErrorWithCause(ErrCodeStorageUpload, 
		fmt.Sprintf("Failed to upload to %s", provider), cause).
		WithDetail("provider", provider)
}

func NewStorageRetrieveError(provider, cid string, cause error) *PrivyChainError {
	return NewErrorWithCause(ErrCodeStorageRetrieve, 
		fmt.Sprintf("Failed to retrieve from %s", provider), cause).
		WithDetail("provider", provider).
		WithDetail("cid", cid)
}

func NewInvalidCIDError(cid string) *PrivyChainError {
	return NewError(ErrCodeCIDInvalid, fmt.Sprintf("Invalid CID: %s", cid)).
		WithDetail("cid", cid)
}

// Blockchain errors

func NewBlockchainError(message string, cause error) *PrivyChainError {
	return NewErrorWithCause(ErrCodeBlockchain, message, cause)
}

func NewTransactionError(txHash string, cause error) *PrivyChainError {
	return NewErrorWithCause(ErrCodeTransaction, "Transaction failed", cause).
		WithDetail("tx_hash", txHash)
}

func NewContractCallError(method string, cause error) *PrivyChainError {
	return NewErrorWithCause(ErrCodeContractCall, 
		fmt.Sprintf("Contract method %s failed", method), cause).
		WithDetail("method", method)
}

func NewInsufficientFundsError(required, available string) *PrivyChainError {
	return NewError(ErrCodeInsufficientFunds, "Insufficient funds for transaction").
		WithDetail("required", required).
		WithDetail("available", available)
}

// Database errors

func NewDatabaseError(message string, cause error) *PrivyChainError {
	return NewErrorWithCause(ErrCodeDatabase, message, cause)
}

func NewDatabaseConnectionError(cause error) *PrivyChainError {
	return NewErrorWithCause(ErrCodeDatabaseConnection, "Database connection failed", cause)
}

func NewDatabaseQueryError(query string, cause error) *PrivyChainError {
	return NewErrorWithCause(ErrCodeDatabaseQuery, "Database query failed", cause).
		WithDetail("query", query)
}

func NewMigrationError(version string, cause error) *PrivyChainError {
	return NewErrorWithCause(ErrCodeMigration, 
		fmt.Sprintf("Migration %s failed", version), cause).
		WithDetail("version", version)
}

// External service errors

func NewExternalAPIError(service string, cause error) *PrivyChainError {
	return NewErrorWithCause(ErrCodeExternalAPI, 
		fmt.Sprintf("External API %s error", service), cause).
		WithDetail("service", service)
}

func NewPrivyAPIError(cause error) *PrivyChainError {
	return NewErrorWithCause(ErrCodePrivyAPI, "Privy API error", cause)
}

func NewWeb3StorageError(cause error) *PrivyChainError {
	return NewErrorWithCause(ErrCodeWeb3Storage, "Web3.Storage API error", cause)
}

func NewLighthouseError(cause error) *PrivyChainError {
	return NewErrorWithCause(ErrCodeLighthouse, "Lighthouse API error", cause)
}

// Configuration errors

func NewConfigError(message string) *PrivyChainError {
	return NewError(ErrCodeConfig, message)
}

func NewMissingConfigError(key string) *PrivyChainError {
	return NewError(ErrCodeMissingConfig, fmt.Sprintf("Missing configuration: %s", key)).
		WithDetail("config_key", key)
}

func NewInvalidConfigError(key, value string) *PrivyChainError {
	return NewError(ErrCodeInvalidConfig, 
		fmt.Sprintf("Invalid configuration value for %s: %s", key, value)).
		WithDetail("config_key", key).
		WithDetail("config_value", value)
}

// Access control errors

func NewAccessDeniedError(resource string) *PrivyChainError {
	return NewError(ErrCodeAccessDenied, fmt.Sprintf("Access denied to %s", resource)).
		WithDetail("resource", resource)
}

func NewInsufficientPermissionsError(required string) *PrivyChainError {
	return NewError(ErrCodeInsufficientPermissions, 
		fmt.Sprintf("Insufficient permissions: %s required", required)).
		WithDetail("required_permission", required)
}

func NewExpiredAccessError(resource string) *PrivyChainError {
	return NewError(ErrCodeExpiredAccess, fmt.Sprintf("Access to %s has expired", resource)).
		WithDetail("resource", resource)
}

// Quota and limit errors

func NewQuotaExceededError(quotaType string, limit, current int64) *PrivyChainError {
	return NewError(ErrCodeQuotaExceeded, 
		fmt.Sprintf("%s quota exceeded: %d/%d", quotaType, current, limit)).
		WithDetail("quota_type", quotaType).
		WithDetail("limit", limit).
		WithDetail("current", current)
}

func NewStorageLimitError(used, limit int64) *PrivyChainError {
	return NewError(ErrCodeStorageLimit, 
		fmt.Sprintf("Storage limit exceeded: %d/%d bytes", used, limit)).
		WithDetail("used", used).
		WithDetail("limit", limit)
}

// Error utilities

// IsType checks if an error is of a specific PrivyChain error type
func IsType(err error, code string) bool {
	if pcErr, ok := err.(*PrivyChainError); ok {
		return pcErr.Code == code
	}
	return false
}

// GetCode extracts the error code from an error
func GetCode(err error) string {
	if pcErr, ok := err.(*PrivyChainError); ok {
		return pcErr.Code
	}
	return ErrCodeInternal
}

// GetDetails extracts details from an error
func GetDetails(err error) map[string]interface{} {
	if pcErr, ok := err.(*PrivyChainError); ok {
		return pcErr.Details
	}
	return nil
}

// Wrap wraps a standard error as a PrivyChain error
func Wrap(err error, code, message string) *PrivyChainError {
	return NewErrorWithCause(code, message, err)
}

// WrapWithStack wraps an error and adds stack trace
func WrapWithStack(err error, code, message string) *PrivyChainError {
	return NewErrorWithCause(code, message, err).WithStack()
}

// Chain creates an error chain
func Chain(errors ...error) *PrivyChainError {
	if len(errors) == 0 {
		return NewInternalError("No errors provided to chain", nil)
	}
	
	root := errors[0]
	for i := 1; i < len(errors); i++ {
		if pcErr, ok := root.(*PrivyChainError); ok {
			pcErr.WithCause(errors[i])
		} else {
			root = NewErrorWithCause(ErrCodeInternal, root.Error(), errors[i])
		}
	}
	
	if pcErr, ok := root.(*PrivyChainError); ok {
		return pcErr
	}
	
	return NewErrorWithCause(ErrCodeInternal, root.Error(), nil)
}

// Recovery helpers for panic handling

// RecoverToError recovers from panic and converts to error
func RecoverToError() error {
	if r := recover(); r != nil {
		switch v := r.(type) {
		case error:
			return NewInternalError("Panic recovered", v).WithStack()
		case string:
			return NewInternalError("Panic recovered: "+v, nil).WithStack()
		default:
			return NewInternalError(fmt.Sprintf("Panic recovered: %v", v), nil).WithStack()
		}
	}
	return nil
}