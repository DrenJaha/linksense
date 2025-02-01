class SecurityService {
  constructor() {
    // Risk factors and their weights
    this.riskFactors = {
      protocol: { weight: 0.3 },
      domain: { weight: 0.3 },
      certificate: { weight: 0.2 },
      urlPattern: { weight: 0.2 }
    };
  }

  async assessSecurity(url) {
    try {
      const urlObj = new URL(url);
      const scores = {
        protocol: this.assessProtocol(urlObj),
        domain: await this.assessDomain(urlObj),
        certificate: await this.assessCertificate(urlObj),
        urlPattern: this.assessUrlPattern(urlObj)
      };

      // Calculate weighted average
      let totalScore = 0;
      let totalWeight = 0;

      for (const [factor, score] of Object.entries(scores)) {
        totalScore += score * this.riskFactors[factor].weight;
        totalWeight += this.riskFactors[factor].weight;
      }

      const finalScore = totalScore / totalWeight;
      return {
        score: finalScore,
        risk: this.getRiskLevel(finalScore),
        details: {
          protocol: scores.protocol,
          domain: scores.domain,
          certificate: scores.certificate,
          urlPattern: scores.urlPattern
        }
      };
    } catch (error) {
      console.error('Security assessment failed:', error);
      return {
        score: 0,
        risk: 'high',
        details: {
          error: error.message
        }
      };
    }
  }

  assessProtocol(urlObj) {
    // HTTPS is safer than HTTP
    return urlObj.protocol === 'https:' ? 1.0 : 0.2;
  }

  async assessDomain(urlObj) {
    const domain = urlObj.hostname;
    
    // Check for suspicious TLDs
    const suspiciousTLDs = ['.xyz', '.tk', '.ml', '.ga', '.cf'];
    if (suspiciousTLDs.some(tld => domain.endsWith(tld))) {
      return 0.2;
    }

    // Check for common trusted domains
    const trustedDomains = [
      'google.com', 'microsoft.com', 'apple.com', 'amazon.com',
      'github.com', 'linkedin.com', 'twitter.com', 'facebook.com'
    ];
    if (trustedDomains.some(td => domain.endsWith(td))) {
      return 1.0;
    }

    // Check for suspicious patterns
    const suspiciousPatterns = [
      /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/, // IP addresses
      /[^a-zA-Z0-9-.]/, // Special characters
      /(login|account|secure|bank).*\.(com|net|org)$/i // Potential phishing
    ];
    if (suspiciousPatterns.some(pattern => pattern.test(domain))) {
      return 0.3;
    }

    // Default score for unknown domains
    return 0.7;
  }

  async assessCertificate(urlObj) {
    // For now, just check HTTPS
    // In a full implementation, we could check certificate validity
    return urlObj.protocol === 'https:' ? 1.0 : 0.5;
  }

  assessUrlPattern(urlObj) {
    const fullUrl = urlObj.href;
    let score = 1.0;

    // Check for suspicious patterns in the URL
    const suspiciousPatterns = [
      /password|login|account/i,  // Sensitive keywords
      /[<>'"{}()]/,              // Script injection attempts
      /\.(exe|dll|bat|sh|msi)$/i, // Executable files
      /[^\x20-\x7E]/,            // Non-printable characters
      /[A-Za-z0-9]{30,}/         // Very long random strings
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(fullUrl)) {
        score -= 0.2;
      }
    }

    return Math.max(0.1, score);
  }

  getRiskLevel(score) {
    if (score >= 0.8) return 'safe';
    if (score >= 0.6) return 'moderate';
    if (score >= 0.4) return 'caution';
    return 'high';
  }
}

class MetadataService {
  constructor() {
    this.cache = new Map();
    this.MAX_CACHE_AGE = 24 * 60 * 60 * 1000; // 24 hours
    this.MAX_CACHE_SIZE = 1000;
    this.securityService = new SecurityService();
  }

  async getMetadata(url) {
    try {
      console.log('Fetching metadata for:', url);

      // Check cache first
      const cached = this.cache.get(url);
      if (cached && Date.now() - cached.timestamp < this.MAX_CACHE_AGE) {
        console.log('Returning cached data for:', url);
        return cached.data;
      }

      // Assess security first
      const security = await this.securityService.assessSecurity(url);

      // Try to fetch the URL directly
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'text/html',
          'User-Agent': 'Mozilla/5.0 Link Preview Generator'
        },
        mode: 'no-cors'
      });

      if (!response.ok && response.type !== 'opaque') {
        // If direct fetch fails, try using a proxy service
        return await this.fetchWithProxy(url, security);
      }

      const text = await response.text();
      const metadata = this.extractMetadata(text, url);

      // Add security assessment to metadata
      metadata.security = security;

      // Cache the result
      this.cacheMetadata(url, metadata);
      return metadata;

    } catch (error) {
      console.error('Direct fetch failed, trying proxy:', error);
      const security = await this.securityService.assessSecurity(url);
      return await this.fetchWithProxy(url, security);
    }
  }

  extractMetadata(html, url) {
    const getMetaContent = (name) => {
      const match = html.match(new RegExp(`<meta[^>]*(?:property|name)=["']${name}["'][^>]*content=["']([^"']+)["']`, 'i')) ||
                   html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']${name}["']`, 'i'));
      return match ? match[1] : null;
    };

    const getTitle = () => {
      const ogTitle = getMetaContent('og:title');
      const twitterTitle = getMetaContent('twitter:title');
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      return ogTitle || twitterTitle || (titleMatch ? titleMatch[1] : null) || new URL(url).hostname;
    };

    const getDescription = () => {
      const ogDesc = getMetaContent('og:description');
      const twitterDesc = getMetaContent('twitter:description');
      const metaDesc = getMetaContent('description');
      const firstP = html.match(/<p[^>]*>([^<]+)<\/p>/i);
      const description = ogDesc || twitterDesc || metaDesc || (firstP ? firstP[1] : null);
      return description ? description.substring(0, 200) + (description.length > 200 ? '...' : '') : 'No description available';
    };

    const getImage = () => {
      const ogImage = getMetaContent('og:image');
      const twitterImage = getMetaContent('twitter:image');
      const firstImage = html.match(/<img[^>]*src=["']([^"']+)["']/i);
      const imageUrl = ogImage || twitterImage || (firstImage ? firstImage[1] : null);
      return imageUrl ? new URL(imageUrl, url).href : null;
    };

    const getFavicon = () => {
      const patterns = [
        /<link[^>]*rel=["'](?:icon|shortcut icon)["'][^>]*href=["']([^"']+)["']/i,
        /<link[^>]*href=["']([^"']+)["'][^>]*rel=["'](?:icon|shortcut icon)["']/i,
        /<link[^>]*rel=["']apple-touch-icon["'][^>]*href=["']([^"']+)["']/i
      ];

      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match?.[1]) {
          return new URL(match[1], url).href;
        }
      }
      return new URL('/favicon.ico', url).href;
    };

    return {
      title: getTitle(),
      description: getDescription(),
      image: getImage(),
      favicon: getFavicon(),
      lastUpdated: new Date().toISOString()
    };
  }

  async fetchWithProxy(url, security) {
    try {
      // Use a public metadata API service
      const proxyUrl = `https://api.microlink.io?url=${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl);
      
      if (!response.ok) {
        throw new Error(`Proxy fetch failed: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        title: data.data?.title || new URL(url).hostname,
        description: data.data?.description || 'No description available',
        image: data.data?.image?.url || null,
        favicon: data.data?.logo?.url || new URL('/favicon.ico', url).href,
        lastUpdated: new Date().toISOString(),
        security: security
      };
    } catch (error) {
      console.error('Proxy fetch failed:', error);
      return this.createErrorMetadata(url, error.message, security);
    }
  }

  cacheMetadata(url, metadata) {
    try {
      if (this.cache.size >= this.MAX_CACHE_SIZE) {
        const oldestKey = this.cache.keys().next().value;
        this.cache.delete(oldestKey);
      }

      this.cache.set(url, {
        data: metadata,
        timestamp: Date.now()
      });
      console.log('Cached metadata for:', url);
    } catch (error) {
      console.error('Error caching metadata:', error);
    }
  }

  createErrorMetadata(url, errorMessage, security) {
    return {
      title: 'Preview Unavailable',
      description: `Could not load preview: ${errorMessage}`,
      image: null,
      favicon: null,
      lastUpdated: new Date().toISOString(),
      security: security,
      error: true
    };
  }
}

// Initialize services
const metadataService = new MetadataService();

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_PREVIEW_DATA') {
    console.log('Received preview request for:', request.url);
    
    // Handle the request
    metadataService.getMetadata(request.url)
      .then(metadata => {
        console.log('Successfully fetched preview data:', metadata);
        sendResponse(metadata);
      })
      .catch(error => {
        console.error('Failed to get preview data:', error);
        sendResponse(metadataService.createErrorMetadata(request.url, error.message));
      });
    return true; // Required for async response
  }
}); 