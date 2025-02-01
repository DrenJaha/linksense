class LinkHoverManager {
  constructor() {
    this.hoverTimeout = null;
    this.currentPreview = null;
    this.hoverDelay = 300; // ms
    this.previewCache = new Map();
    this.previewElement = null;
    this.settings = {
      enablePreviews: true,
      showImages: true,
      previewDelay: 300
    };
  }

  init() {
    this.createPreviewElement();
    this.loadSettings();
    document.addEventListener('mouseover', this.handleMouseOver.bind(this));
    document.addEventListener('mouseout', this.handleMouseOut.bind(this));
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get('settings');
      this.settings = { ...this.settings, ...result.settings };
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  handleMessage(request) {
    if (request.type === 'SETTINGS_UPDATED') {
      this.settings = { ...this.settings, ...request.settings };
    }
  }

  createPreviewElement() {
    if (this.previewElement) {
      document.body.removeChild(this.previewElement);
    }
    
    this.previewElement = document.createElement('div');
    this.previewElement.className = 'link-preview-card';
    document.body.appendChild(this.previewElement);
  }

  handleMouseOver(e) {
    if (!this.settings.enablePreviews) return;
    
    const link = e.target.closest('a');
    if (!link) return;

    clearTimeout(this.hoverTimeout);
    this.hoverTimeout = setTimeout(() => {
      this.handleLinkHover(link);
    }, this.settings.previewDelay);
  }

  handleMouseOut(e) {
    clearTimeout(this.hoverTimeout);
    const link = e.target.closest('a');
    const preview = e.target.closest('.link-preview-card');
    
    if (!link && !preview) {
      this.hidePreview();
    }
  }

  async handleLinkHover(link) {
    try {
      const url = this.sanitizeUrl(link.href);
      if (!this.isValidUrl(url)) {
        console.warn(`Invalid URL detected: ${url}`);
        return;
      }

      // Show loading state
      this.showLoadingPreview(link.getBoundingClientRect());

      const previewData = await this.getPreviewData(url);
      this.showPreview(previewData, link.getBoundingClientRect());
      
    } catch (error) {
      console.error('Preview generation failed:', error);
      this.handlePreviewError(error, link.getBoundingClientRect());
    }
  }

  showLoadingPreview(linkRect) {
    this.previewElement.innerHTML = `
      <div class="preview-loading">
        <div class="preview-loading-spinner"></div>
        <p>Loading preview...</p>
      </div>
    `;

    const previewRect = this.calculatePreviewPosition(linkRect);
    Object.assign(this.previewElement.style, {
      display: 'block',
      top: previewRect.top + 'px',
      left: previewRect.left + 'px'
    });
  }

  sanitizeUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.toString();
    } catch (e) {
      return null;
    }
  }

  isValidUrl(url) {
    if (!url) return false;
    try {
      new URL(url);
      return true;
    } catch (e) {
      return false;
    }
  }

  async getPreviewData(url) {
    // Check cache first
    if (this.previewCache.has(url)) {
      return this.previewCache.get(url);
    }

    // Send message to background script to fetch preview data
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: 'GET_PREVIEW_DATA',
        url: url
      }, response => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        
        if (response) {
          // Cache the result
          this.previewCache.set(url, response);
          resolve(response);
        } else {
          reject(new Error('No response from background script'));
        }
      });
    });
  }

  getSecurityMessage(security) {
    const messages = {
      safe: 'This link appears to be safe',
      moderate: 'Exercise normal caution with this link',
      caution: 'Be careful with this link',
      high: 'Warning: This link may be unsafe'
    };

    const details = [];
    if (security.details) {
      if (security.details.protocol < 0.5) details.push('Not using HTTPS');
      if (security.details.domain < 0.5) details.push('Suspicious domain');
      if (security.details.urlPattern < 0.5) details.push('Suspicious URL pattern');
    }

    return {
      message: messages[security.risk] || messages.high,
      details: details.join(', ')
    };
  }

  showPreview(previewData, linkRect) {
    const { title, description, image, favicon, error, security } = previewData;
    
    let html = `
      <div class="preview-header">
        ${favicon ? `<img src="${this.escapeHtml(favicon)}" class="preview-favicon" onerror="this.style.display='none'" />` : ''}
        <h3 class="preview-title">${this.escapeHtml(title)}</h3>
      </div>
    `;

    if (this.settings.showImages && image && !error) {
      html += `<img src="${this.escapeHtml(image)}" class="preview-image" onerror="this.style.display='none'" />`;
    }

    html += `<p class="preview-description">${this.escapeHtml(description)}</p>`;

    if (security) {
      const securityInfo = this.getSecurityMessage(security);
      html += `
        <div class="preview-security ${security.risk}">
          <div class="preview-security-icon"></div>
          <div>
            <div>${securityInfo.message}</div>
            ${securityInfo.details ? `<div style="font-size: 11px; opacity: 0.8">${securityInfo.details}</div>` : ''}
          </div>
        </div>
      `;
    }

    if (error) {
      html += `<div class="preview-error">Unable to load preview</div>`;
    }

    this.previewElement.innerHTML = html;

    const previewRect = this.calculatePreviewPosition(linkRect);
    Object.assign(this.previewElement.style, {
      display: 'block',
      top: previewRect.top + 'px',
      left: previewRect.left + 'px'
    });
  }

  hidePreview() {
    if (this.previewElement) {
      this.previewElement.style.display = 'none';
    }
  }

  calculatePreviewPosition(linkRect) {
    const SPACING = 10;
    const previewWidth = 300;
    const previewHeight = 200;

    let left = linkRect.left;
    let top = linkRect.bottom + SPACING;

    // Check if preview would go off-screen to the right
    if (left + previewWidth > window.innerWidth) {
      left = window.innerWidth - previewWidth - SPACING;
    }

    // Check if preview would go off-screen at the bottom
    if (top + previewHeight > window.innerHeight) {
      top = linkRect.top - previewHeight - SPACING;
    }

    // Ensure preview stays within viewport
    left = Math.max(SPACING, Math.min(left, window.innerWidth - previewWidth - SPACING));
    top = Math.max(SPACING, Math.min(top, window.innerHeight - previewHeight - SPACING));

    return { top, left };
  }

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  handlePreviewError(error, linkRect) {
    this.showPreview({
      title: 'Preview Unavailable',
      description: error.message || 'Could not load preview for this link.',
      image: null,
      favicon: null,
      error: true
    }, linkRect);
  }
}

// Initialize the hover manager
const hoverManager = new LinkHoverManager();
hoverManager.init(); 