/**
 * What's New Dialog Module
 * 
 * Handles the display and interaction of the "What's New" modal dialog
 * that appears after upgrades to inform users about new features.
 * 
 * Requirements: 17.6
 */

(function() {
  'use strict';

  // ───────────────────────────────────────────────────────────────────────────
  // State
  // ───────────────────────────────────────────────────────────────────────────

  let isDialogShown = false;

  // ───────────────────────────────────────────────────────────────────────────
  // DOM Creation
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Create the What's New modal dialog HTML structure
   * @returns {HTMLElement} The modal overlay element
   */
  function createWhatsNewDialog() {
    const overlay = document.createElement('div');
    overlay.className = 'whats-new-overlay hidden';
    overlay.id = 'whats-new-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'whats-new-title');

    overlay.innerHTML = `
      <div class="whats-new-modal">
        <div class="whats-new-header">
          <h2 id="whats-new-title">What's New in Tabeza Connect</h2>
          <div class="version">Version 1.7.10</div>
        </div>
        
        <div class="whats-new-body">
          <h3>Easier Access to Management UI</h3>
          <p>
            We've simplified how you access the Tabeza Connect management interface:
          </p>
          
          <div class="feature-highlight">
            <p>
              <span class="icon">🖱️</span>
              <strong>Single-click the tray icon</strong> to open the Management UI
            </p>
          </div>
          
          <p>
            Previously, you needed to right-click the tray icon and select an option from the menu. 
            Now, simply click once on the tray icon to open the management interface instantly.
          </p>
          
          <h3>Simplified Tray Menu</h3>
          <p>
            The right-click menu now contains only essential controls:
          </p>
          <ul>
            <li><strong>Start/Stop Service</strong> - Quick service control</li>
            <li><strong>Version Info</strong> - See your current version</li>
            <li><strong>Quit</strong> - Exit the application</li>
          </ul>
          
          <p>
            All other features (printer setup, template generator, logs, etc.) are now 
            conveniently accessible from the Management UI.
          </p>
        </div>
        
        <div class="whats-new-footer">
          <div class="dont-show-again">
            <input 
              type="checkbox" 
              id="dont-show-again-checkbox" 
              aria-label="Don't show this message again"
            />
            <label for="dont-show-again-checkbox">
              Don't show this message again
            </label>
          </div>
          
          <button 
            class="whats-new-close-btn" 
            id="whats-new-close-btn"
            aria-label="Close What's New dialog"
          >
            Got it!
          </button>
        </div>
      </div>
    `;

    return overlay;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Dialog Control
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Show the What's New dialog
   */
  function showWhatsNewDialog() {
    if (isDialogShown) {
      console.log('[WhatsNew] Dialog already shown');
      return;
    }

    console.log('[WhatsNew] Showing dialog');

    // Create dialog if it doesn't exist
    let overlay = document.getElementById('whats-new-overlay');
    if (!overlay) {
      overlay = createWhatsNewDialog();
      document.body.appendChild(overlay);

      // Set up event listeners
      setupEventListeners(overlay);
    }

    // Show dialog
    overlay.classList.remove('hidden');
    isDialogShown = true;

    // Focus the close button for accessibility
    setTimeout(() => {
      const closeBtn = document.getElementById('whats-new-close-btn');
      if (closeBtn) {
        closeBtn.focus();
      }
    }, 100);

    // Announce to screen readers
    announceToScreenReader('What\'s New dialog opened. New features in Tabeza Connect version 1.7.10.');
  }

  /**
   * Hide the What's New dialog
   */
  function hideWhatsNewDialog() {
    const overlay = document.getElementById('whats-new-overlay');
    if (!overlay) return;

    console.log('[WhatsNew] Hiding dialog');

    // Get checkbox state
    const checkbox = document.getElementById('dont-show-again-checkbox');
    const dontShowAgain = checkbox ? checkbox.checked : false;

    // Mark version as seen
    if (window.electronAPI && window.electronAPI.markWhatsNewSeen) {
      window.electronAPI.markWhatsNewSeen(dontShowAgain)
        .then(result => {
          if (result.success) {
            console.log('[WhatsNew] Version marked as seen');
            if (dontShowAgain) {
              console.log('[WhatsNew] User opted out of future dialogs');
            }
          } else {
            console.error('[WhatsNew] Failed to mark version as seen:', result.error);
          }
        })
        .catch(error => {
          console.error('[WhatsNew] Error marking version as seen:', error);
        });
    }

    // Hide dialog
    overlay.classList.add('hidden');
    isDialogShown = false;

    // Announce to screen readers
    announceToScreenReader('What\'s New dialog closed.');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Event Listeners
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Set up event listeners for the dialog
   * @param {HTMLElement} overlay - The modal overlay element
   */
  function setupEventListeners(overlay) {
    // Close button click
    const closeBtn = document.getElementById('whats-new-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', hideWhatsNewDialog);
    }

    // Click outside modal to close
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        hideWhatsNewDialog();
      }
    });

    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isDialogShown) {
        hideWhatsNewDialog();
      }
    });

    // Checkbox label click (for better UX)
    const label = overlay.querySelector('label[for="dont-show-again-checkbox"]');
    if (label) {
      label.addEventListener('click', (e) => {
        // Prevent double-toggle (label already toggles checkbox)
        e.stopPropagation();
      });
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Accessibility
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Announce message to screen readers using ARIA live region
   * @param {string} message - Message to announce
   */
  function announceToScreenReader(message) {
    let liveRegion = document.getElementById('whats-new-live-region');
    
    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.id = 'whats-new-live-region';
      liveRegion.setAttribute('role', 'status');
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.style.position = 'absolute';
      liveRegion.style.left = '-10000px';
      liveRegion.style.width = '1px';
      liveRegion.style.height = '1px';
      liveRegion.style.overflow = 'hidden';
      document.body.appendChild(liveRegion);
    }
    
    liveRegion.textContent = message;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Initialization
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Check if dialog should be shown and display it if needed
   */
  async function initializeWhatsNewDialog() {
    console.log('[WhatsNew] Initializing...');

    // Check if electronAPI is available
    if (!window.electronAPI || !window.electronAPI.shouldShowWhatsNew) {
      console.warn('[WhatsNew] electronAPI not available, skipping');
      return;
    }

    try {
      // Check if dialog should be shown
      const shouldShow = await window.electronAPI.shouldShowWhatsNew();
      
      if (shouldShow) {
        console.log('[WhatsNew] Should show dialog');
        // Show dialog after a short delay to let the UI settle
        setTimeout(() => {
          showWhatsNewDialog();
        }, 1000);
      } else {
        console.log('[WhatsNew] Should not show dialog');
      }
    } catch (error) {
      console.error('[WhatsNew] Error checking if dialog should be shown:', error);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public API
  // ───────────────────────────────────────────────────────────────────────────

  // Expose public API
  window.WhatsNewDialog = {
    show: showWhatsNewDialog,
    hide: hideWhatsNewDialog,
    initialize: initializeWhatsNewDialog
  };

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeWhatsNewDialog);
  } else {
    // DOM already loaded
    initializeWhatsNewDialog();
  }

})();
