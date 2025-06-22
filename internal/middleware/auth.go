package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/goddhi/privychain/internal/services"
	"github.com/goddhi/privychain/internal/types"
)

// AuthMiddleware creates a middleware for JWT authentication
func AuthMiddleware(authService *services.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, types.APIResponse{
				Success: false,
				Error:   "Authorization header required",
			})
			c.Abort()
			return
		}

		// Extract token from Bearer header
		tokenParts := strings.Split(authHeader, " ")
		if len(tokenParts) != 2 || tokenParts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, types.APIResponse{
				Success: false,
				Error:   "Invalid authorization header format",
			})
			c.Abort()
			return
		}

		token := tokenParts[1]

		// Validate token
		claims, err := authService.ValidateToken(token)
		if err != nil {
			c.JSON(http.StatusUnauthorized, types.APIResponse{
				Success: false,
				Error:   "Invalid or expired token",
			})
			c.Abort()
			return
		}

		// Set user information in context
		c.Set("user_address", claims.UserAddress)
		c.Set("user_role", claims.Role)
		c.Set("user_claims", claims)

		c.Next()
	}
}

// OptionalAuthMiddleware provides optional authentication
func OptionalAuthMiddleware(authService *services.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.Next()
			return
		}

		tokenParts := strings.Split(authHeader, " ")
		if len(tokenParts) == 2 && tokenParts[0] == "Bearer" {
			token := tokenParts[1]
			if claims, err := authService.ValidateToken(token); err == nil {
				c.Set("user_address", claims.UserAddress)
				c.Set("user_role", claims.Role)
				c.Set("user_claims", claims)
			}
		}

		c.Next()
	}
}

// RequireRoleMiddleware creates middleware that requires specific role
func RequireRoleMiddleware(authService *services.AuthService, requiredRole string) gin.HandlerFunc {
	return func(c *gin.Context) {
		claims, exists := c.Get("user_claims")
		if !exists {
			c.JSON(http.StatusUnauthorized, types.APIResponse{
				Success: false,
				Error:   "Authentication required",
			})
			c.Abort()
			return
		}

		userClaims, ok := claims.(*services.Claims)
		if !ok {
			c.JSON(http.StatusInternalServerError, types.APIResponse{
				Success: false,
				Error:   "Invalid user claims",
			})
			c.Abort()
			return
		}

		if !authService.ValidateUserRole(userClaims, requiredRole) {
			c.JSON(http.StatusForbidden, types.APIResponse{
				Success: false,
				Error:   "Insufficient permissions",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// RequirePermissionMiddleware creates middleware that requires specific permission
func RequirePermissionMiddleware(authService *services.AuthService, permission services.Permission) gin.HandlerFunc {
	return func(c *gin.Context) {
		claims, exists := c.Get("user_claims")
		if !exists {
			c.JSON(http.StatusUnauthorized, types.APIResponse{
				Success: false,
				Error:   "Authentication required",
			})
			c.Abort()
			return
		}

		userClaims, ok := claims.(*services.Claims)
		if !ok {
			c.JSON(http.StatusInternalServerError, types.APIResponse{
				Success: false,
				Error:   "Invalid user claims",
			})
			c.Abort()
			return
		}

		if !authService.CheckPermission(userClaims.Role, permission) {
			c.JSON(http.StatusForbidden, types.APIResponse{
				Success: false,
				Error:   "Permission denied",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// SignatureAuthMiddleware validates Ethereum signatures for API calls
func SignatureAuthMiddleware(authService *services.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userAddress := c.GetHeader("X-User-Address")
		signature := c.GetHeader("X-Signature")
		timestamp := c.GetHeader("X-Timestamp")

		if userAddress == "" || signature == "" || timestamp == "" {
			c.JSON(http.StatusUnauthorized, types.APIResponse{
				Success: false,
				Error:   "Missing required signature headers",
			})
			c.Abort()
			return
		}

		// Create message to verify
		message := authService.CreateAuthMessage("", timestamp)

		// Verify signature
		if !authService.VerifySignature(userAddress, signature, message) {
			c.JSON(http.StatusUnauthorized, types.APIResponse{
				Success: false,
				Error:   "Invalid signature",
			})
			c.Abort()
			return
		}

		// Set user address in context
		c.Set("user_address", userAddress)
		c.Next()
	}
}