#!/bin/bash

# TABEZA Package Publishing Script
# Publishes shared packages to npm registry in correct dependency order

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONFIG_FILE="$SCRIPT_DIR/npm-publishing-config.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    log_error "jq is required but not installed. Please install jq to continue."
    exit 1
fi

# Check if npm is logged in
if ! npm whoami &> /dev/null; then
    log_error "Not logged in to npm. Please run 'npm login' first."
    exit 1
fi

# Read publish order from config
PUBLISH_ORDER=$(jq -r '.publishOrder[]' "$CONFIG_FILE")

log_info "Starting package publishing process..."
log_info "Publish order: $(echo $PUBLISH_ORDER | tr '\n' ' ')"

# Change to root directory
cd "$ROOT_DIR"

# Install dependencies
log_info "Installing dependencies..."
pnpm install --frozen-lockfile

# Build all packages first
log_info "Building all packages..."
pnpm run build:packages

# Function to publish a single package
publish_package() {
    local package_name=$1
    local package_dir="packages/${package_name#@tabeza/}"
    
    log_info "Publishing $package_name..."
    
    if [ ! -d "$package_dir" ]; then
        log_error "Package directory $package_dir not found"
        return 1
    fi
    
    cd "$package_dir"
    
    # Check if package is publishable
    local publishable=$(jq -r ".packages[\"$package_name\"].publishable" "$CONFIG_FILE")
    if [ "$publishable" != "true" ]; then
        log_warning "Package $package_name is not marked as publishable, skipping..."
        cd "$ROOT_DIR"
        return 0
    fi
    
    # Run pre-publish checks
    log_info "Running pre-publish checks for $package_name..."
    
    # Build
    if ! npm run build; then
        log_error "Build failed for $package_name"
        cd "$ROOT_DIR"
        return 1
    fi
    
    # Test
    if ! npm test; then
        log_error "Tests failed for $package_name"
        cd "$ROOT_DIR"
        return 1
    fi
    
    # Lint (if available)
    if npm run lint &> /dev/null; then
        if ! npm run lint; then
            log_error "Linting failed for $package_name"
            cd "$ROOT_DIR"
            return 1
        fi
    fi
    
    # Check if package version already exists
    local current_version=$(jq -r '.version' package.json)
    if npm view "$package_name@$current_version" version &> /dev/null; then
        log_warning "Version $current_version of $package_name already exists on npm, skipping..."
        cd "$ROOT_DIR"
        return 0
    fi
    
    # Publish package
    log_info "Publishing $package_name@$current_version..."
    if npm publish --access public; then
        log_success "Successfully published $package_name@$current_version"
    else
        log_error "Failed to publish $package_name"
        cd "$ROOT_DIR"
        return 1
    fi
    
    cd "$ROOT_DIR"
    return 0
}

# Publish packages in order
failed_packages=()
for package in $PUBLISH_ORDER; do
    if ! publish_package "$package"; then
        failed_packages+=("$package")
    fi
    
    # Wait a bit between publishes to avoid rate limiting
    sleep 2
done

# Report results
if [ ${#failed_packages[@]} -eq 0 ]; then
    log_success "All packages published successfully!"
else
    log_error "Failed to publish the following packages:"
    for package in "${failed_packages[@]}"; do
        log_error "  - $package"
    done
    exit 1
fi

log_info "Package publishing completed successfully!"