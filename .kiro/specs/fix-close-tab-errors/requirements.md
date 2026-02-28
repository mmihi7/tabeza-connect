# Requirements Document

## Introduction

This specification addresses critical errors in the tab closing functionality across both the customer and staff applications. Currently, customers cannot close their tabs due to a missing API endpoint, and the staff app's close tab functionality may have reliability issues with the RPC function call.

## Glossary

- **Tab**: A customer's order session at a bar, tracking orders and payments
- **Customer_App**: The customer-facing Progressive Web App for placing orders
- **Staff_App**: The staff-facing interface for managing tabs and orders
- **Close_Tab_RPC**: Database stored procedure for closing tabs with optional write-off
- **Tab_Balance**: The difference between confirmed orders total and successful payments total
- **Overdue_Tab**: A tab with a positive balance that is pushed to bad debt
- **API_Route**: Next.js server-side endpoint for handling HTTP requests

## Requirements

### Requirement 1: Customer Tab Closing

**User Story:** As a customer, I want to close my tab when my balance is zero, so that I can complete my session at the bar.

#### Acceptance Criteria

1. WHEN a customer with zero balance requests to close their tab, THE Customer_App SHALL successfully close the tab
2. WHEN a customer with a positive balance attempts to close their tab, THE Customer_App SHALL prevent closure and display the remaining balance
3. WHEN the close tab request is processed, THE Customer_App SHALL redirect the customer to the home page
4. WHEN a tab close request fails, THE Customer_App SHALL display a clear error message to the customer
5. THE Customer_App SHALL validate that the tab belongs to the requesting device before allowing closure

### Requirement 2: Staff Tab Closing

**User Story:** As a staff member, I want to reliably close tabs or push them to overdue status, so that I can manage customer sessions effectively.

#### Acceptance Criteria

1. WHEN staff closes a tab with zero balance, THE Staff_App SHALL successfully close the tab
2. WHEN staff closes a tab with a positive balance, THE Staff_App SHALL push the tab to overdue status with the balance as write-off
3. WHEN there are pending staff orders awaiting customer approval, THE Staff_App SHALL prevent tab closure
4. WHEN there are unserved customer orders, THE Staff_App SHALL prevent tab closure
5. WHEN a tab close operation fails, THE Staff_App SHALL display a detailed error message with troubleshooting guidance

### Requirement 3: API Endpoint Implementation

**User Story:** As a developer, I want a reliable API endpoint for closing tabs, so that the customer app can close tabs without direct database access.

#### Acceptance Criteria

1. THE System SHALL provide a POST endpoint at `/api/tabs/close`
2. WHEN the endpoint receives a valid tab ID, THE System SHALL validate the tab exists and belongs to the requesting device
3. WHEN the tab has zero balance, THE System SHALL call the Close_Tab_RPC function with no write-off
4. WHEN the tab has a positive balance, THE System SHALL reject the close request with a 400 status code
5. WHEN the Close_Tab_RPC function succeeds, THE System SHALL return a 200 status code with success message
6. WHEN any validation or database error occurs, THE System SHALL return an appropriate error status code and message

### Requirement 4: Error Handling and User Feedback

**User Story:** As a user (customer or staff), I want clear feedback when tab closing fails, so that I understand what went wrong and what to do next.

#### Acceptance Criteria

1. WHEN a tab close operation fails due to network issues, THE System SHALL display a "Connection Error" message
2. WHEN a tab close operation fails due to pending orders, THE System SHALL display which orders are blocking closure
3. WHEN a tab close operation fails due to insufficient permissions, THE System SHALL display an "Unauthorized" message
4. WHEN a tab close operation fails due to database errors, THE System SHALL log the error details for debugging
5. THE System SHALL provide user-friendly error messages that avoid exposing technical implementation details

### Requirement 5: Database Function Validation

**User Story:** As a developer, I want to ensure the close_tab database function exists and works correctly, so that both apps can reliably close tabs.

#### Acceptance Criteria

1. THE Close_Tab_RPC function SHALL accept a tab ID parameter
2. THE Close_Tab_RPC function SHALL accept an optional write-off amount parameter
3. WHEN called with a valid tab ID and zero write-off, THE Close_Tab_RPC function SHALL set tab status to 'closed'
4. WHEN called with a valid tab ID and positive write-off, THE Close_Tab_RPC function SHALL set tab status to 'overdue'
5. THE Close_Tab_RPC function SHALL update the closed_at timestamp when closing a tab
6. THE Close_Tab_RPC function SHALL update the moved_to_overdue_at timestamp when pushing to overdue
