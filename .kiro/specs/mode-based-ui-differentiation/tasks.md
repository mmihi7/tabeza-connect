# Implementation Tasks: Mode-Based UI Differentiation (MVP)

**Total Timeline**: 1-2 days development + 1 week testing
**Development Effort**: 12-16 hours of focused coding
**Focus**: Menu access differentiation only - all existing features (M-Pesa, printer service) remain unchanged

**Note**: Database schema (venue_mode, authority_mode columns) already exists. M-Pesa payment and printer service are working and will NOT be modified.

---

## Day 1: Backend Infrastructure & Context (6-8 hours)

## Task 1: Database Setup & Mode Assignment Script
**Status**: Not Started
**Dependencies**: None
**Estimated Effort**: 1.5 hours
**Priority**: HIGH

Verify database schema and create script to manually assign venue modes for testing.

### Subtasks:
- [x] 1.1 Verify database schema (30 min)
  - Confirm `venue_mode` and `authority_mode` columns exist in bars table
  - Confirm CHECK constraints are in place
  - Test querying: `SELECT id, name, venue_mode, authority_mode FROM bars LIMIT 5`
- [x] 1.2 Identify 6 test venues (15 min)
  - Query database for suitable test venues
  - Document venue IDs and names
  - Plan: 3 venues → Basic mode, 3 venues → Venue mode
- [x] 1.3 Create mode assignment script (45 min)
  - Create `dev-tools/scripts/set-venue-mode.js`
  - Accept command line args: `--venue=<id> --mode=basic|venue --authority=pos|tabeza`
  - Validate mode/authority combinations
  - Update bars table
  - Display success/error messages
  - Add npm script: `"set-mode": "node dev-tools/scripts/set-venue-mode.js"`

**Acceptance Criteria**:
- Database schema verified and documented
- 6 test venues identified
- Script successfully updates venue modes
- Script validates invalid combinations
- Can run: `npm run set-mode -- --venue=abc123 --mode=basic --authority=pos`

---

## Task 2: Mode Configuration Service
**Status**: Not Started
**Dependencies**: Task 1
**Estimated Effort**: 1.5 hours
**Priority**: HIGH

Create simple service to fetch venue mode configuration from database.

### Subtasks:
- [x] 2.1 Create service file (30 min)
  - Create `packages/shared/services/modeConfigService.ts`
  - Define ModeConfiguration interface
  - Export TypeScript types
- [x] 2.2 Implement fetchModeConfig function (45 min)
  - Query Supabase for venue_mode and authority_mode
  - Return config object with flags (isBasic, isVenue, isPOSAuthority, isTabezaAuthority)
  - Add basic try/catch error handling
  - Return safe default (venue + tabeza) on error
- [ ] 2.3 Test service manually (15 min)
  - Test with Basic mode venue ID
  - Test with Venue mode venue ID
  - Test with invalid venue ID
  - Verify correct flags returned

**Implementation**:
```typescript
export interface ModeConfiguration {
  venue_mode: 'basic' | 'venue';
  authority_mode: 'pos' | 'tabeza';
  isBasic: boolean;
  isVenue: boolean;
  isPOSAuthority: boolean;
  isTabezaAuthority: boolean;
}

export async function fetchModeConfig(barId: string): Promise<ModeConfiguration> {
  try {
    const { data, error } = await supabase
      .from('bars')
      .select('venue_mode, authority_mode')
      .eq('id', barId)
      .single();
    
    if (error) throw error;
    
    return {
      venue_mode: data.venue_mode,
      authority_mode: data.authority_mode,
      isBasic: data.venue_mode === 'basic',
      isVenue: data.venue_mode === 'venue',
      isPOSAuthority: data.authority_mode === 'pos',
      isTabezaAuthority: data.authority_mode === 'tabeza',
    };
  } catch (error) {
    console.error('Failed to fetch mode config:', error);
    // Fail safe: default to venue + tabeza
    return {
      venue_mode: 'venue',
      authority_mode: 'tabeza',
      isBasic: false,
      isVenue: true,
      isPOSAuthority: false,
      isTabezaAuthority: true,
    };
  }
}
```

**Acceptance Criteria**:
- Service fetches mode from database
- Returns correct flags for all mode combinations
- Handles errors gracefully without crashing
- TypeScript types properly exported

---

## Task 3: Add Mode to Analytics Events
**Status**: Not Started
**Dependencies**: Task 2
**Estimated Effort**: 1 hour
**Priority**: MEDIUM

Add mode tracking to existing analytics events for test data collection.

### Subtasks:
- [ ] 3.1 Identify analytics event locations (15 min)
  - Find where `tab_created` event is tracked
  - Find where `payment_completed` event is tracked
  - Find where `order_placed` event is tracked
  - Document file paths
- [ ] 3.2 Add mode to event payloads (30 min)
  - Add `venue_mode` and `authority_mode` to each event
  - Ensure mode values are available in context
  - Test events fire with mode data
- [ ] 3.3 Create analytics queries (15 min)
  - Create `dev-tools/sql/analytics-by-mode.sql`
  - Query tabs by mode
  - Query payments by mode
  - Query orders by mode

**Acceptance Criteria**:
- Mode tracked in all key events
- Can segment analytics data by mode
- Queries return correct data

---

## Task 4: Mode Context Provider
**Status**: Not Started
**Dependencies**: Task 2
**Estimated Effort**: 2 hours
**Priority**: HIGH

Create React Context to share mode configuration across both apps.

### Subtasks:
- [ ] 4.1 Create ModeContext file (45 min)
  - Create `packages/shared/contexts/ModeContext.tsx`
  - Define ModeContextValue interface
  - Create React Context with createContext
  - Implement ModeProvider component
  - Fetch mode config on mount using useEffect
  - Store in useState (config, isLoading, error)
- [ ] 4.2 Create useModeConfig hook (15 min)
  - Implement useContext wrapper
  - Throw error if used outside provider
  - Return mode configuration from context
- [ ] 4.3 Wrap customer app (30 min)
  - Edit `apps/customer/app/layout.tsx`
  - Wrap children with ModeProvider
  - Pass barId from route params or session
  - Test context loads correctly
- [ ] 4.4 Wrap staff app (30 min)
  - Edit `apps/staff/app/layout.tsx`
  - Wrap children with ModeProvider
  - Pass barId from route params or session
  - Test context loads correctly

**Acceptance Criteria**:
- ModeProvider wraps both apps
- useModeConfig returns correct configuration
- Loading state prevents premature renders
- Error state handles failures gracefully
- No console errors

---

## Task 5: Feature Guard Hook
**Status**: Not Started
**Dependencies**: Task 4
**Estimated Effort**: 1 hour
**Priority**: HIGH

Create hook that returns boolean flags for feature availability.

### Subtasks:
- [ ] 5.1 Create feature guard hook file (45 min)
  - Create `packages/shared/hooks/useFeatureGuard.ts`
  - Import useModeConfig hook
  - Define return type interface
  - Implement feature flag logic:
    - Basic + POS: Only printer config, no menus, no ordering
    - Venue + POS: Menus (view), requests, messaging, printer config
    - Venue + Tabeza: Full features (menus, ordering, promotions, no printer)
  - Add mode indicator flags
- [ ] 5.2 Test hook (15 min)
  - Create test component using useFeatureGuard
  - Log feature flags to console
  - Verify correct flags for each mode combination

**Implementation**:
```typescript
export function useFeatureGuard() {
  const { isBasic, isVenue, isPOSAuthority, isTabezaAuthority, venue_mode, authority_mode } = useModeConfig();
  
  return {
    // Customer features
    canViewMenu: isVenue,
    canPlaceOrders: isVenue && isTabezaAuthority,
    canSubmitRequests: isVenue && isPOSAuthority,
    canViewPromotions: isVenue && isTabezaAuthority,
    
    // Staff features
    canManageMenus: isVenue,
    canCreateOrders: isVenue && isTabezaAuthority,
    canViewRequests: isVenue && isPOSAuthority,
    canManagePromotions: isVenue && isTabezaAuthority,
    canConfigurePrinter: isPOSAuthority, // Basic or Venue+POS
    
    // Universal features (always available)
    canViewTab: true,
    canMakePayments: true, // M-Pesa works in all modes
    canMessage: isVenue,
    
    // Mode indicators
    isBasic,
    isVenue,
    isPOSAuthority,
    isTabezaAuthority,
    venue_mode,
    authority_mode,
  };
}
```

**Acceptance Criteria**:
- Hook returns consistent object with all flags
- Basic + POS correctly restricts features
- Venue + POS enables requests but not orders
- Venue + Tabeza enables all features
- Payment features always available

---

## Day 2: UI Adaptation & Testing (6-8 hours)

## Task 6: Simple Unavailable Feature Message Component
**Status**: Not Started
**Dependencies**: None
**Estimated Effort**: 30 minutes
**Priority**: LOW

Create dead-simple component for unavailable feature messages.

### Subtasks:
- [ ] 6.1 Create component file
  - Create `packages/shared/components/UnavailableFeatureMessage.tsx`
  - Accept feature name as prop
  - Display simple message with "View My Tab" button
  - Add basic styling

**Implementation**:
```typescript
export function UnavailableFeatureMessage({ feature }: { feature: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center">
      <h2 className="text-2xl font-bold mb-4">{feature} Not Available</h2>
      <p className="text-gray-600 mb-6 max-w-md">
        This feature is not available in your current plan. Please order with a staff member.
      </p>
      <Link href="/tab">
        <Button>View My Tab</Button>
      </Link>
    </div>
  );
}
```

**Acceptance Criteria**:
- Component displays feature name
- Simple, clean styling
- Reusable across apps

---

## Task 7: Customer Menu Page Adaptation
**Status**: Not Started
**Dependencies**: Task 4, Task 5, Task 6
**Estimated Effort**: 1 hour
**Priority**: HIGHEST

Hide menu page in Basic mode and show unavailable message. This is THE core differentiator.

### Subtasks:
- [ ] 7.1 Update menu page (45 min)
  - Edit `apps/customer/app/menu/page.tsx`
  - Import useModeConfig hook
  - Check if isBasic === true
  - Return UnavailableFeatureMessage in Basic mode
  - Return existing MenuContent in Venue mode
  - Add loading state
- [ ] 7.2 Test menu page (15 min)
  - Open customer app for Basic mode venue
  - Verify unavailable message shown
  - Open customer app for Venue mode venue
  - Verify full menu shown

**Acceptance Criteria**:
- Basic mode shows unavailable message (no menu)
- Venue mode shows full menu (existing behavior)
- Loading state prevents content flash
- "View My Tab" button works

---

## Task 8: Customer Navigation Adaptation
**Status**: Not Started
**Dependencies**: Task 5
**Estimated Effort**: 30 minutes
**Priority**: HIGH

Filter navigation items to hide menu link in Basic mode.

### Subtasks:
- [ ] 8.1 Update customer navigation (20 min)
  - Edit `apps/customer/components/Navigation.tsx`
  - Import useFeatureGuard hook
  - Add show property to navigation items
  - Filter items where show === true
  - Configure: Menu (canViewMenu), Tab (always), Payment (always)
- [ ] 8.2 Test navigation (10 min)
  - Test Basic mode: only Tab and Payment visible
  - Test Venue mode: Menu, Tab, Payment visible

**Acceptance Criteria**:
- Basic mode hides "Menu" from navigation
- Venue mode shows all navigation items
- Active route highlighting works

---

## Task 9: Menu Route Protection
**Status**: Not Started
**Dependencies**: Task 4
**Estimated Effort**: 30 minutes
**Priority**: MEDIUM

Prevent direct URL access to /menu in Basic mode via redirect.

### Subtasks:
- [ ] 9.1 Create menu layout with protection (20 min)
  - Create or edit `apps/customer/app/menu/layout.tsx`
  - Import useModeConfig hook
  - Check if isBasic === true
  - Redirect to /tab if Basic mode
  - Render children if Venue mode
- [ ] 9.2 Test direct URL access (10 min)
  - Try navigating to /menu in Basic mode
  - Verify redirects to /tab
  - Verify Venue mode /menu loads normally

**Acceptance Criteria**:
- Cannot access /menu via direct URL in Basic mode
- Redirects to /tab gracefully
- Venue mode /menu access unaffected

---

## Task 10: Staff Navigation Adaptation
**Status**: Not Started
**Dependencies**: Task 5
**Estimated Effort**: 1 hour
**Priority**: HIGH

Filter staff navigation to hide menu and order management in Basic mode.

### Subtasks:
- [ ] 10.1 Update staff navigation (45 min)
  - Edit `apps/staff/components/Navigation.tsx`
  - Import useFeatureGuard hook
  - Add show property to navigation items
  - Filter items where show === true
  - Configure items:
    - Dashboard: always
    - Tabs: always
    - Orders: canCreateOrders
    - Menu: canManageMenus
    - Payments: always
    - Settings: always (but printer config inside adapts)
- [ ] 10.2 Test staff navigation (15 min)
  - Test Basic mode: Dashboard, Tabs, Payments, Settings
  - Test Venue+POS: Add Menu (view), Requests, Messages
  - Test Venue+Tabeza: All items including Orders, Promotions

**Acceptance Criteria**:
- Basic mode hides Orders and Menu from staff nav
- Venue modes show appropriate items
- Navigation order makes sense
- Active route highlighting works

---

## Task 11: Tab Page Verification
**Status**: Not Started
**Dependencies**: None (verification only)
**Estimated Effort**: 30 minutes
**Priority**: LOW

Verify tab page works identically in all modes without code changes.

### Subtasks:
- [ ] 11.1 Test Basic mode tab page (10 min)
  - Open customer tab page in Basic mode venue
  - Verify tab items display correctly
  - Verify M-Pesa payment button present
  - Complete test payment
  - Verify receipt generates
- [ ] 11.2 Test Venue mode tab page (10 min)
  - Open customer tab page in Venue mode venue
  - Verify tab items display correctly
  - Complete test payment
  - Verify receipt generates
- [ ] 11.3 Confirm no changes needed (10 min)
  - Document that tab page is mode-agnostic
  - Confirm M-Pesa payment works in all modes
  - No code changes required

**Acceptance Criteria**:
- Tab page renders identically in all modes
- M-Pesa payment works in all modes
- Receipt displays correctly in all modes
- No mode-specific bugs

---

## Task 12: End-to-End Manual Testing
**Status**: Not Started
**Dependencies**: Tasks 1-11
**Estimated Effort**: 3 hours
**Priority**: HIGHEST

Execute comprehensive manual test scenarios for all mode combinations.

### Subtasks:
- [ ] 12.1 Prepare test environment (30 min)
  - Set 2 test venues: 1 Basic+POS, 1 Venue+Tabeza
  - Clear browser cache
  - Prepare test data
- [ ] 12.2 Test Basic + POS mode (45 min)
  - **Customer**: Cannot see Menu, cannot access /menu, CAN view tab, CAN pay via M-Pesa
  - **Staff**: Cannot see Orders/Menu, CAN create tabs, CAN process payments
- [ ] 12.3 Test Venue + POS mode (45 min)
  - **Customer**: CAN see Menu, CAN submit requests (not orders), CAN message, CAN pay
  - **Staff**: CAN view menu, CAN manage requests, CANNOT create orders in Tabeza
- [ ] 12.4 Test Venue + Tabeza mode (45 min)
  - **Customer**: CAN see Menu, CAN place orders, CAN view promotions, CAN pay
  - **Staff**: CAN manage full menu, CAN create orders, CAN manage promotions
- [ ] 12.5 Test mode switching (15 min)
  - Change venue from Basic to Venue via script
  - Verify menu appears after refresh
  - Verify existing tabs still work
  - Verify M-Pesa still works

**Test Checklist**:
```
## Basic + POS Mode
Customer:
- [ ] "Menu" NOT in navigation
- [ ] /menu redirects to /tab
- [ ] Can view tab
- [ ] Can pay via M-Pesa
- [ ] Receipt displays

Staff:
- [ ] "Orders" and "Menu" NOT in navigation
- [ ] Can create tabs
- [ ] Can process payments

## Venue + POS Mode
Customer:
- [ ] "Menu" IS in navigation
- [ ] Can browse menu
- [ ] Sees "Request" buttons (not "Order")
- [ ] Can submit requests
- [ ] Can pay via M-Pesa

Staff:
- [ ] Can view menu
- [ ] Can manage requests
- [ ] Cannot create orders in Tabeza

## Venue + Tabeza Mode
Customer:
- [ ] "Menu" IS in navigation
- [ ] Can browse menu
- [ ] Sees "Order" buttons
- [ ] Can place orders
- [ ] Can view promotions
- [ ] Can pay via M-Pesa

Staff:
- [ ] All nav items visible
- [ ] Can manage full menu
- [ ] Can create orders
- [ ] Can manage promotions

## Mode Switching
- [ ] Basic → Venue: Menu appears
- [ ] Venue → Basic: Menu disappears
- [ ] Existing tabs preserved
- [ ] M-Pesa still works
```

**Acceptance Criteria**:
- All test scenarios pass
- No blocking bugs
- Mode switching works correctly
- M-Pesa reliable across all modes
- Test results documented

---

## Task 13: Bug Fixes & Polish
**Status**: Not Started
**Dependencies**: Task 12
**Estimated Effort**: 1-2 hours (budget)
**Priority**: HIGH

Fix any critical bugs discovered during testing.

### Subtasks:
- [ ] 13.1 Review test results
  - Identify critical vs nice-to-have fixes
  - Prioritize blocking issues
- [ ] 13.2 Fix critical bugs
  - Address navigation issues
  - Fix redirect problems
  - Resolve mode detection errors
- [ ] 13.3 Retest after fixes
  - Run affected test scenarios again
  - Verify no regressions
- [ ] 13.4 Document known issues
  - Note minor bugs deferred to later
  - Create tickets for post-MVP improvements

**Acceptance Criteria**:
- All critical bugs fixed
- Core flows work reliably
- No regressions
- Minor issues documented

---

## Task 14: Create Testing Documentation
**Status**: Not Started
**Dependencies**: All tasks complete
**Estimated Effort**: 30 minutes
**Priority**: MEDIUM

Document implementation and testing procedures for team handoff.

### Subtasks:
- [ ] 14.1 Create MODE_TESTING.md
  - Document what was built
  - Explain mode differences
  - Document how to change modes (script usage)
  - List test venue IDs and modes
  - Document success metrics
  - List known limitations
  - Document next steps

**Deliverable**: `docs/MODE_TESTING.md`

**Acceptance Criteria**:
- Documentation is clear and complete
- Team can understand and test feature
- Script usage documented
- Known limitations transparent

---

## DEFERRED TO POST-MVP

The following are intentionally out of scope for the 1-2 day sprint:

### ❌ Mode Indicator Component
**Why**: Test venues manually assigned. Staff know mode from training. Not essential for testing.

### ❌ Staff Settings Page Adaptation
**Why**: Mode changes manual via script. Self-service can wait.

### ❌ Staff Dashboard Adaptation
**Why**: Dashboard differences don't affect core value prop testing.

### ❌ Sophisticated Caching
**Why**: Simple useState sufficient for test. Optimize after validation.

### ❌ Complex Error Boundaries
**Why**: Basic try/catch sufficient for MVP.

### ❌ Self-Service Mode Migration
**Why**: Manual script sufficient for test.

### ❌ Performance Optimization
**Why**: Test scale won't stress system. Optimize after validation.

### ❌ Automated Testing
**Why**: Manual testing sufficient for MVP. Automate after validation.

---

## Summary

**Total Tasks**: 14 (streamlined from 18)
**Development Effort**: 12-16 hours (1-2 days)
**Timeline**: 2 days dev + 1 week testing

**Day 1 (6-8 hours)**:
- Task 1: Database setup & script (1.5h)
- Task 2: Mode config service (1.5h)
- Task 3: Analytics tracking (1h)
- Task 4: Mode context provider (2h)
- Task 5: Feature guard hook (1h)

**Day 2 (6-8 hours)**:
- Task 6: Unavailable message component (0.5h)
- Task 7: Customer menu adaptation (1h)
- Task 8: Customer navigation (0.5h)
- Task 9: Menu route protection (0.5h)
- Task 10: Staff navigation (1h)
- Task 11: Tab page verification (0.5h)
- Task 12: E2E manual testing (3h)
- Task 13: Bug fixes (1-2h budget)
- Task 14: Documentation (0.5h)

**Critical Path**:
1. Tasks 1-2: Database & service
2. Tasks 4-5: Context & hooks
3. Tasks 7-10: UI adaptation
4. Task 12: Testing

**Key Principles**:
- Focus on menu access differentiation only
- Keep existing features unchanged (M-Pesa, printer service)
- Manual processes for test venues
- Simple implementations
- Fast iteration

**Post-Sprint Testing**:
- Week 1: Internal team testing
- Deploy to production
- Set 6 real venues to test modes
- 1-week live venue testing
- Analysis and go/no-go decision
