# Venue Location & Duplicate Prevention

## Problem Statement

Currently, venues can be accidentally duplicated during onboarding, causing:
- Staff seeing empty dashboards while customers have active tabs
- Confusing auto-generated slugs like `naivas-1770578764136`
- No support for legitimate multi-location chains
- Ambiguous location information (users mixing town/branch in single field)

## User Stories

### 1. Chain Owner Creating Multiple Branches
**As a** chain owner with multiple locations  
**I want to** clearly specify county and branch for each venue  
**So that** each location is uniquely identified and customers/staff don't get confused

**Acceptance Criteria:**
- Can create "Naivas - Westlands - Nairobi County" and "Naivas - CBD - Nairobi County" as separate venues
- Each gets a meaningful slug: `naivas-westlands`, `naivas-cbd`
- Place switcher shows all branches clearly
- No accidental duplicates

### 2. Staff Member Joining Existing Venue
**As a** staff member joining an existing venue  
**I want to** be warned if the venue already exists  
**So that** I don't accidentally create a duplicate

**Acceptance Criteria:**
- System detects when venue name + county + branch already exists
- Shows clear warning: "This venue already exists. Are you joining as staff?"
- Offers option to request access instead of creating duplicate
- Prevents duplicate creation

### 3. Single Location Owner
**As a** single-location venue owner  
**I want to** provide county and specific location  
**So that** customers can find me and my venue is properly identified

**Acceptance Criteria:**
- County field is required (dropdown with all 47 Kenyan counties)
- Branch/location field is required (free text)
- Display name shows: "Venue Name - Location - County"
- Slug is clean and meaningful

### 4. Customer Finding Venue
**As a** customer  
**I want to** see clear venue identification with location  
**So that** I know I'm at the right place

**Acceptance Criteria:**
- Tab card shows: "Naivas - Westlands - Nairobi County"
- QR code URL is clean: `tabeza.co.ke/naivas-westlands`
- No confusion between branches

## Data Structure

### Database Schema Changes

```sql
-- Add new fields to bars table
ALTER TABLE bars 
  ADD COLUMN county TEXT,              -- "Nairobi", "Mombasa", "Kiambu"
  ADD COLUMN branch_location TEXT;     -- "Westlands", "CBD", "Junction Mall"

-- Keep existing 'location' field for full address (optional)
-- location: "Westlands Mall, Ring Road, Nairobi" (full address)

-- Add index for duplicate detection
CREATE INDEX idx_bars_name_county_branch 
  ON bars(name, county, branch_location);
```

### Field Definitions

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `name` | TEXT | Yes | Venue name | "Naivas" |
| `county` | TEXT | Yes | Kenyan county | "Nairobi" |
| `branch_location` | TEXT | Yes | Specific location/branch | "Westlands" |
| `location` | TEXT | No | Full address (existing field) | "Westlands Mall, Ring Road" |
| `slug` | TEXT | Yes | URL-friendly identifier | "naivas-westlands" |

## Business Rules

### 1. Duplicate Detection
- **Exact Match**: Same name + county + branch = Duplicate (prevent creation)
- **Same Name in County**: Same name + county, different branch = Warning (allow with confirmation)
- **Same Name, Different County**: Same name, different county = Allow (legitimate chain)

### 2. Slug Generation
```
Priority:
1. name-branch (if unique)
2. name-branch-county (if name-branch exists elsewhere)

Examples:
- "naivas-westlands" (unique)
- "naivas-cbd" (unique)
- "naivas-westlands-mombasa" (if "naivas-westlands" exists in Nairobi)
```

### 3. Display Names
```
Format: "Name - Branch - County"

Examples:
- "Naivas - Westlands - Nairobi"
- "Java House - Junction - Nairobi"
- "Popos - CBD - Mombasa"
```

### 4. County List
Use official 47 Kenyan counties:
- Nairobi
- Mombasa
- Kiambu
- Nakuru
- Kisumu
- (etc. - full list in implementation)

## UI/UX Requirements

### Onboarding Flow

**Step 1: Venue Information**
```
┌─────────────────────────────────────────┐
│ Venue Information                       │
├─────────────────────────────────────────┤
│                                         │
│ Venue Name *                            │
│ [Naivas                              ]  │
│ The name of your business               │
│                                         │
│ County *                                │
│ [Select county ▼                     ]  │
│ Which county is your venue in?          │
│                                         │
│ Branch/Location *                       │
│ [Westlands Mall                      ]  │
│ Specific location, branch, or landmark  │
│ Examples: "CBD", "Junction", "Kimathi"  │
│                                         │
└─────────────────────────────────────────┘
```

**Duplicate Warning (if detected):**
```
┌─────────────────────────────────────────┐
│ ⚠️ Venue Already Exists                 │
├─────────────────────────────────────────┤
│                                         │
│ "Naivas - Westlands - Nairobi"         │
│ already exists in Tabeza                │
│                                         │
│ Are you:                                │
│                                         │
│ ○ Opening a different branch            │
│   → Change the branch/location name     │
│                                         │
│ ○ Joining this venue as staff           │
│   → Contact venue owner for access      │
│                                         │
│ [Change Location] [Contact Owner]       │
│                                         │
└─────────────────────────────────────────┘
```

### Place Switcher Enhancement
```
My Venues
├─ Naivas - Westlands - Nairobi (12 tabs)
├─ Naivas - CBD - Nairobi (8 tabs)
└─ Naivas - Junction - Kiambu (5 tabs)
```

### Tab Card Display
```
┌─────────────────────────────────┐
│ Tab #2                          │
│ Naivas - Westlands - Nairobi    │
│                                 │
│ Balance: KES 450.00             │
└─────────────────────────────────┘
```

## Migration Strategy

### Phase 1: Add Fields (Non-Breaking)
1. Add `county` and `branch_location` columns (nullable)
2. Existing venues continue working with old `location` field
3. New venues must provide county + branch

### Phase 2: Backfill Existing Data
1. Parse existing `location` field to extract county/branch
2. Manual review for ambiguous cases
3. Update slugs for clarity (optional, with redirects)

### Phase 3: Enforce Requirements
1. Make `county` and `branch_location` required for new venues
2. Prompt existing venues to update on next login
3. Full duplicate prevention active

## Success Metrics

1. **Zero accidental duplicates** - No more phantom tab issues
2. **Clear venue identification** - 100% of venues have county + branch
3. **Meaningful slugs** - No more timestamp-based slugs
4. **Chain support** - Multi-location owners can manage all branches
5. **User satisfaction** - Staff can find their tabs, customers see correct venue

## Out of Scope

- International expansion (non-Kenya counties)
- Automatic geocoding/GPS location
- Multi-language support
- Venue merging/migration tools (manual process for now)

## Dependencies

- Onboarding flow refactor
- Database migration
- Slug generation logic update
- Place switcher UI update
