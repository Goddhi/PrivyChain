package services

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/golang-jwt/jwt/v5"
	"github.com/goddhi/privychain/pkg/errors"
)

type AuthService struct {
	jwtSecret   string
	tokenExpiry time.Duration
	issuer      string
}

type Claims struct {
	UserAddress string `json:"user_address"`
	Role        string `json:"role"`
	jwt.RegisteredClaims
}

type AuthTokens struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	ExpiresAt    time.Time `json:"expires_at"`
	TokenType    string    `json:"token_type"`
}

func NewAuthService(jwtSecret string) *AuthService {
	return &AuthService{
		jwtSecret:   jwtSecret,
		tokenExpiry: time.Hour * 24, // 24 hours
		issuer:      "privychain-backend",
	}
}

// VerifySignature verifies an Ethereum signature
func (s *AuthService) VerifySignature(address, signature, message string) bool {
	// Create the message hash that was signed
	messageHash := s.createMessageHash(message)

	// Decode the signature
	sig, err := hex.DecodeString(strings.TrimPrefix(signature, "0x"))
	if err != nil {
		return false
	}

	if len(sig) != 65 {
		return false
	}

	// Ethereum signatures have v value 27 or 28, but we need 0 or 1
	if sig[64] == 27 || sig[64] == 28 {
		sig[64] -= 27
	}

	// Recover the public key from the signature
	pubKey, err := crypto.SigToPub(messageHash.Bytes(), sig)
	if err != nil {
		return false
	}

	// Get the address from the public key
	recoveredAddr := crypto.PubkeyToAddress(*pubKey)
	expectedAddr := common.HexToAddress(address)

	return recoveredAddr == expectedAddr
}

// GenerateNonce generates a random nonce for authentication
func (s *AuthService) GenerateNonce() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// CreateAuthMessage creates a standardized authentication message
func (s *AuthService) CreateAuthMessage(nonce, timestamp string) string {
	return fmt.Sprintf("PrivyChain Authentication\nNonce: %s\nTimestamp: %s", nonce, timestamp)
}

// GenerateTokens generates JWT access and refresh tokens
func (s *AuthService) GenerateTokens(userAddress, role string) (*AuthTokens, error) {
	now := time.Now()
	expiresAt := now.Add(s.tokenExpiry)

	// Create access token claims
	claims := Claims{
		UserAddress: userAddress,
		Role:        role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			Issuer:    s.issuer,
			Subject:   userAddress,
			ID:        s.generateJTI(),
		},
	}

	// Create access token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	accessToken, err := token.SignedString([]byte(s.jwtSecret))
	if err != nil {
		return nil, errors.NewAuthError("Failed to generate access token")
	}

	// Create refresh token
	refreshClaims := jwt.RegisteredClaims{
		ExpiresAt: jwt.NewNumericDate(now.Add(time.Hour * 24 * 7)), // 7 days
		IssuedAt:  jwt.NewNumericDate(now),
		NotBefore: jwt.NewNumericDate(now),
		Issuer:    s.issuer,
		Subject:   userAddress,
		ID:        s.generateJTI(),
	}

	refreshTokenJWT := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refreshToken, err := refreshTokenJWT.SignedString([]byte(s.jwtSecret))
	if err != nil {
		return nil, errors.NewAuthError("Failed to generate refresh token")
	}

	return &AuthTokens{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresAt:    expiresAt,
		TokenType:    "Bearer",
	}, nil
}

// ValidateToken validates a JWT token and returns the claims
func (s *AuthService) ValidateToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(s.jwtSecret), nil
	})

	if err != nil {
		return nil, errors.NewAuthError("Invalid token")
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}

	return nil, errors.NewAuthError("Invalid token claims")
}

// ValidateUserRole checks if a user has the required role
func (s *AuthService) ValidateUserRole(claims *Claims, requiredRole string) bool {
	if requiredRole == "" {
		return true // No role required
	}

	switch requiredRole {
	case "admin":
		return claims.Role == "admin"
	case "user":
		return claims.Role == "user" || claims.Role == "admin"
	case "verified":
		return claims.Role == "verified" || claims.Role == "admin"
	default:
		return claims.Role == requiredRole
	}
}

// Permission system
type Permission string

const (
	PermissionUploadFile   Permission = "upload_file"
	PermissionDownloadFile Permission = "download_file"
	PermissionDeleteFile   Permission = "delete_file"
	PermissionGrantAccess  Permission = "grant_access"
	PermissionAdminAccess  Permission = "admin_access"
)

// CheckPermission checks if a user has a specific permission
func (s *AuthService) CheckPermission(userRole string, permission Permission) bool {
	rolePermissions := map[string][]Permission{
		"user": {
			PermissionUploadFile,
			PermissionDownloadFile,
			PermissionGrantAccess,
		},
		"verified": {
			PermissionUploadFile,
			PermissionDownloadFile,
			PermissionDeleteFile,
			PermissionGrantAccess,
		},
		"admin": {
			PermissionUploadFile,
			PermissionDownloadFile,
			PermissionDeleteFile,
			PermissionGrantAccess,
			PermissionAdminAccess,
		},
	}

	permissions, exists := rolePermissions[userRole]
	if !exists {
		return false
	}

	for _, p := range permissions {
		if p == permission {
			return true
		}
	}

	return false
}

// Helper functions

func (s *AuthService) createMessageHash(message string) common.Hash {
	// Ethereum signed message prefix
	prefix := fmt.Sprintf("\x19Ethereum Signed Message:\n%d", len(message))
	return crypto.Keccak256Hash([]byte(prefix + message))
}

func (s *AuthService) generateJTI() string {
	bytes := make([]byte, 16)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}