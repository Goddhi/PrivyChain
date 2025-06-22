package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// CORS middleware
func CORS() gin.HandlerFunc {
	return cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"*"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	})
}

// Rate limiting middleware
type rateLimiter struct {
	visitors map[string]*visitor
	mutex    sync.RWMutex
}

type visitor struct {
	requests int
	lastSeen time.Time
}

var limiter = &rateLimiter{
	visitors: make(map[string]*visitor),
}

func RateLimit() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		
		limiter.mutex.Lock()
		v, exists := limiter.visitors[ip]
		if !exists {
			limiter.visitors[ip] = &visitor{
				requests: 1,
				lastSeen: time.Now(),
			}
			limiter.mutex.Unlock()
			c.Next()
			return
		}

		// Reset counter if more than 1 minute has passed
		if time.Since(v.lastSeen) > time.Minute {
			v.requests = 1
			v.lastSeen = time.Now()
		} else {
			v.requests++
		}

		// Allow up to 100 requests per minute
		if v.requests > 100 {
			limiter.mutex.Unlock()
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error": "Rate limit exceeded",
			})
			c.Abort()
			return
		}

		limiter.mutex.Unlock()
		c.Next()
	}
}

// Security headers middleware
func SecurityHeaders() gin.HandlerFunc {
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