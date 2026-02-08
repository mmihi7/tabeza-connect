# Implementation Plan: Real-Time Notification Fixes

## Overview

This implementation plan addresses two critical issues:
1. Mobile staff app bell notifications blocked by browser autoplay policies
2. Customer app not updating UI automatically when staff actions occur

The implementation is divided into 4 main phases with focused sub-tasks.

## Tasks

- [ ] 1. Implement audio unlock system for staff app
  - [x] 1.1 Create audio unlock infrastructure
    - Create `packages/shared/audio-unlock.ts` with AudioUnlockManager class
    - Implement Web Audio API context management with unlock() method
    - Create `packages/shared/notification-manager.ts` with fallback chain (audio → vibration → visual)
    - Add comprehensive logging for all notification attempts
    - _Requirements: 1, 3, 6, 14, 15_
  
  - [x] 1.2 Build unlock UI and integrate into staff app
    - Create `apps/staff/components/AudioUnlockPrompt.tsx` with mobile-friendly design
    - Update `apps/staff/app/page.tsx` to show unlock prompt on mobile
    - Replace direct audio playback with NotificationManager.notify()
    - Add vibration and visual fallbacks
    - Persist unlock state for session
    - _Requirements: 1, 12, 13_
  
  - [ ]* 1.3 Write tests for audio unlock system
    - **Property 1: Audio Unlock Mechanism** - Test unlock transitions and idempotence
    - **Property 2: Audio Playback After Unlock** - Test sound plays after unlock
    - **Property 3: Notification Fallback Chain** - Test audio → vibration → visual fallback
    - Unit tests for AudioUnlockPrompt component
    - _Requirements: 1, 3, 14_

- [x] 2. Fix customer app real-time state updates
  - [x] 2.1 Create order state management helpers
    - Create `apps/customer/lib/order-state-helpers.ts`
    - Implement updateOrderInList(), addOrderToList(), removeOrderFromList()
    - Ensure immutability, proper ordering, and duplicate prevention
    - _Requirements: 5, 6, 10_
  
  - [x] 2.2 Update customer app real-time subscription handlers
    - Update `apps/customer/app/menu/page.tsx` real-time handlers
    - Fix handleOrderUpdate and handleOrderInsert to call setOrders with state updater
    - Use order state helper functions
    - Wrap handlers in useCallback with proper dependencies
    - Add comprehensive logging for debugging
    - Implement error handling with refetch fallback
    - _Requirements: 5, 6, 10, 11, 14, 15_
  
  - [ ]* 2.3 Write tests for customer app state management
    - **Property 4: Real-Time State Synchronization** - Test state updates trigger re-renders
    - **Property 5: Concurrent Update Handling** - Test rapid updates handled correctly
    - **Property 6: Subscription Cleanup** - Test unmount cleans up subscriptions
    - **Property 7: Callback Referential Stability** - Test no subscription loops
    - _Requirements: 5, 6, 10, 11_

- [x] 3. Add browser capability detection and error handling
  - [x] 3.1 Implement browser capability detection
    - Create `packages/shared/browser-capabilities.ts`
    - Detect audio, vibration, notification support
    - Detect autoplay policy and mobile vs desktop
    - Identify browser and platform
    - _Requirements: 7, 8, 9_
  
  - [x] 3.2 Integrate capabilities into notification system
    - Update NotificationManager to use capability detection
    - Adapt notification strategy based on browser profile
    - Add reconnection logic for subscription failures (exponential backoff)
    - Implement graceful error handling throughout
    - _Requirements: 7, 8, 9, 11_
  
  - [ ]* 3.3 Write tests for browser compatibility
    - **Property 8: Browser Capability Adaptation** - Test different capability profiles
    - **Property 9: Error Resilience** - Test app continues after failures
    - Unit tests for browser capability detection
    - _Requirements: 7, 8, 9_

- [x] 4. Final testing and deployment
  - [x] 4.1 Cross-browser integration testing
    - Test on iOS Safari (real device) - unlock prompt, audio, vibration
    - Test on Android Chrome (real device) - unlock prompt, audio, vibration
    - Test on desktop browsers - no regression in existing functionality
    - Test customer app real-time updates - staff confirmations and new orders appear instantly
    - Test multiple rapid updates handled correctly
    - _Requirements: 1, 5, 7_
  
  - [x] 4.2 Run all property tests and verify correctness
    - Run all property tests with minimum 100 iterations each
    - Verify all 11 correctness properties pass
    - Run all unit tests
    - Fix any failing tests
    - _All Requirements_
  
  - [x] 4.3 Documentation and deployment
    - Update README with notification system documentation
    - Document browser compatibility matrix
    - Document troubleshooting guide for common issues
    - Deploy to staging and verify on real devices
    - Deploy to production with monitoring
    - _Requirements: 14, 15_

## Notes

- Tasks marked with `*` are optional property tests and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Real device testing is critical for mobile browser autoplay policies
- Property tests validate universal correctness with minimum 100 iterations
- Focus on getting core functionality working first, then add comprehensive tests
