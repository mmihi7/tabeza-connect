#!/bin/bash
# TabezaConnect Artifact Validation Script (Bash)
#
# This script validates the built installer package before release to ensure:
# - ZIP file exists and is properly named
# - File size is within expected bounds (20-50 MB)
# - ZIP integrity is intact
# - All required files are present
# - Version numbers match between tag and filename
#
# Requirements: 7.1, 7.2, 7.3, 7.4, 4.2
#
# Usage: ./validate-artifact.sh <version> [dist-path]
# Example: ./validate-artifact.sh 1.0.0 dist

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Validation configuration
MIN_SIZE_MB=20
MAX_SIZE_MB=50
MIN_SIZE_BYTES=$((MIN_SIZE_MB * 1024 * 1024))
MAX_SIZE_BYTES=$((MAX_SIZE_MB * 1024 * 1024))

REQUIRED_FILES=(
    "install.bat"
    "README.txt"
    "nodejs/"
)

# Track validation results
VALIDATION_ERRORS=()
VALIDATION_WARNINGS=()

# Parse arguments
VERSION="$1"
DIST_PATH="${2:-dist}"

if [ -z "$VERSION" ]; then
    echo -e "${RED}ERROR: Version argument is required${NC}"
    echo "Usage: $0 <version> [dist-path]"
    echo "Example: $0 1.0.0 dist"
    exit 1
fi

write_validation_header() {
    echo ""
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}TabezaConnect Artifact Validation${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}Version: $VERSION${NC}"
    echo ""
}

write_validation_step() {
    echo -e "${BLUE}🔍 $1${NC}"
}

write_validation_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

write_validation_error() {
    echo -e "${RED}❌ ERROR: $1${NC}"
    VALIDATION_ERRORS+=("$1")
}

write_validation_warning() {
    echo -e "${YELLOW}⚠️  WARNING: $1${NC}"
    VALIDATION_WARNINGS+=("$1")
}

test_zip_file_exists() {
    write_validation_step "Checking if ZIP file exists..."
    
    local expected_filename="TabezaConnect-Setup-v${VERSION}.zip"
    local zip_path="${DIST_PATH}/${expected_filename}"
    
    if [ ! -f "$zip_path" ]; then
        write_validation_error "ZIP file not found at: $zip_path"
        
        # List contents of dist directory for debugging
        if [ -d "$DIST_PATH" ]; then
            echo ""
            echo -e "${YELLOW}Contents of $DIST_PATH directory:${NC}"
            ls -la "$DIST_PATH" | while read -r line; do
                echo -e "${YELLOW}  $line${NC}"
            done
        else
            write_validation_error "Distribution directory does not exist: $DIST_PATH"
        fi
        
        echo ""
        return 1
    fi
    
    write_validation_success "ZIP file found: $expected_filename"
    echo "$zip_path"
    return 0
}

test_zip_filename() {
    local zip_path="$1"
    
    write_validation_step "Validating ZIP filename pattern..."
    
    local filename=$(basename "$zip_path")
    local expected_pattern="^TabezaConnect-Setup-v[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*)?\.zip$"
    
    if ! echo "$filename" | grep -qE "$expected_pattern"; then
        write_validation_error "ZIP filename does not match expected pattern: $filename"
        echo -e "${YELLOW}  Expected pattern: TabezaConnect-Setup-v{version}.zip${NC}"
        return 1
    fi
    
    # Extract version from filename
    if [[ $filename =~ TabezaConnect-Setup-v(.+)\.zip ]]; then
        local filename_version="${BASH_REMATCH[1]}"
        
        if [ "$filename_version" != "$VERSION" ]; then
            write_validation_error "Version mismatch between tag and filename"
            echo -e "${YELLOW}  Tag version: $VERSION${NC}"
            echo -e "${YELLOW}  Filename version: $filename_version${NC}"
            return 1
        fi
        
        write_validation_success "Filename matches expected pattern and version"
        return 0
    fi
    
    write_validation_error "Could not extract version from filename: $filename"
    return 1
}

test_zip_file_size() {
    local zip_path="$1"
    
    write_validation_step "Checking file size bounds..."
    
    # Get file size (cross-platform compatible)
    local file_size_bytes
    if [[ "$OSTYPE" == "darwin"* ]]; then
        file_size_bytes=$(stat -f%z "$zip_path")
    else
        file_size_bytes=$(stat -c%s "$zip_path")
    fi
    
    local file_size_mb=$(echo "scale=2; $file_size_bytes / 1048576" | bc)
    
    echo -e "${CYAN}  File size: ${file_size_mb} MB ($file_size_bytes bytes)${NC}"
    
    if [ "$file_size_bytes" -lt "$MIN_SIZE_BYTES" ]; then
        write_validation_error "File size too small: ${file_size_mb} MB (minimum: $MIN_SIZE_MB MB)"
        echo -e "${YELLOW}  This may indicate missing components or incomplete build${NC}"
        return 1
    fi
    
    if [ "$file_size_bytes" -gt "$MAX_SIZE_BYTES" ]; then
        write_validation_error "File size too large: ${file_size_mb} MB (maximum: $MAX_SIZE_MB MB)"
        echo -e "${YELLOW}  This may indicate unnecessary files or bloat${NC}"
        return 1
    fi
    
    write_validation_success "File size within bounds: ${file_size_mb} MB ($MIN_SIZE_MB-$MAX_SIZE_MB MB)"
    return 0
}

test_zip_integrity() {
    local zip_path="$1"
    
    write_validation_step "Testing ZIP integrity..."
    
    # Test ZIP integrity using unzip -t
    if unzip -t "$zip_path" > /dev/null 2>&1; then
        write_validation_success "ZIP file integrity verified (extraction test successful)"
        return 0
    else
        write_validation_error "ZIP file is corrupted or invalid"
        echo -e "${YELLOW}  Run 'unzip -t $zip_path' for detailed error information${NC}"
        return 1
    fi
}

test_required_files() {
    local zip_path="$1"
    
    write_validation_step "Verifying presence of required files..."
    
    # Create temporary directory for extraction
    local temp_dir=$(mktemp -d -t tabeza-validation-XXXXXX)
    
    # Extract ZIP
    if ! unzip -q "$zip_path" -d "$temp_dir" 2>/dev/null; then
        write_validation_error "Failed to extract ZIP for file verification"
        rm -rf "$temp_dir"
        return 1
    fi
    
    local all_files_present=true
    
    for required_file in "${REQUIRED_FILES[@]}"; do
        local file_path="${temp_dir}/${required_file}"
        
        # Check if it's a directory (ends with /)
        if [[ "$required_file" == */ ]]; then
            local dir_path="${file_path%/}"
            if [ -d "$dir_path" ]; then
                echo -e "${GREEN}  ✓ $required_file${NC}"
            else
                write_validation_error "Missing required directory: $required_file"
                all_files_present=false
            fi
        else
            if [ -f "$file_path" ]; then
                echo -e "${GREEN}  ✓ $required_file${NC}"
            else
                write_validation_error "Missing required file: $required_file"
                all_files_present=false
            fi
        fi
    done
    
    # Clean up temporary directory
    rm -rf "$temp_dir"
    
    if [ "$all_files_present" = true ]; then
        write_validation_success "All required files present"
        return 0
    else
        return 1
    fi
}

write_validation_summary() {
    echo ""
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}Validation Summary${NC}"
    echo -e "${CYAN}========================================${NC}"
    
    if [ ${#VALIDATION_WARNINGS[@]} -gt 0 ]; then
        echo ""
        echo -e "${YELLOW}Warnings (${#VALIDATION_WARNINGS[@]}):${NC}"
        for warning in "${VALIDATION_WARNINGS[@]}"; do
            echo -e "${YELLOW}  ⚠️  $warning${NC}"
        done
    fi
    
    if [ ${#VALIDATION_ERRORS[@]} -gt 0 ]; then
        echo ""
        echo -e "${RED}Errors (${#VALIDATION_ERRORS[@]}):${NC}"
        for error in "${VALIDATION_ERRORS[@]}"; do
            echo -e "${RED}  ❌ $error${NC}"
        done
        echo ""
        echo -e "${RED}❌ VALIDATION FAILED${NC}"
        echo ""
        return 1
    fi
    
    echo ""
    echo -e "${GREEN}✅ VALIDATION PASSED${NC}"
    echo ""
    return 0
}

# Main validation flow
write_validation_header

# Step 1: Check if ZIP file exists
zip_path=$(test_zip_file_exists)
if [ $? -ne 0 ]; then
    write_validation_summary
    exit 1
fi

# Step 2: Validate filename pattern and version
if ! test_zip_filename "$zip_path"; then
    write_validation_summary
    exit 1
fi

# Step 3: Check file size bounds
test_zip_file_size "$zip_path" || true

# Step 4: Test ZIP integrity
test_zip_integrity "$zip_path" || true

# Step 5: Verify required files
test_required_files "$zip_path" || true

# Final summary
if write_validation_summary; then
    exit 0
else
    exit 1
fi
