package breach

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
)

func getLeakOSINTAPIKey() string {
	if key := os.Getenv("LEAKOSINT_API_KEY"); key != "" {
		return key
	}
	return "7608192451:0tcKJVLh"
}

func getLeakOSINTAPIURL() string {
	if url := os.Getenv("LEAKOSINT_API_URL"); url != "" {
		return url
	}
	return "https://leakosintapi.com/"
}

type CheckEmailRequest struct {
	Email string `json:"email" binding:"required,email"`
}

type LeakSource struct {
	Source    string   `json:"source"`
	Date      string   `json:"date"`
	DataTypes []string `json:"data_types"`
}

type LeakResponse struct {
	Email      string       `json:"email"`
	Sources    []string     `json:"sources"`
	TotalLeaks int          `json:"total_leaks"`
	LeakedData []LeakSource `json:"leaked_data"`
}

// CheckEmail checks if an email has been leaked using LeakOSINT API
func CheckEmail(c *gin.Context) {
	var req CheckEmailRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Call LeakOSINT API
	leakData, err := callLeakOSINTAPI(req.Email)
	if err != nil {
		fmt.Printf("LeakOSINT API error: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to check email: %v", err)})
		return
	}

	c.JSON(http.StatusOK, leakData)
}

func callLeakOSINTAPI(email string) (*LeakResponse, error) {
	// Prepare request body in LeakOSINT API format
	reqBody, err := json.Marshal(map[string]interface{}{
		"token":   getLeakOSINTAPIKey(),
		"request": email,
		"limit":   100,
		"lang":    "en",
		"type":    "json",
	})
	if err != nil {
		return nil, err
	}

	// Create HTTP request (POST to base URL, not /check)
	req, err := http.NewRequest("POST", getLeakOSINTAPIURL(), bytes.NewBuffer(reqBody))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")

	// Send request
	client := &http.Client{}
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

	fmt.Printf("LeakOSINT API status: %d\n", resp.StatusCode)
	fmt.Printf("LeakOSINT API response: %s\n", string(body))

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API returned status %d: %s", resp.StatusCode, string(body))
	}

	// Parse raw response first
	var rawResp map[string]interface{}
	if err := json.Unmarshal(body, &rawResp); err != nil {
		fmt.Printf("Failed to parse response: %v\n", err)
		return nil, err
	}

	// Check for API errors
	if errorCode, exists := rawResp["Error code"]; exists {
		return nil, fmt.Errorf("API error %v: %v", errorCode, rawResp["InfoError"])
	}

	// Parse the "List" field containing breach databases
	leakResp := &LeakResponse{
		Email:      email,
		Sources:    []string{},
		TotalLeaks: 0,
		LeakedData: []LeakSource{},
	}

	if listData, ok := rawResp["List"].(map[string]interface{}); ok {
		for dbName, dbData := range listData {
			leakResp.Sources = append(leakResp.Sources, dbName)
			leakResp.TotalLeaks++

			if dbMap, ok := dbData.(map[string]interface{}); ok {
				leak := LeakSource{
					Source:    dbName,
					DataTypes: []string{},
				}

				// Extract info/date if available
				if info, ok := dbMap["InfoLeak"].(string); ok {
					leak.Date = info
				}

				// Extract data types from first record
				if dataSlice, ok := dbMap["Data"].([]interface{}); ok && len(dataSlice) > 0 {
					if firstRecord, ok := dataSlice[0].(map[string]interface{}); ok {
						for key := range firstRecord {
							leak.DataTypes = append(leak.DataTypes, key)
						}
					}
				}

				leakResp.LeakedData = append(leakResp.LeakedData, leak)
			}
		}
	}

	return leakResp, nil
}
