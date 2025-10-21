package breach

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
)

func getHIBPAPIKey() string {
	if key := os.Getenv("HIBP_API_KEY"); key != "" {
		return key
	}
	return "8fc653bd98934b58beb09577d41a589c" // Fallback
}

func getHIBPAPIURL() string {
	if url := os.Getenv("HIBP_API_URL"); url != "" {
		return url
	}
	return "https://haveibeenpwned.com/api/v3"
}

type CheckEmailRequest struct {
	Email string `json:"email" binding:"required,email"`
}

// HIBP Breach Response Structure
type HIBPBreach struct {
	Name         string    `json:"Name"`
	Title        string    `json:"Title"`
	Domain       string    `json:"Domain"`
	BreachDate   string    `json:"BreachDate"`
	AddedDate    string    `json:"AddedDate"`
	ModifiedDate string    `json:"ModifiedDate"`
	PwnCount     int       `json:"PwnCount"`
	Description  string    `json:"Description"`
	LogoPath     string    `json:"LogoPath"`
	DataClasses  []string  `json:"DataClasses"`
	IsVerified   bool      `json:"IsVerified"`
	IsFabricated bool      `json:"IsFabricated"`
	IsSensitive  bool      `json:"IsSensitive"`
	IsRetired    bool      `json:"IsRetired"`
	IsSpamList   bool      `json:"IsSpamList"`
	IsMalware    bool      `json:"IsMalware"`
}

// Our unified response format
type LeakSource struct {
	Source      string   `json:"source"`
	Date        string   `json:"date"`
	DataTypes   []string `json:"data_types"`
	Description string   `json:"description"`
	PwnCount    int      `json:"pwn_count"`
	IsVerified  bool     `json:"is_verified"`
}

type LeakResponse struct {
	Email      string       `json:"email"`
	Sources    []string     `json:"sources"`
	TotalLeaks int          `json:"total_leaks"`
	LeakedData []LeakSource `json:"leaked_data"`
}

// CheckEmail checks if an email has been breached using HaveIBeenPwned API
func CheckEmail(c *gin.Context) {
	var req CheckEmailRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Try to get from Redis cache first
	cachedData, err := GetCachedBreachReport(req.Email)
	if err != nil {
		fmt.Printf("Redis cache error (non-fatal): %v\n", err)
	} else if cachedData != nil {
		// Cache hit - return cached data
		c.JSON(http.StatusOK, cachedData)
		return
	}

	// Cache miss - call HIBP API
	leakData, err := callHIBPAPI(req.Email)
	if err != nil {
		fmt.Printf("HIBP API error: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to check email: %v", err)})
		return
	}

	// Cache the result for 24 hours
	if err := CacheBreachReport(req.Email, leakData, 24*time.Hour); err != nil {
		fmt.Printf("Failed to cache breach report (non-fatal): %v\n", err)
	}

	c.JSON(http.StatusOK, leakData)
}

func callHIBPAPI(email string) (*LeakResponse, error) {
	// Construct HIBP API URL with truncateResponse=false to get full details
	url := fmt.Sprintf("%s/breachedaccount/%s?truncateResponse=false", getHIBPAPIURL(), email)

	// Create HTTP request
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	// Set required headers
	req.Header.Set("hibp-api-key", getHIBPAPIKey())
	req.Header.Set("User-Agent", "PasswordSync-BreachChecker")

	// Send request with timeout
	client := &http.Client{
		Timeout: 10 * time.Second,
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	fmt.Printf("HIBP API status: %d\n", resp.StatusCode)

	// Handle different status codes
	switch resp.StatusCode {
	case http.StatusOK:
		// Email found in breaches - parse response
		var breaches []HIBPBreach
		if err := json.Unmarshal(body, &breaches); err != nil {
			return nil, fmt.Errorf("failed to parse HIBP response: %v", err)
		}

		// Convert to our format
		leakResp := &LeakResponse{
			Email:      email,
			Sources:    []string{},
			TotalLeaks: len(breaches),
			LeakedData: []LeakSource{},
		}

		for _, breach := range breaches {
			leakResp.Sources = append(leakResp.Sources, breach.Name)
			leakResp.LeakedData = append(leakResp.LeakedData, LeakSource{
				Source:      breach.Name,
				Date:        breach.BreachDate,
				DataTypes:   breach.DataClasses,
				Description: breach.Description,
				PwnCount:    breach.PwnCount,
				IsVerified:  breach.IsVerified,
			})
		}

		fmt.Printf("✅ Found %d breaches for %s\n", len(breaches), email)
		return leakResp, nil

	case http.StatusNotFound:
		// Email not found in any breaches - good news!
		fmt.Printf("✅ No breaches found for %s\n", email)
		return &LeakResponse{
			Email:      email,
			Sources:    []string{},
			TotalLeaks: 0,
			LeakedData: []LeakSource{},
		}, nil

	case http.StatusBadRequest:
		return nil, fmt.Errorf("invalid email format")

	case http.StatusUnauthorized:
		return nil, fmt.Errorf("invalid HIBP API key")

	case http.StatusTooManyRequests:
		return nil, fmt.Errorf("rate limit exceeded - please wait and try again")

	default:
		return nil, fmt.Errorf("HIBP API returned status %d: %s", resp.StatusCode, string(body))
	}
}
