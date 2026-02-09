/**
 * Form Memory - Remember site patterns for faster future processing
 * Stores learned field mappings and site-specific configurations
 */

import { FieldType } from './types';

export interface FieldMapping {
  // Identifiers to match
  selectors: FieldSelector[];
  // What field type this maps to
  fieldType: FieldType;
  // Confidence level (0-1)
  confidence: number;
  // Number of times this mapping was used successfully
  successCount: number;
  // Last used timestamp
  lastUsed: number;
}

export interface FieldSelector {
  // CSS selector (if applicable)
  cssSelector?: string;
  // Element attributes
  id?: string;
  name?: string;
  type?: string;
  placeholder?: string;
  ariaLabel?: string;
  // Text patterns
  labelPattern?: string;
  nearbyTextPattern?: string;
  // Data attributes
  dataAttributes?: Record<string, string>;
}

export interface SitePattern {
  // Domain pattern (can include wildcards)
  domain: string;
  // Path pattern (optional)
  pathPattern?: string;
  // Known field mappings for this site
  fieldMappings: FieldMapping[];
  // Site-specific hints
  hints: SiteHints;
  // When this pattern was last updated
  lastUpdated: number;
  // Success rate for this site
  successRate: number;
  // Number of applications processed
  applicationCount: number;
}

export interface SiteHints {
  // ATS type if known
  atsType?: 'workday' | 'greenhouse' | 'lever' | 'icims' | 'taleo' | 'jobvite' | 'custom';
  // Does the site use React/Vue/Angular?
  framework?: 'react' | 'vue' | 'angular' | 'unknown';
  // Does it have multi-step forms?
  hasMultiStep?: boolean;
  // Known selectors for next/submit buttons
  nextButtonSelector?: string;
  submitButtonSelector?: string;
  // Fields that need special handling
  specialFields?: Record<string, string>;
  // Custom wait time between fields (ms)
  fieldDelay?: number;
}

// Storage key prefix
const STORAGE_PREFIX = 'formMemory_';
const SITE_INDEX_KEY = 'formMemory_siteIndex';

/**
 * Form Memory Manager - handles storing and retrieving site patterns
 */
export class FormMemory {
  private cache: Map<string, SitePattern> = new Map();
  private siteIndex: string[] = [];

  constructor() {
    this.loadSiteIndex();
  }

  /**
   * Load the index of known sites
   */
  private async loadSiteIndex(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(SITE_INDEX_KEY);
      this.siteIndex = result[SITE_INDEX_KEY] || [];
    } catch (e) {
      console.log('[FormMemory] Error loading site index:', e);
      this.siteIndex = [];
    }
  }

  /**
   * Save the site index
   */
  private async saveSiteIndex(): Promise<void> {
    try {
      await chrome.storage.local.set({ [SITE_INDEX_KEY]: this.siteIndex });
    } catch (e) {
      console.log('[FormMemory] Error saving site index:', e);
    }
  }

  /**
   * Get the domain key for a URL
   */
  private getDomainKey(url: string): string {
    try {
      const parsed = new URL(url);
      // Remove www. prefix for consistency
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return 'unknown';
    }
  }

  /**
   * Get pattern for a site
   */
  async getPattern(url: string): Promise<SitePattern | null> {
    const domain = this.getDomainKey(url);
    
    // Check cache first
    if (this.cache.has(domain)) {
      return this.cache.get(domain)!;
    }
    
    // Load from storage
    try {
      const key = STORAGE_PREFIX + domain;
      const result = await chrome.storage.local.get(key);
      const pattern = result[key] as SitePattern | undefined;
      
      if (pattern) {
        this.cache.set(domain, pattern);
        return pattern;
      }
    } catch (e) {
      console.log('[FormMemory] Error loading pattern:', e);
    }
    
    return null;
  }

  /**
   * Save or update pattern for a site
   */
  async savePattern(url: string, pattern: Partial<SitePattern>): Promise<void> {
    const domain = this.getDomainKey(url);
    
    // Get existing pattern or create new
    let existing = await this.getPattern(url);
    
    if (existing) {
      // Merge patterns
      existing = {
        ...existing,
        ...pattern,
        fieldMappings: mergeFieldMappings(existing.fieldMappings, pattern.fieldMappings || []),
        hints: { ...existing.hints, ...pattern.hints },
        lastUpdated: Date.now(),
      };
    } else {
      existing = {
        domain,
        fieldMappings: pattern.fieldMappings || [],
        hints: pattern.hints || {},
        lastUpdated: Date.now(),
        successRate: 0,
        applicationCount: 0,
        ...pattern,
      };
    }
    
    // Save to cache and storage
    this.cache.set(domain, existing);
    
    try {
      const key = STORAGE_PREFIX + domain;
      await chrome.storage.local.set({ [key]: existing });
      
      // Update index if new site
      if (!this.siteIndex.includes(domain)) {
        this.siteIndex.push(domain);
        await this.saveSiteIndex();
      }
    } catch (e) {
      console.log('[FormMemory] Error saving pattern:', e);
    }
  }

  /**
   * Record a successful field mapping
   */
  async recordSuccess(url: string, selector: FieldSelector, fieldType: FieldType): Promise<void> {
    const pattern = await this.getPattern(url) || {
      domain: this.getDomainKey(url),
      fieldMappings: [],
      hints: {},
      lastUpdated: Date.now(),
      successRate: 0,
      applicationCount: 0,
    };
    
    // Find existing mapping or create new
    let mapping = pattern.fieldMappings.find(m => 
      m.fieldType === fieldType && selectorMatches(m.selectors, selector)
    );
    
    if (mapping) {
      mapping.successCount++;
      mapping.confidence = Math.min(0.99, mapping.confidence + 0.05);
      mapping.lastUsed = Date.now();
    } else {
      mapping = {
        selectors: [selector],
        fieldType,
        confidence: 0.7,
        successCount: 1,
        lastUsed: Date.now(),
      };
      pattern.fieldMappings.push(mapping);
    }
    
    await this.savePattern(url, pattern);
  }

  /**
   * Record a failed field mapping (reduces confidence)
   */
  async recordFailure(url: string, selector: FieldSelector, fieldType: FieldType): Promise<void> {
    const pattern = await this.getPattern(url);
    if (!pattern) return;
    
    const mapping = pattern.fieldMappings.find(m => 
      m.fieldType === fieldType && selectorMatches(m.selectors, selector)
    );
    
    if (mapping) {
      mapping.confidence = Math.max(0.1, mapping.confidence - 0.1);
    }
    
    await this.savePattern(url, pattern);
  }

  /**
   * Record an application completion
   */
  async recordApplication(url: string, success: boolean): Promise<void> {
    const pattern = await this.getPattern(url);
    if (!pattern) return;
    
    pattern.applicationCount++;
    
    // Update success rate with exponential moving average
    const alpha = 0.3;
    pattern.successRate = alpha * (success ? 1 : 0) + (1 - alpha) * pattern.successRate;
    
    await this.savePattern(url, pattern);
  }

  /**
   * Find field type from memory based on selector
   */
  async findFieldType(url: string, selector: FieldSelector): Promise<{ type: FieldType; confidence: number } | null> {
    const pattern = await this.getPattern(url);
    if (!pattern) return null;
    
    // Find best matching mapping
    let bestMatch: FieldMapping | null = null;
    let bestScore = 0;
    
    for (const mapping of pattern.fieldMappings) {
      const score = calculateMatchScore(mapping.selectors, selector) * mapping.confidence;
      if (score > bestScore && score > 0.3) {
        bestScore = score;
        bestMatch = mapping;
      }
    }
    
    if (bestMatch) {
      return {
        type: bestMatch.fieldType,
        confidence: bestScore,
      };
    }
    
    return null;
  }

  /**
   * Get all known sites
   */
  async getAllSites(): Promise<SitePattern[]> {
    const patterns: SitePattern[] = [];
    
    for (const domain of this.siteIndex) {
      try {
        const key = STORAGE_PREFIX + domain;
        const result = await chrome.storage.local.get(key);
        if (result[key]) {
          patterns.push(result[key]);
        }
      } catch (e) {
        // Skip failed loads
      }
    }
    
    return patterns;
  }

  /**
   * Clear all memory
   */
  async clearAll(): Promise<void> {
    try {
      const keysToRemove = this.siteIndex.map(d => STORAGE_PREFIX + d);
      keysToRemove.push(SITE_INDEX_KEY);
      await chrome.storage.local.remove(keysToRemove);
      this.cache.clear();
      this.siteIndex = [];
    } catch (e) {
      console.log('[FormMemory] Error clearing memory:', e);
    }
  }

  /**
   * Export memory to JSON
   */
  async export(): Promise<string> {
    const patterns = await this.getAllSites();
    return JSON.stringify(patterns, null, 2);
  }

  /**
   * Import memory from JSON
   */
  async import(json: string): Promise<number> {
    try {
      const patterns = JSON.parse(json) as SitePattern[];
      let imported = 0;
      
      for (const pattern of patterns) {
        await this.savePattern(`https://${pattern.domain}`, pattern);
        imported++;
      }
      
      return imported;
    } catch (e) {
      console.log('[FormMemory] Error importing:', e);
      throw e;
    }
  }
}

/**
 * Merge field mappings, combining selectors for same field types
 */
function mergeFieldMappings(existing: FieldMapping[], newMappings: FieldMapping[]): FieldMapping[] {
  const merged = [...existing];
  
  for (const newMapping of newMappings) {
    const existingIdx = merged.findIndex(m => m.fieldType === newMapping.fieldType);
    
    if (existingIdx >= 0) {
      // Merge selectors
      const existingMapping = merged[existingIdx];
      for (const selector of newMapping.selectors) {
        if (!existingMapping.selectors.some(s => selectorEquals(s, selector))) {
          existingMapping.selectors.push(selector);
        }
      }
      // Update stats
      existingMapping.successCount += newMapping.successCount;
      existingMapping.confidence = Math.max(existingMapping.confidence, newMapping.confidence);
    } else {
      merged.push(newMapping);
    }
  }
  
  return merged;
}

/**
 * Check if two selectors are equivalent
 */
function selectorEquals(a: FieldSelector, b: FieldSelector): boolean {
  return a.id === b.id && 
         a.name === b.name && 
         a.type === b.type &&
         a.labelPattern === b.labelPattern;
}

/**
 * Check if any selector in the list matches the target
 */
function selectorMatches(selectors: FieldSelector[], target: FieldSelector): boolean {
  return selectors.some(s => {
    if (s.id && target.id && s.id === target.id) return true;
    if (s.name && target.name && s.name === target.name) return true;
    if (s.labelPattern && target.labelPattern) {
      try {
        const regex = new RegExp(s.labelPattern, 'i');
        if (regex.test(target.labelPattern)) return true;
      } catch {
        if (s.labelPattern === target.labelPattern) return true;
      }
    }
    return false;
  });
}

/**
 * Calculate match score between selector list and target
 */
function calculateMatchScore(selectors: FieldSelector[], target: FieldSelector): number {
  let maxScore = 0;
  
  for (const selector of selectors) {
    let score = 0;
    let factors = 0;
    
    // ID match (strongest)
    if (selector.id && target.id) {
      factors++;
      if (selector.id === target.id) score += 1.0;
      else if (target.id.includes(selector.id) || selector.id.includes(target.id)) score += 0.5;
    }
    
    // Name match
    if (selector.name && target.name) {
      factors++;
      if (selector.name === target.name) score += 0.9;
      else if (target.name.includes(selector.name) || selector.name.includes(target.name)) score += 0.4;
    }
    
    // Type match
    if (selector.type && target.type) {
      factors++;
      if (selector.type === target.type) score += 0.7;
    }
    
    // Label pattern match
    if (selector.labelPattern && target.labelPattern) {
      factors++;
      try {
        const regex = new RegExp(selector.labelPattern, 'i');
        if (regex.test(target.labelPattern)) score += 0.8;
      } catch {
        if (target.labelPattern.toLowerCase().includes(selector.labelPattern.toLowerCase())) {
          score += 0.6;
        }
      }
    }
    
    // Aria label match
    if (selector.ariaLabel && target.ariaLabel) {
      factors++;
      if (selector.ariaLabel === target.ariaLabel) score += 0.8;
      else if (target.ariaLabel.toLowerCase().includes(selector.ariaLabel.toLowerCase())) score += 0.5;
    }
    
    // Placeholder match
    if (selector.placeholder && target.placeholder) {
      factors++;
      if (selector.placeholder === target.placeholder) score += 0.7;
      else if (target.placeholder.toLowerCase().includes(selector.placeholder.toLowerCase())) score += 0.4;
    }
    
    // Normalize score
    if (factors > 0) {
      const normalizedScore = score / factors;
      maxScore = Math.max(maxScore, normalizedScore);
    }
  }
  
  return maxScore;
}

/**
 * Create a selector from an element's attributes
 */
export function createSelectorFromElement(element: HTMLElement, labelText?: string): FieldSelector {
  const selector: FieldSelector = {};
  
  if (element.id) selector.id = element.id;
  if ((element as HTMLInputElement).name) selector.name = (element as HTMLInputElement).name;
  if ((element as HTMLInputElement).type) selector.type = (element as HTMLInputElement).type;
  if ((element as HTMLInputElement).placeholder) selector.placeholder = (element as HTMLInputElement).placeholder;
  if (element.getAttribute('aria-label')) selector.ariaLabel = element.getAttribute('aria-label')!;
  if (labelText) selector.labelPattern = labelText;
  
  // Extract data attributes
  const dataAttrs: Record<string, string> = {};
  for (const attr of element.attributes) {
    if (attr.name.startsWith('data-') && attr.value) {
      dataAttrs[attr.name] = attr.value;
    }
  }
  if (Object.keys(dataAttrs).length > 0) {
    selector.dataAttributes = dataAttrs;
  }
  
  return selector;
}

// Singleton instance
export const formMemory = new FormMemory();

// Built-in patterns for common ATS platforms
export const BUILTIN_PATTERNS: Record<string, Partial<SitePattern>> = {
  'workday.com': {
    hints: {
      atsType: 'workday',
      framework: 'react',
      hasMultiStep: true,
      nextButtonSelector: '[data-automation-id="bottom-navigation-next-button"]',
      submitButtonSelector: '[data-automation-id="bottom-navigation-next-button"]',
      fieldDelay: 300,
    },
  },
  'myworkdayjobs.com': {
    hints: {
      atsType: 'workday',
      framework: 'react',
      hasMultiStep: true,
      nextButtonSelector: '[data-automation-id="bottom-navigation-next-button"]',
      submitButtonSelector: '[data-automation-id="bottom-navigation-next-button"]',
      fieldDelay: 300,
    },
  },
  'greenhouse.io': {
    hints: {
      atsType: 'greenhouse',
      hasMultiStep: false,
      submitButtonSelector: '#submit_app',
      fieldDelay: 100,
    },
  },
  'lever.co': {
    hints: {
      atsType: 'lever',
      hasMultiStep: false,
      submitButtonSelector: '.postings-btn-submit',
      fieldDelay: 100,
    },
  },
  'icims.com': {
    hints: {
      atsType: 'icims',
      hasMultiStep: true,
      fieldDelay: 200,
    },
  },
  'taleo.net': {
    hints: {
      atsType: 'taleo',
      hasMultiStep: true,
      fieldDelay: 300,
    },
  },
  'jobvite.com': {
    hints: {
      atsType: 'jobvite',
      hasMultiStep: false,
      fieldDelay: 150,
    },
  },
};

/**
 * Initialize built-in patterns for new installations
 */
export async function initBuiltinPatterns(): Promise<void> {
  for (const [domain, pattern] of Object.entries(BUILTIN_PATTERNS)) {
    const existing = await formMemory.getPattern(`https://${domain}`);
    if (!existing) {
      await formMemory.savePattern(`https://${domain}`, pattern);
    }
  }
}
