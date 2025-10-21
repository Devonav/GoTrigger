package cve

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
)

const (
	NISTAPIKEY = "db4b1c7e-5a24-4d08-9a95-97f177070b43"
	NISTAPIURL = "https://services.nvd.nist.gov/rest/json/cves/2.0"
)

type CVEMetric struct {
	CVSSV3 struct {
		BaseScore    float64 `json:"baseScore"`
		BaseSeverity string  `json:"baseSeverity"`
	} `json:"cvssV3"`
}

type CVEItem struct {
	ID          string `json:"id"`
	Description string `json:"description"`
	Published   string `json:"published"`
	Modified    string `json:"lastModified"`
	Metrics     struct {
		CVSSMetricV31 []CVEMetric `json:"cvssMetricV31"`
	} `json:"metrics"`
}

type CVEResponse struct {
	TotalResults int       `json:"totalResults"`
	CVEs         []CVEItem `json:"vulnerabilities"`
}

type SearchCVERequest struct {
	Keyword string `json:"keyword"`
	Limit   int    `json:"limit"`
}

// SearchCVEs searches for CVEs using NIST API
func SearchCVEs(c *gin.Context) {
	var req SearchCVERequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Limit == 0 {
		req.Limit = 10
	}

	// Call NIST API
	cveData, err := callNISTAPI(req.Keyword, req.Limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to search CVEs: %v", err)})
		return
	}

	c.JSON(http.StatusOK, cveData)
}

// GetLatestCVEs gets the latest CVEs
func GetLatestCVEs(c *gin.Context) {
	limit := 20
	if limitParam := c.Query("limit"); limitParam != "" {
		fmt.Sscanf(limitParam, "%d", &limit)
	}

	cveData, err := callNISTAPI("", limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to get CVEs: %v", err)})
		return
	}

	c.JSON(http.StatusOK, cveData)
}

func callNISTAPI(keyword string, limit int) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s?resultsPerPage=%d", NISTAPIURL, limit)

	if keyword != "" {
		url += fmt.Sprintf("&keywordSearch=%s", keyword)
	}

	// Create HTTP request
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("apiKey", NISTAPIKEY)

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

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API returned status %d: %s", resp.StatusCode, string(body))
	}

	// Parse response
	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}

	return result, nil
}
