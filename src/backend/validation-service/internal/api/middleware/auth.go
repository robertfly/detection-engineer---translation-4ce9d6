// Package middleware provides secure authentication and authorization middleware
// for the validation service API endpoints.
// Version: 1.0.0
package middleware

import (
    "context"
    "crypto/rsa"
    "encoding/base64"
    "errors"
    "fmt"
    "regexp"
    "strings"
    "time"

    "github.com/gin-gonic/gin" // v1.9.1
    "github.com/golang-jwt/jwt/v5" // v5.0.0
    "github.com/go-redis/redis/v8" // v8.11.5
    "golang.org/x/time/rate" // v0.0.0-20220922220347-f3bd1da661af

    "validation-service/internal/config"
    "validation-service/pkg/logger"
)

// Global variables for middleware configuration
var (
    jwtPublicKey *rsa.PublicKey
    contextKeyUser = "user"
    tokenBlacklist *redis.Client
    authFailureLimit = rate.NewLimiter(rate.Every(1*time.Minute), 5)
    allowedRoles = map[string]bool{
        "admin":    true,
        "engineer": true,
        "analyst":  true,
        "reader":   true,
    }
    requiredPermissions = []string{"validate_detections"}
)

// Claims extends jwt.RegisteredClaims with custom fields for RBAC
type Claims struct {
    UserId         string    `json:"user_id"`
    Role           string    `json:"role"`
    Permissions    []string  `json:"permissions"`
    TokenIssueTime time.Time `json:"token_issue_time"`
    jwt.RegisteredClaims
}

// Validate implements custom validation for Claims
func (c Claims) Validate() error {
    if c.UserId == "" {
        return errors.New("missing user_id claim")
    }
    if !allowedRoles[c.Role] {
        return fmt.Errorf("invalid role: %s", c.Role)
    }
    if len(c.Permissions) == 0 {
        return errors.New("missing permissions")
    }
    if c.TokenIssueTime.IsZero() {
        return errors.New("missing token issue time")
    }
    return nil
}

// AuthMiddleware returns a Gin middleware function that implements JWT authentication
func AuthMiddleware() gin.HandlerFunc {
    // Initialize security logger
    log := logger.GetLogger()
    cfg := config.GetConfig()

    // Initialize Redis connection for token blacklist
    tokenBlacklist = redis.NewClient(&redis.Options{
        Addr: cfg.Security.RedisAddr,
        DB:   0,
    })

    return func(c *gin.Context) {
        // Extract token from request
        tokenString, err := extractToken(c)
        if err != nil {
            log.Error("Failed to extract token",
                "error", err,
                "ip", c.ClientIP(),
            )
            c.AbortWithStatusJSON(401, gin.H{"error": "Invalid authentication token"})
            return
        }

        // Check rate limiting for auth failures
        if !authFailureLimit.Allow() {
            log.Warn("Rate limit exceeded for authentication attempts",
                "ip", c.ClientIP(),
            )
            c.AbortWithStatusJSON(429, gin.H{"error": "Too many authentication attempts"})
            return
        }

        // Check token blacklist
        ctx := context.Background()
        if exists, _ := tokenBlacklist.Exists(ctx, tokenString).Result(); exists == 1 {
            log.Warn("Blacklisted token used",
                "ip", c.ClientIP(),
            )
            c.AbortWithStatusJSON(401, gin.H{"error": "Token has been revoked"})
            return
        }

        // Validate token
        claims, err := validateToken(tokenString)
        if err != nil {
            log.Error("Token validation failed",
                "error", err,
                "ip", c.ClientIP(),
            )
            c.AbortWithStatusJSON(401, gin.H{"error": "Invalid or expired token"})
            return
        }

        // Store validated claims in context
        c.Set(contextKeyUser, claims)

        // Audit log successful authentication
        log.Info("Successful authentication",
            "user_id", claims.UserId,
            "role", claims.Role,
            "ip", c.ClientIP(),
        )

        c.Next()
    }
}

// extractToken securely extracts the JWT token from the Authorization header
func extractToken(c *gin.Context) (string, error) {
    authHeader := c.GetHeader("Authorization")
    if authHeader == "" {
        return "", errors.New("missing authorization header")
    }

    // Validate Bearer token format
    bearerRegex := regexp.MustCompile(`^Bearer\s+([A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.[A-Za-z0-9-_.+/=]+)$`)
    matches := bearerRegex.FindStringSubmatch(authHeader)
    if len(matches) != 2 {
        return "", errors.New("invalid authorization header format")
    }

    // Validate token length
    token := matches[1]
    if len(token) > 4096 { // Reasonable maximum token length
        return "", errors.New("token exceeds maximum length")
    }

    return token, nil
}

// validateToken performs comprehensive token validation
func validateToken(tokenString string) (*Claims, error) {
    token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
        // Validate signing method
        if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
            return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
        }
        return jwtPublicKey, nil
    })

    if err != nil {
        return nil, fmt.Errorf("failed to parse token: %w", err)
    }

    claims, ok := token.Claims.(*Claims)
    if !ok || !token.Valid {
        return nil, errors.New("invalid token claims")
    }

    // Validate custom claims
    if err := claims.Validate(); err != nil {
        return nil, fmt.Errorf("claims validation failed: %w", err)
    }

    // Validate token freshness
    if time.Since(claims.TokenIssueTime) > 1*time.Hour {
        return nil, errors.New("token has expired")
    }

    // Validate required permissions
    hasRequiredPerms := true
    for _, required := range requiredPermissions {
        found := false
        for _, perm := range claims.Permissions {
            if perm == required {
                found = true
                break
            }
        }
        if !found {
            hasRequiredPerms = false
            break
        }
    }
    if !hasRequiredPerms {
        return nil, errors.New("insufficient permissions")
    }

    return claims, nil
}