#!/bin/bash

# Test Runner for ALL Password Manager Importers
# This script runs comprehensive tests on all 45+ importers

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$SCRIPT_DIR/../../clients/desktop"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  Password Sync - Comprehensive Importer Test Suite            ║"
echo "║  Testing 45+ importers with real sample files                 ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if we're in the correct directory
if [ ! -f "$DESKTOP_DIR/package.json" ]; then
    echo -e "${RED}Error: Could not find desktop client package.json${NC}"
    echo "Expected at: $DESKTOP_DIR/package.json"
    exit 1
fi

# Count sample files
echo -e "${BLUE}Checking sample files...${NC}"
CSV_COUNT=$(ls -1 "$SCRIPT_DIR"/*.csv 2>/dev/null | wc -l | tr -d ' ')
JSON_COUNT=$(ls -1 "$SCRIPT_DIR"/*.json 2>/dev/null | wc -l | tr -d ' ')
XML_COUNT=$(ls -1 "$SCRIPT_DIR"/*.xml 2>/dev/null | wc -l | tr -d ' ')
TOTAL_SAMPLES=$((CSV_COUNT + JSON_COUNT + XML_COUNT))

echo -e "  CSV samples:  ${GREEN}$CSV_COUNT${NC}"
echo -e "  JSON samples: ${GREEN}$JSON_COUNT${NC}"
echo -e "  XML samples:  ${GREEN}$XML_COUNT${NC}"
echo -e "  ${YELLOW}Total: $TOTAL_SAMPLES sample files${NC}"
echo ""

# List all sample files
echo -e "${BLUE}Sample files available:${NC}"
ls -1 "$SCRIPT_DIR"/*.{csv,json,xml} 2>/dev/null | while read file; do
    filename=$(basename "$file")
    size=$(du -h "$file" | cut -f1)
    echo -e "  ✓ $filename ${YELLOW}($size)${NC}"
done
echo ""

# Navigate to desktop directory
cd "$DESKTOP_DIR"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}node_modules not found. Running npm install...${NC}"
    npm install
fi

echo -e "${BLUE}Running test suite...${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Run the comprehensive test suite
if npm test -- --include='**/all-importers.spec.ts' 2>&1 | tee /tmp/importer-test-output.log; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${GREEN}✓ ALL TESTS PASSED!${NC}"
    echo ""

    # Parse test results
    if [ -f /tmp/importer-test-output.log ]; then
        TOTAL_TESTS=$(grep -o '[0-9]* tests' /tmp/importer-test-output.log | tail -1 | grep -o '[0-9]*' || echo "?")
        echo -e "${BLUE}Test Summary:${NC}"
        echo -e "  Total test cases: ${GREEN}$TOTAL_TESTS${NC}"
        echo -e "  Sample files tested: ${GREEN}$TOTAL_SAMPLES${NC}"
        echo ""
    fi

    echo -e "${GREEN}All importers are working correctly!${NC}"
    exit 0
else
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${RED}✗ TESTS FAILED${NC}"
    echo ""
    echo "Check the output above for details."
    echo "Log saved to: /tmp/importer-test-output.log"
    exit 1
fi
