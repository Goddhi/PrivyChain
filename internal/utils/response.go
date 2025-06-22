package utils

import (
	"encoding/hex"
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/goddhi/privychain/internal/types"
)

// ResponseBuilder helps build consistent API responses
type ResponseBuilder struct {
	success bool
	data    interface{}
	error   string
	message string
	meta    map[string]interface{}
	headers map[string]string
	status  int
}

// NewResponseBuilder creates a new response builder
func NewResponseBuilder() *ResponseBuilder {
	return &ResponseBuilder{
		meta:    make(map[string]interface{}),
		headers: make(map[string]string),
		status:  http.StatusOK,
	}
}

// Success sets the response as successful
func (rb *ResponseBuilder) Success() *ResponseBuilder {
	rb.success = true
	return rb
}

// Error sets the response as error
func (rb *ResponseBuilder) Error(message string) *ResponseBuilder {
	rb.success = false
	rb.error = message
	return rb
}

// Data sets the response data
func (rb *ResponseBuilder) Data(data interface{}) *ResponseBuilder {
	rb.data = data
	return rb
}

// Message sets a custom message
func (rb *ResponseBuilder) Message(message string) *ResponseBuilder {
	rb.message = message
	return rb
}

// Meta adds metadata to the response
func (rb *ResponseBuilder) Meta(key string, value interface{}) *ResponseBuilder {
	rb.meta[key] = value
	return rb
}

// Header adds a response header
func (rb *ResponseBuilder) Header(key, value string) *ResponseBuilder {
	rb.headers[key] = value
	return rb
}

// Status sets the HTTP status code
func (rb *ResponseBuilder) Status(code int) *ResponseBuilder {
	rb.status = code
	return rb
}

// Build creates the response and sends it
func (rb *ResponseBuilder) Build(c *gin.Context) {
	// Set headers
	for key, value := range rb.headers {
		c.Header(key, value)
	}
	
	// Build response object
	response := types.APIResponse{
		Success: rb.success,
		Data:    rb.data,
		Error:   rb.error,
		Message: rb.message,
	}
	
	// Add metadata if present
	if len(rb.meta) > 0 {
		if response.Data != nil {
			// Wrap data with metadata
			wrappedData := map[string]interface{}{
				"data": response.Data,
			}
			for key, value := range rb.meta {
				wrappedData[key] = value
			}
			response.Data = wrappedData
		} else {
			response.Data = rb.meta
		}
	}
	
	c.JSON(rb.status, response)
}

// Predefined response helpers

// SuccessResponse sends a success response
func SuccessResponse(c *gin.Context, data interface{}) {
	NewResponseBuilder().
		Success().
		Data(data).
		Build(c)
}

// SuccessMessageResponse sends a success response with a message
func SuccessMessageResponse(c *gin.Context, message string, data interface{}) {
	NewResponseBuilder().
		Success().
		Message(message).
		Data(data).
		Build(c)
}

// ErrorResponse sends an error response
func ErrorResponse(c *gin.Context, status int, message string) {
	NewResponseBuilder().
		Status(status).
		Error(message).
		Build(c)
}

// ValidationErrorResponse sends validation error response
func ValidationErrorResponse(c *gin.Context, errors ValidationErrors) {
	NewResponseBuilder().
		Status(http.StatusBadRequest).
		Error("Validation failed").
		Data(map[string]interface{}{
			"validation_errors": errors,
		}).
		Build(c)
}

// UnauthorizedResponse sends unauthorized error
func UnauthorizedResponse(c *gin.Context, message string) {
	if message == "" {
		message = "Unauthorized"
	}
	ErrorResponse(c, http.StatusUnauthorized, message)
}

// ForbiddenResponse sends forbidden error
func ForbiddenResponse(c *gin.Context, message string) {
	if message == "" {
		message = "Forbidden"
	}
	ErrorResponse(c, http.StatusForbidden, message)
}

// NotFoundResponse sends not found error
func NotFoundResponse(c *gin.Context, message string) {
	if message == "" {
		message = "Resource not found"
	}
	ErrorResponse(c, http.StatusNotFound, message)
}

// ConflictResponse sends conflict error
func ConflictResponse(c *gin.Context, message string) {
	if message == "" {
		message = "Resource conflict"
	}
	ErrorResponse(c, http.StatusConflict, message)
}

// TooManyRequestsResponse sends rate limit error
func TooManyRequestsResponse(c *gin.Context, message string) {
	if message == "" {
		message = "Too many requests"
	}
	NewResponseBuilder().
		Status(http.StatusTooManyRequests).
		Error(message).
		Header("Retry-After", "60").
		Build(c)
}

// InternalServerErrorResponse sends internal server error
func InternalServerErrorResponse(c *gin.Context, message string) {
	if message == "" {
		message = "Internal server error"
	}
	ErrorResponse(c, http.StatusInternalServerError, message)
}

// ServiceUnavailableResponse sends service unavailable error
func ServiceUnavailableResponse(c *gin.Context, message string) {
	if message == "" {
		message = "Service temporarily unavailable"
	}
	NewResponseBuilder().
		Status(http.StatusServiceUnavailable).
		Error(message).
		Header("Retry-After", "300").
		Build(c)
}

// GenerateRequestID generates a unique request ID
func GenerateRequestID() string {
	bytes := make([]byte, 8)
	// This would use crypto/rand in a real implementation
	for i := range bytes {
		bytes[i] = byte(time.Now().UnixNano() % 256)
	}
	return hex.EncodeToString(bytes)
}

// GetRequestID gets or generates a request ID
func GetRequestID(c *gin.Context) string {
	if id := c.GetHeader("X-Request-ID"); id != "" {
		return id
	}
	
	if id := c.GetString("request_id"); id != "" {
		return id
	}
	
	// Generate new ID
	id := GenerateRequestID()
	c.Set("request_id", id)
	return id
}

// JSON utilities

// PrettyJSON marshals data to pretty JSON
func PrettyJSON(data interface{}) ([]byte, error) {
	return json.MarshalIndent(data, "", "  ")
}

// Error formatting

// FormatValidationErrors formats validation errors for API response
func FormatValidationErrors(errors ValidationErrors) map[string]interface{} {
	formatted := make(map[string][]map[string]string)
	
	for _, err := range errors {
		if _, exists := formatted[err.Field]; !exists {
			formatted[err.Field] = make([]map[string]string, 0)
		}
		
		formatted[err.Field] = append(formatted[err.Field], map[string]string{
			"message": err.Message,
		})
	}
	
	return map[string]interface{}{
		"errors": formatted,
		"count":  len(errors),
	}
}

// Security headers

// SecurityHeadersMiddleware adds security headers
func SecurityHeadersMiddleware() gin.HandlerFunc {
	return gin.HandlerFunc(func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("X-XSS-Protection", "1; mode=block")
		c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		c.Header("Content-Security-Policy", "default-src 'self'")
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
		c.Next()
	})
}