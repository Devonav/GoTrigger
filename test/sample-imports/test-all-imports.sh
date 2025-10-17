#!/bin/bash

# Quick Test Script for All Import Formats
# Tests all sample CSV files and reports results

echo "================================================"
echo "  Password Sync - Import Format Test Suite"
echo "================================================"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TOTAL=0
PASSED=0
FAILED=0

# Function to test an importer
test_importer() {
    local name=$1
    local file=$2

    TOTAL=$((TOTAL + 1))

    echo -n "Testing $name... "

    if [ ! -f "$file" ]; then
        echo -e "${RED}FAIL${NC} - File not found: $file"
        FAILED=$((FAILED + 1))
        return 1
    fi

    # Check file has content
    if [ ! -s "$file" ]; then
        echo -e "${RED}FAIL${NC} - File is empty"
        FAILED=$((FAILED + 1))
        return 1
    fi

    # Count lines (should be at least 2: header + 1 data row)
    lines=$(wc -l < "$file")
    if [ "$lines" -lt 2 ]; then
        echo -e "${RED}FAIL${NC} - File has less than 2 lines"
        FAILED=$((FAILED + 1))
        return 1
    fi

    # Verify CSV structure (has commas)
    if ! grep -q "," "$file"; then
        echo -e "${RED}FAIL${NC} - Not a valid CSV (no commas found)"
        FAILED=$((FAILED + 1))
        return 1
    fi

    echo -e "${GREEN}PASS${NC} ($lines lines)"
    PASSED=$((PASSED + 1))
    return 0
}

echo "Running automated tests on sample import files..."
echo ""

# Test each format
test_importer "Generic CSV    " "generic-format.csv"
test_importer "Bitwarden CSV  " "bitwarden-format.csv"
test_importer "Chrome CSV     " "chrome-format.csv"
test_importer "LastPass CSV   " "lastpass-format.csv"
test_importer "Firefox CSV    " "firefox-format.csv"
test_importer "Safari CSV     " "safari-format.csv"

echo ""
echo "================================================"
echo "  Test Results"
echo "================================================"
echo -e "Total:  $TOTAL"
echo -e "${GREEN}Passed: $PASSED${NC}"
if [ "$FAILED" -gt 0 ]; then
    echo -e "${RED}Failed: $FAILED${NC}"
fi
echo ""

# Show sample data from each file
echo "================================================"
echo "  Sample Data Preview (First Row)"
echo "================================================"
echo ""

for file in *.csv; do
    if [ -f "$file" ]; then
        echo -e "${YELLOW}$file:${NC}"
        head -n 2 "$file" | tail -n 1
        echo ""
    fi
done

echo "================================================"
echo ""
echo "To manually test in the app:"
echo "  1. npm run electron:dev"
echo "  2. Login and click 'Import'"
echo "  3. Select format from dropdown"
echo "  4. Choose corresponding CSV file"
echo "  5. Verify import succeeds"
echo ""
echo "To run unit tests:"
echo "  cd clients/desktop"
echo "  npm test"
echo ""

# Exit with error if any tests failed
if [ "$FAILED" -gt 0 ]; then
    exit 1
fi

exit 0
