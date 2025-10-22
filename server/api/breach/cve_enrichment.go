package breach

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
	"time"
)

// NIST CVE API Response structures
type NISTCVEItem struct {
	CVE struct {
		ID           string `json:"id"`
		Descriptions []struct {
			Lang  string `json:"lang"`
			Value string `json:"value"`
		} `json:"descriptions"`
		Published    string `json:"published"`
		LastModified string `json:"lastModified"`
		Metrics      struct {
			CVSSMetricV31 []struct {
				CVSSV3 struct {
					BaseScore    float64 `json:"baseScore"`
					BaseSeverity string  `json:"baseSeverity"`
				} `json:"cvssData"`
			} `json:"cvssMetricV31"`
			CVSSMetricV2 []struct {
				CVSSV2 struct {
					BaseScore float64 `json:"baseScore"`
				} `json:"cvssData"`
				BaseSeverity string `json:"baseSeverity"`
			} `json:"cvssMetricV2"`
		} `json:"metrics"`
	} `json:"cve"`
}

type NISTResponse struct {
	ResultsPerPage int            `json:"resultsPerPage"`
	TotalResults   int            `json:"totalResults"`
	Vulnerabilities []struct {
		CVE NISTCVEItem `json:"cve"`
	} `json:"vulnerabilities"`
}

// getCVEDataForCompany fetches CVE data from NIST for a company
func getCVEDataForCompany(company string) *CompanyCVEData {
	// Try cache first
	cached, err := GetCachedCompanyCVE(company)
	if err == nil && cached != nil {
		return cached
	}

	// Call NIST API
	cveData := callNISTAPIForCompany(company)
	if cveData == nil {
		return nil
	}

	// Cache the result (7 days TTL - CVEs don't change often)
	_ = CacheCompanyCVE(company, cveData, 7*24*time.Hour)

	return cveData
}

// callNISTAPIForCompany calls NIST CVE API to get vulnerabilities for a company
func callNISTAPIForCompany(company string) *CompanyCVEData {
	apiKey := "db4b1c7e-5a24-4d08-9a95-97f177070b43"
	apiURL := "https://services.nvd.nist.gov/rest/json/cves/2.0"

	// Search for company name + common software terms to find relevant CVEs
	searchTerms := fmt.Sprintf("%s vulnerability", company)
	url := fmt.Sprintf("%s?keywordSearch=%s&resultsPerPage=10", apiURL, searchTerms)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		fmt.Printf("Failed to create NIST request for %s: %v\n", company, err)
		return nil
	}

	req.Header.Set("apiKey", apiKey)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("NIST API error for %s: %v\n", company, err)
		return nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		if resp.StatusCode == 403 {
			fmt.Printf("⚠️  NIST API rate limit exceeded - waiting 6 seconds...\n")
			time.Sleep(6 * time.Second)
			return nil
		}
		fmt.Printf("NIST API returned %d for %s: %s\n", resp.StatusCode, company, string(body))
		// Return empty result instead of nil to avoid re-querying
		return &CompanyCVEData{
			TotalCVEs:    0,
			HighestScore: 0,
			HighestLevel: "NONE",
			TopCVEs:      []CVEItemSimple{},
		}
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil
	}

	var nistResp NISTResponse
	if err := json.Unmarshal(body, &nistResp); err != nil {
		fmt.Printf("Failed to parse NIST response for %s: %v\n", company, err)
		return nil
	}

	// No CVEs found
	if len(nistResp.Vulnerabilities) == 0 {
		fmt.Printf("📊 No CVEs found for %s\n", company)
		return &CompanyCVEData{
			TotalCVEs:    0,
			HighestScore: 0,
			HighestLevel: "NONE",
			TopCVEs:      []CVEItemSimple{},
		}
	}

	// Convert to our simplified format and sort by score
	var cves []CVEItemSimple
	for _, vuln := range nistResp.Vulnerabilities {
		// Get description
		desc := "No description available"
		for _, d := range vuln.CVE.CVE.Descriptions {
			if d.Lang == "en" {
				desc = d.Value
				// Truncate long descriptions
				if len(desc) > 200 {
					desc = desc[:200] + "..."
				}
				break
			}
		}

		// Get score and severity (try v3.1 first, then fall back to v2.0)
		score := 0.0
		severity := "UNKNOWN"
		if len(vuln.CVE.CVE.Metrics.CVSSMetricV31) > 0 {
			score = vuln.CVE.CVE.Metrics.CVSSMetricV31[0].CVSSV3.BaseScore
			severity = vuln.CVE.CVE.Metrics.CVSSMetricV31[0].CVSSV3.BaseSeverity
		} else if len(vuln.CVE.CVE.Metrics.CVSSMetricV2) > 0 {
			// Fallback to CVSS v2
			score = vuln.CVE.CVE.Metrics.CVSSMetricV2[0].CVSSV2.BaseScore
			severity = vuln.CVE.CVE.Metrics.CVSSMetricV2[0].BaseSeverity
			// CVSS v2 uses different severity labels, normalize them
			if severity == "" {
				if score >= 7.0 {
					severity = "HIGH"
				} else if score >= 4.0 {
					severity = "MEDIUM"
				} else {
					severity = "LOW"
				}
			}
		}

		cves = append(cves, CVEItemSimple{
			ID:          vuln.CVE.CVE.ID,
			Description: desc,
			Published:   vuln.CVE.CVE.Published,
			Score:       score,
			Severity:    strings.ToUpper(severity),
		})
	}

	// Sort by score descending
	sort.Slice(cves, func(i, j int) bool {
		return cves[i].Score > cves[j].Score
	})

	// Get top 3
	topCVEs := cves
	if len(topCVEs) > 3 {
		topCVEs = cves[:3]
	}

	// Determine highest score and level
	highestScore := 0.0
	highestLevel := "NONE"
	if len(cves) > 0 {
		highestScore = cves[0].Score
		highestLevel = cves[0].Severity
	}

	fmt.Printf("📊 Found %d CVEs for %s (highest: %s %.1f)\n", len(cves), company, highestLevel, highestScore)

	return &CompanyCVEData{
		TotalCVEs:    nistResp.TotalResults,
		HighestScore: highestScore,
		HighestLevel: highestLevel,
		TopCVEs:      topCVEs,
	}
}

// enrichLeaksWithCVEData enriches breach data with CVE information
func enrichLeaksWithCVEData(leakResp *LeakResponse) {
	if len(leakResp.LeakedData) == 0 {
		return
	}

	// NIST API rate limit: 5 requests per 30 seconds without API key
	// Process sequentially with delay to avoid rate limits
	for i := range leakResp.LeakedData {
		company := leakResp.LeakedData[i].Source
		cveData := getCVEDataForCompany(company)
		leakResp.LeakedData[i].CVEData = cveData

		// Wait 6 seconds between requests to stay under NIST rate limit (10 requests/60s with API key)
		if i < len(leakResp.LeakedData)-1 {
			time.Sleep(6 * time.Second)
		}
	}

	fmt.Printf("✅ Enriched %d breaches with CVE data\n", len(leakResp.LeakedData))
}
