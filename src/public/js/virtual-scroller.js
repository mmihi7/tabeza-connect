/**
 * Virtual Scroller for Log Viewer
 * 
 * Implements virtual scrolling to efficiently render large log files
 * Only renders visible items plus a buffer, improving performance
 * 
 * Requirements: 19.1-19.5 (Performance Optimizations)
 */

class VirtualScroller {
  /**
   * Create a virtual scroller
   * 
   * @param {HTMLElement} container - Container element for the scroller
   * @param {Object} options - Configuration options
   * @param {number} options.itemHeight - Height of each item in pixels
   * @param {number} options.bufferSize - Number of items to render above/below viewport
   * @param {Function} options.renderItem - Function to render an item (item, index) => HTMLString
   */
  constructor(container, options = {}) {
    this.container = container;
    this.itemHeight = options.itemHeight || 24; // Default 24px per log line
    this.bufferSize = options.bufferSize || 10; // Render 10 extra items above/below
    this.renderItem = options.renderItem || this.defaultRenderItem.bind(this);
    
    this.items = [];
    this.visibleStart = 0;
    this.visibleEnd = 0;
    
    // Create inner container for items
    this.innerContainer = document.createElement('div');
    this.innerContainer.style.position = 'relative';
    this.container.appendChild(this.innerContainer);
    
    // Bind scroll handler
    this.handleScroll = this.handleScroll.bind(this);
    this.container.addEventListener('scroll', this.handleScroll);
    
    // Track if we should auto-scroll to bottom
    this.autoScrollEnabled = true;
  }
  
  /**
   * Default item renderer
   * 
   * @param {*} item - Item to render
   * @param {number} index - Index of the item
   * @returns {string} HTML string
   */
  defaultRenderItem(item, index) {
    return `<div style="height: ${this.itemHeight}px; line-height: ${this.itemHeight}px;">${item}</div>`;
  }
  
  /**
   * Set the items to display
   * 
   * @param {Array} items - Array of items to display
   */
  setItems(items) {
    this.items = items;
    
    // Set total height based on number of items
    this.innerContainer.style.height = `${items.length * this.itemHeight}px`;
    
    // Check if user was at bottom before update
    const wasAtBottom = this.isScrolledToBottom();
    
    // Render visible items
    this.render();
    
    // Auto-scroll to bottom if enabled and was at bottom
    if (this.autoScrollEnabled && wasAtBottom) {
      this.scrollToBottom();
    }
  }
  
  /**
   * Check if scrolled to bottom
   * 
   * @returns {boolean} True if scrolled to bottom
   */
  isScrolledToBottom() {
    const threshold = 50; // Within 50px of bottom
    return (
      this.container.scrollHeight - this.container.scrollTop - this.container.clientHeight < threshold
    );
  }
  
  /**
   * Scroll to bottom
   */
  scrollToBottom() {
    this.container.scrollTop = this.container.scrollHeight;
  }
  
  /**
   * Handle scroll event
   */
  handleScroll() {
    // Disable auto-scroll if user scrolls up
    if (!this.isScrolledToBottom()) {
      this.autoScrollEnabled = false;
    } else {
      this.autoScrollEnabled = true;
    }
    
    // Use requestAnimationFrame to batch render updates
    if (!this.rafScheduled) {
      this.rafScheduled = true;
      requestAnimationFrame(() => {
        this.render();
        this.rafScheduled = false;
      });
    }
  }
  
  /**
   * Render visible items
   */
  render() {
    if (this.items.length === 0) {
      this.innerContainer.innerHTML = '<p style="color: #666; padding: 10px;">No logs available</p>';
      return;
    }
    
    // Calculate visible range
    const scrollTop = this.container.scrollTop;
    const viewportHeight = this.container.clientHeight;
    
    // Calculate which items are visible
    const startIndex = Math.floor(scrollTop / this.itemHeight);
    const endIndex = Math.ceil((scrollTop + viewportHeight) / this.itemHeight);
    
    // Add buffer
    this.visibleStart = Math.max(0, startIndex - this.bufferSize);
    this.visibleEnd = Math.min(this.items.length, endIndex + this.bufferSize);
    
    // Render visible items
    let html = '';
    
    // Add spacer for items above visible range
    if (this.visibleStart > 0) {
      const spacerHeight = this.visibleStart * this.itemHeight;
      html += `<div style="height: ${spacerHeight}px;"></div>`;
    }
    
    // Render visible items
    for (let i = this.visibleStart; i < this.visibleEnd; i++) {
      html += this.renderItem(this.items[i], i);
    }
    
    // Add spacer for items below visible range
    if (this.visibleEnd < this.items.length) {
      const spacerHeight = (this.items.length - this.visibleEnd) * this.itemHeight;
      html += `<div style="height: ${spacerHeight}px;"></div>`;
    }
    
    this.innerContainer.innerHTML = html;
  }
  
  /**
   * Destroy the scroller and clean up
   */
  destroy() {
    this.container.removeEventListener('scroll', this.handleScroll);
    this.innerContainer.remove();
  }
}

// Export for use in normal-mode.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VirtualScroller;
} else {
  window.VirtualScroller = VirtualScroller;
}
