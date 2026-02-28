# Requirements Document

## Introduction

This specification addresses two critical real-time notification issues in the Tabeza application:
1. Mobile staff app bell notification sounds not playing due to browser autoplay restrictions
2. Customer app requiring manual refresh to see staff order confirmations and new staff orders

Both issues impact the user experience and operational efficiency of the tab management system. The staff app issue prevents timely awareness of new customer orders on mobile devices, while the customer app issue creates confusion when staff actions don't appear immediately.

## Glossary

- **Staff_App**: The staff-facing Progressive Web App used to manage orders, tabs, and payments
- **Customer_App**: The customer-facing Progressive Web App used to browse menus and place orders
- **Bell_Notification**: Audio alert that plays when new customer orders arrive in the staff app
- **Real_Time_Subscription**: Supabase real-time database subscription that pushes updates to clients
- **User_Gesture**: Browser-recognized user interaction (tap, click, swipe) required to play audio
- **Autoplay_Policy**: Browser security policy that blocks audio playback without user interaction
- **Order_Confirmation**: Staff action accepting a customer's pending order
- **Staff_Order**: Order initiated by staff on behalf of a customer
- **Vibration_Fallback**: Device vibration used when audio playback is blocked

## Requirements

### Requirement 1: Mobile Staff Bell Notification

**User Story:** As a bar staff member using a mobile device, I want to receive audio notifications when new customer orders arrive, so that I can respond promptly without constantly checking the screen.

#### Acceptance Criteria

1. WHEN the Staff_App loads on a mobile device, THE System SHALL request user interaction to unlock audio playback for the session
2. WHEN a new customer order arrives after audio is unlocked, THE Bell_Notification SHALL play successfully
3. IF audio playback is blocked by the browser, THEN THE System SHALL use Vibration_Fallback and log the failure reason
4. THE System SHALL maintain existing desktop notification functionality without regression

### Requirement 2: Customer Real-Time Order Updates

**User Story:** As a customer using the app, I want to see staff order confirmations and new staff orders appear immediately, so that I know my order status without refreshing the page.

#### Acceptance Criteria

5. WHEN staff confirms a pending order OR creates a new order, THE Customer_App SHALL display the change immediately without manual refresh by updating React state to trigger UI re-render
6. WHEN multiple updates arrive in quick succession, THE System SHALL handle all updates without data loss and maintain existing real-time functionality for other events

### Requirement 3: Cross-Browser Compatibility and Graceful Degradation

**User Story:** As a user on any device, I want the real-time notifications to work consistently with appropriate fallbacks, so that I have a reliable experience regardless of my browser or device capabilities.

#### Acceptance Criteria

7. THE System SHALL support iOS Safari, Android Chrome, and desktop browsers (Chrome, Firefox, Safari, Edge) with appropriate autoplay policy handling
8. THE System SHALL detect browser capabilities and implement fallback chain: audio → vibration → visual notifications
9. WHEN notification methods fail OR permissions are denied, THE System SHALL continue functioning without crashes and provide clear user feedback about active notification methods

### Requirement 4: State Management and Subscription Lifecycle

**User Story:** As a developer, I want the real-time subscription updates to properly trigger React state changes and clean up resources, so that the UI reflects the latest data automatically without memory leaks.

#### Acceptance Criteria

10. WHEN a Real_Time_Subscription event is received, THE System SHALL update React state using proper state setters with referential stability (useCallback) to prevent subscription loops
11. WHEN the component unmounts, THE System SHALL properly clean up subscriptions and handle race conditions between multiple simultaneous updates

### Requirement 5: User Interaction Unlock Flow

**User Story:** As a staff member, I want a clear way to enable audio notifications when I first open the app, so that I don't miss important order alerts.

#### Acceptance Criteria

12. WHEN the Staff_App loads, THE System SHALL display a prompt to enable notifications that unlocks audio playback when tapped
13. WHEN audio is successfully unlocked, THE System SHALL hide the prompt, show confirmation, and remember the unlock state for the current session

### Requirement 6: Debugging and Monitoring

**User Story:** As a developer, I want comprehensive logging of notification events, so that I can diagnose issues in production.

#### Acceptance Criteria

14. WHEN audio playback is attempted OR Real_Time_Subscription events are received, THE System SHALL log the attempt/event with timestamp, type, and result
15. WHEN errors occur, THE System SHALL log detailed error information including browser capabilities, device context, and state transitions
