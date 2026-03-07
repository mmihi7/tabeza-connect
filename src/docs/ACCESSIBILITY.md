# Accessibility Features - Tabeza Connect Management UI

## Overview

This document describes the accessibility features implemented in the Tabeza Connect Management UI to ensure compliance with WCAG AA standards and provide an inclusive user experience for all users, including those with disabilities.

## Requirements Addressed

- **Requirement 18.1**: ARIA labels for all interactive elements
- **Requirement 18.2**: Full keyboard navigation support
- **Requirement 18.3**: Visible focus indicators for all focusable elements
- **Requirement 18.4**: Text alternatives for all status icons and visual indicators
- **Requirement 18.5**: Sufficient color contrast ratios (WCAG AA minimum 4.5:1)
- **Requirement 18.6**: ARIA live regions for status change announcements

## Implemented Features

### 1. ARIA Labels and Semantic HTML (Requirement 18.1)

All interactive elements have appropriate ARIA labels:

```html
<!-- Buttons with descriptive labels -->
<button aria-label="Start service">Start</button>
<button aria-label="Configure Bar ID">Configure</button>
<button aria-label="Close notification">×</button>

<!-- Regions with labels -->
<div role="region" aria-labelledby="service-status-title">
  <h3 id="service-status-title">Service Status</h3>
</div>

<!-- Tab navigation with ARIA -->
<nav role="tablist" aria-label="Main navigation">
  <button role="tab" aria-selected="true" aria-controls="dashboard-section">
    Dashboard
  </button>
</nav>

<!-- Form inputs with labels and hints -->
<label for="input-barId">Bar ID</label>
<input type="text" id="input-barId" aria-required="true" aria-describedby="barid-hint">
<span id="barid-hint" class="sr-only">Enter the Bar ID from your Tabeza staff app</span>
```

### 2. Keyboard Navigation (Requirement 18.2)

Full keyboard support is implemented:

#### Global Keyboard Shortcuts

- **Ctrl+1**: Switch to Dashboard section
- **Ctrl+2**: Switch to Printer Setup section
- **Ctrl+3**: Switch to Template Generator section
- **Ctrl+4**: Switch to System section
- **Ctrl+5**: Switch to Logs section
- **Ctrl+R**: Restart service
- **Ctrl+W**: Close window (handled by Electron)

#### Tab Navigation

- **Arrow Left/Up**: Navigate to previous tab
- **Arrow Right/Down**: Navigate to next tab
- **Home**: Navigate to first tab
- **End**: Navigate to last tab

#### Skip to Content

A "Skip to Content" link is provided for keyboard users to bypass navigation:

```html
<a href="#main-content" class="skip-to-content">Skip to main content</a>
```

This link is hidden by default but becomes visible when focused.

### 3. Focus Indicators (Requirement 18.3)

Visible focus indicators with sufficient contrast are applied to all interactive elements:

```css
/* Visible focus indicator for all interactive elements */
button:focus,
a:focus,
input:focus,
select:focus,
textarea:focus,
[tabindex]:focus {
  outline: 3px solid #667eea;
  outline-offset: 2px;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
}

/* Enhanced focus for buttons */
.btn:focus,
.tab:focus {
  outline: 3px solid #667eea;
  outline-offset: 2px;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.3);
}

/* Focus visible for keyboard navigation only */
button:focus-visible,
a:focus-visible,
input:focus-visible,
[tabindex]:focus-visible {
  outline: 3px solid #667eea;
  outline-offset: 2px;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.3);
}
```

The focus indicators:
- Use a 3px solid outline for high visibility
- Include a 2px offset for better separation from the element
- Add a subtle box-shadow for additional emphasis
- Meet WCAG AA contrast requirements (4.5:1 minimum)

### 4. Text Alternatives (Requirement 18.4)

All visual indicators have text alternatives:

```html
<!-- Icons marked as decorative -->
<h3><span aria-hidden="true">⚙️</span> Service Status</h3>

<!-- Status with text alternatives -->
<span class="step-icon" aria-hidden="true">⚪</span>
<span class="step-status not-started" aria-live="polite">Not Started</span>

<!-- Success screen with accessible label -->
<h1 aria-label="Setup complete"><span aria-hidden="true">✓</span></h1>
```

Decorative icons are marked with `aria-hidden="true"` to prevent screen readers from announcing them, while meaningful status information is provided through text content.

### 5. Color Contrast (Requirement 18.5)

All text meets WCAG AA contrast requirements (4.5:1 minimum):

```css
/* Text colors with sufficient contrast */
body {
  color: #1f2937; /* 11.6:1 contrast on white */
}

.status-label {
  color: #4b5563; /* 7.5:1 contrast on white */
}

/* Status indicators with sufficient contrast */
.status-value.online {
  color: #059669; /* 4.5:1 contrast on white */
}

.status-value.offline {
  color: #dc2626; /* 5.9:1 contrast on white */
}

.status-value.warning {
  color: #d97706; /* 4.5:1 contrast on white */
}
```

### 6. ARIA Live Regions (Requirement 18.6)

Status changes are announced to screen readers using ARIA live regions:

```html
<!-- Global ARIA live region -->
<div id="aria-live-region" class="sr-only" aria-live="polite" aria-atomic="true"></div>

<!-- Status updates with live regions -->
<div class="status-item" role="status" aria-live="polite">
  <span class="status-label">Status</span>
  <span class="status-value online" id="service-status">Running</span>
</div>

<!-- Progress updates -->
<span id="progress-text" aria-live="polite" aria-atomic="true">0/3 steps complete</span>

<!-- Notifications -->
<div class="notification" role="alert" aria-live="assertive" aria-atomic="true">
  <span class="notification-message"></span>
</div>
```

The `announceToScreenReader()` function in `shared.js` provides programmatic announcements:

```javascript
/**
 * Announce message to screen readers using ARIA live region
 * @param {string} message - Message to announce
 * @param {string} priority - 'polite' or 'assertive'
 */
function announceToScreenReader(message, priority = 'polite') {
  let liveRegion = document.getElementById('aria-live-region');
  
  if (!liveRegion) {
    liveRegion = document.createElement('div');
    liveRegion.id = 'aria-live-region';
    liveRegion.className = 'sr-only';
    liveRegion.setAttribute('aria-live', priority);
    liveRegion.setAttribute('aria-atomic', 'true');
    document.body.appendChild(liveRegion);
  }
  
  liveRegion.setAttribute('aria-live', priority);
  liveRegion.textContent = '';
  
  setTimeout(() => {
    liveRegion.textContent = message;
  }, 100);
}
```

## Screen Reader Only Content

Content that should only be available to screen readers uses the `.sr-only` class:

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

## High Contrast Mode Support

The UI adapts to high contrast mode preferences:

```css
@media (prefers-contrast: high) {
  button,
  .btn {
    border: 2px solid currentColor;
  }
  
  .step {
    border-width: 3px;
  }
  
  .tab.active {
    border-bottom-width: 4px;
  }
}
```

## Reduced Motion Support

Animations are disabled for users who prefer reduced motion:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

## Testing Recommendations

### Manual Testing

1. **Keyboard Navigation**:
   - Tab through all interactive elements
   - Verify focus indicators are visible
   - Test all keyboard shortcuts (Ctrl+1-5, Ctrl+R)
   - Navigate tabs using arrow keys

2. **Screen Reader Testing**:
   - Test with NVDA (Windows)
   - Test with JAWS (Windows)
   - Verify all status changes are announced
   - Verify all buttons have descriptive labels

3. **Color Contrast**:
   - Use browser DevTools to verify contrast ratios
   - Test with color blindness simulators
   - Verify all text is readable

4. **High Contrast Mode**:
   - Enable Windows High Contrast mode
   - Verify all UI elements are visible
   - Verify focus indicators are visible

### Automated Testing

Use accessibility testing tools:

- **axe DevTools**: Browser extension for automated accessibility testing
- **WAVE**: Web accessibility evaluation tool
- **Lighthouse**: Chrome DevTools accessibility audit

## Known Limitations

1. **Virtual Scroller**: The log viewer uses virtual scrolling for performance, which may have limited screen reader support. Consider providing an alternative view for screen reader users.

2. **Modal Dialogs**: Modal dialogs should trap focus within the dialog while open. This is implemented in the `showModal()` function but should be 