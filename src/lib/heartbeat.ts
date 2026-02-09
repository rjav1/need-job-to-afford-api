/**
 * Heartbeat Pulse System
 * 
 * Periodically checks for new job postings from tracked companies,
 * with priority focus on "dream companies" that may not have current openings.
 */

export interface Company {
  id: string;
  name: string;
  careersUrl?: string;
  isDreamCompany: boolean;
  lastChecked?: string;
  lastJobCount?: number;
}

export interface Industry {
  id: string;
  name: string;
  keywords: string[];
}

export interface HeartbeatConfig {
  enabled: boolean;
  frequencyMinutes: number;  // How often to pulse (default: 60)
  dreamCompanyFrequencyMinutes: number;  // More frequent for dream companies (default: 30)
  maxConcurrentChecks: number;  // Limit parallel requests (default: 3)
  notifyOnNewJobs: boolean;
  notifyOnDreamCompanyJobs: boolean;
}

export interface HeartbeatResult {
  companyId: string;
  companyName: string;
  isDreamCompany: boolean;
  timestamp: string;
  newJobsFound: number;
  jobs: JobPosting[];
  error?: string;
}

export interface JobPosting {
  id: string;
  title: string;
  company: string;
  companyId: string;
  location: string;
  type: 'full-time' | 'part-time' | 'contract' | 'internship' | 'unknown';
  salary?: string;
  postedDate?: string;
  url: string;
  description?: string;
  requirements?: string[];
  matchScore?: number;  // Calculated based on filter weights
  isDreamCompany: boolean;
  isNew?: boolean;  // True if posted since last check
}

export const DEFAULT_HEARTBEAT_CONFIG: HeartbeatConfig = {
  enabled: false,
  frequencyMinutes: 60,
  dreamCompanyFrequencyMinutes: 30,
  maxConcurrentChecks: 3,
  notifyOnNewJobs: true,
  notifyOnDreamCompanyJobs: true,
};

export const DEFAULT_INDUSTRIES: Industry[] = [
  { id: 'tech', name: 'Technology', keywords: ['software', 'tech', 'saas', 'ai', 'machine learning'] },
  { id: 'finance', name: 'Finance', keywords: ['fintech', 'banking', 'investment', 'trading'] },
  { id: 'healthcare', name: 'Healthcare', keywords: ['health', 'medical', 'biotech', 'pharma'] },
  { id: 'ecommerce', name: 'E-Commerce', keywords: ['retail', 'ecommerce', 'marketplace'] },
  { id: 'gaming', name: 'Gaming', keywords: ['game', 'gaming', 'esports', 'entertainment'] },
  { id: 'education', name: 'Education', keywords: ['edtech', 'education', 'learning'] },
  { id: 'media', name: 'Media & Entertainment', keywords: ['media', 'streaming', 'content'] },
  { id: 'enterprise', name: 'Enterprise Software', keywords: ['enterprise', 'b2b', 'saas'] },
];

// Storage keys for heartbeat data
export const HEARTBEAT_STORAGE_KEYS = {
  CONFIG: 'heartbeatConfig',
  COMPANIES: 'heartbeatCompanies',
  INDUSTRIES: 'heartbeatIndustries',
  LAST_RESULTS: 'heartbeatLastResults',
  JOB_CACHE: 'heartbeatJobCache',
} as const;

/**
 * HeartbeatManager class handles the pulse system
 */
export class HeartbeatManager {
  private config: HeartbeatConfig;
  private companies: Company[];
  private industries: Industry[];
  private intervalId: NodeJS.Timeout | null = null;
  private dreamIntervalId: NodeJS.Timeout | null = null;
  private onNewJobs: ((results: HeartbeatResult[]) => void) | null = null;

  constructor() {
    this.config = DEFAULT_HEARTBEAT_CONFIG;
    this.companies = [];
    this.industries = [...DEFAULT_INDUSTRIES];
  }

  /**
   * Initialize the heartbeat manager from storage
   */
  async init(): Promise<void> {
    const stored = await chrome.storage.local.get([
      HEARTBEAT_STORAGE_KEYS.CONFIG,
      HEARTBEAT_STORAGE_KEYS.COMPANIES,
      HEARTBEAT_STORAGE_KEYS.INDUSTRIES,
    ]);

    if (stored[HEARTBEAT_STORAGE_KEYS.CONFIG]) {
      this.config = { ...DEFAULT_HEARTBEAT_CONFIG, ...stored[HEARTBEAT_STORAGE_KEYS.CONFIG] };
    }
    if (stored[HEARTBEAT_STORAGE_KEYS.COMPANIES]) {
      this.companies = stored[HEARTBEAT_STORAGE_KEYS.COMPANIES];
    }
    if (stored[HEARTBEAT_STORAGE_KEYS.INDUSTRIES]) {
      this.industries = stored[HEARTBEAT_STORAGE_KEYS.INDUSTRIES];
    }

    if (this.config.enabled) {
      this.start();
    }
  }

  /**
   * Start the heartbeat pulse
   */
  start(): void {
    this.stop(); // Clear any existing intervals

    // Regular pulse for all companies
    this.intervalId = setInterval(
      () => this.pulse(false),
      this.config.frequencyMinutes * 60 * 1000
    );

    // More frequent pulse for dream companies
    this.dreamIntervalId = setInterval(
      () => this.pulse(true),
      this.config.dreamCompanyFrequencyMinutes * 60 * 1000
    );

    // Run initial check
    this.pulse(true);
  }

  /**
   * Stop the heartbeat pulse
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.dreamIntervalId) {
      clearInterval(this.dreamIntervalId);
      this.dreamIntervalId = null;
    }
  }

  /**
   * Set callback for new jobs found
   */
  setOnNewJobs(callback: (results: HeartbeatResult[]) => void): void {
    this.onNewJobs = callback;
  }

  /**
   * Perform a heartbeat pulse to check for new jobs
   */
  async pulse(dreamCompaniesOnly: boolean = false): Promise<HeartbeatResult[]> {
    const companiesToCheck = dreamCompaniesOnly
      ? this.companies.filter(c => c.isDreamCompany)
      : this.companies;

    if (companiesToCheck.length === 0) {
      return [];
    }

    const results: HeartbeatResult[] = [];
    const batches = this.chunkArray(companiesToCheck, this.config.maxConcurrentChecks);

    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map(company => this.checkCompany(company))
      );
      results.push(...batchResults);
    }

    // Save results and update last checked timestamps
    await this.saveResults(results);

    // Notify if new jobs found
    const resultsWithNewJobs = results.filter(r => r.newJobsFound > 0);
    if (resultsWithNewJobs.length > 0 && this.onNewJobs) {
      this.onNewJobs(resultsWithNewJobs);
    }

    return results;
  }

  /**
   * Check a single company for new job postings
   */
  private async checkCompany(company: Company): Promise<HeartbeatResult> {
    const result: HeartbeatResult = {
      companyId: company.id,
      companyName: company.name,
      isDreamCompany: company.isDreamCompany,
      timestamp: new Date().toISOString(),
      newJobsFound: 0,
      jobs: [],
    };

    try {
      // In a real implementation, this would:
      // 1. Scrape the company's careers page
      // 2. Use job board APIs (LinkedIn, Indeed, etc.)
      // 3. Compare with cached job IDs to find new postings
      
      // For now, we'll use a placeholder that can be extended
      const jobs = await this.fetchJobsForCompany(company);
      
      // Compare with cached jobs to find new ones
      const cachedJobIds = await this.getCachedJobIds(company.id);
      const newJobs = jobs.filter(job => !cachedJobIds.includes(job.id));
      
      result.jobs = jobs;
      result.newJobsFound = newJobs.length;
      
      // Mark new jobs
      result.jobs = result.jobs.map(job => ({
        ...job,
        isNew: !cachedJobIds.includes(job.id),
      }));

      // Update cache
      await this.cacheJobIds(company.id, jobs.map(j => j.id));
      
      // Update company's last checked timestamp
      company.lastChecked = new Date().toISOString();
      company.lastJobCount = jobs.length;
      await this.saveCompanies();

    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error';
    }

    return result;
  }

  /**
   * Fetch jobs for a company (placeholder - extend with actual scraping/API calls)
   */
  private async fetchJobsForCompany(company: Company): Promise<JobPosting[]> {
    // This is a placeholder. In production, this would:
    // 1. Scrape company careers pages
    // 2. Query job board APIs
    // 3. Use a job aggregation service
    
    // For now, return empty array - the system is set up for extension
    return [];
  }

  /**
   * Get cached job IDs for a company
   */
  private async getCachedJobIds(companyId: string): Promise<string[]> {
    const result = await chrome.storage.local.get(HEARTBEAT_STORAGE_KEYS.JOB_CACHE);
    const cache = result[HEARTBEAT_STORAGE_KEYS.JOB_CACHE] || {};
    return cache[companyId] || [];
  }

  /**
   * Cache job IDs for a company
   */
  private async cacheJobIds(companyId: string, jobIds: string[]): Promise<void> {
    const result = await chrome.storage.local.get(HEARTBEAT_STORAGE_KEYS.JOB_CACHE);
    const cache = result[HEARTBEAT_STORAGE_KEYS.JOB_CACHE] || {};
    cache[companyId] = jobIds;
    await chrome.storage.local.set({ [HEARTBEAT_STORAGE_KEYS.JOB_CACHE]: cache });
  }

  /**
   * Save heartbeat results
   */
  private async saveResults(results: HeartbeatResult[]): Promise<void> {
    await chrome.storage.local.set({
      [HEARTBEAT_STORAGE_KEYS.LAST_RESULTS]: results,
    });
  }

  /**
   * Save companies to storage
   */
  private async saveCompanies(): Promise<void> {
    await chrome.storage.local.set({
      [HEARTBEAT_STORAGE_KEYS.COMPANIES]: this.companies,
    });
  }

  /**
   * Get heartbeat configuration
   */
  getConfig(): HeartbeatConfig {
    return { ...this.config };
  }

  /**
   * Update heartbeat configuration
   */
  async setConfig(config: Partial<HeartbeatConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    await chrome.storage.local.set({
      [HEARTBEAT_STORAGE_KEYS.CONFIG]: this.config,
    });

    // Restart if enabled, stop if disabled
    if (this.config.enabled) {
      this.start();
    } else {
      this.stop();
    }
  }

  /**
   * Get all tracked companies
   */
  getCompanies(): Company[] {
    return [...this.companies];
  }

  /**
   * Get dream companies only
   */
  getDreamCompanies(): Company[] {
    return this.companies.filter(c => c.isDreamCompany);
  }

  /**
   * Get baseline (non-dream) companies
   */
  getBaselineCompanies(): Company[] {
    return this.companies.filter(c => !c.isDreamCompany);
  }

  /**
   * Add a company to track
   */
  async addCompany(company: Omit<Company, 'id'>): Promise<Company> {
    const newCompany: Company = {
      ...company,
      id: `company_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
    this.companies.push(newCompany);
    await this.saveCompanies();
    return newCompany;
  }

  /**
   * Update a company
   */
  async updateCompany(id: string, updates: Partial<Company>): Promise<void> {
    const index = this.companies.findIndex(c => c.id === id);
    if (index >= 0) {
      this.companies[index] = { ...this.companies[index], ...updates };
      await this.saveCompanies();
    }
  }

  /**
   * Remove a company
   */
  async removeCompany(id: string): Promise<void> {
    this.companies = this.companies.filter(c => c.id !== id);
    await this.saveCompanies();
  }

  /**
   * Toggle dream company status
   */
  async toggleDreamCompany(id: string): Promise<void> {
    const company = this.companies.find(c => c.id === id);
    if (company) {
      company.isDreamCompany = !company.isDreamCompany;
      await this.saveCompanies();
    }
  }

  /**
   * Get industries
   */
  getIndustries(): Industry[] {
    return [...this.industries];
  }

  /**
   * Add custom industry
   */
  async addIndustry(industry: Omit<Industry, 'id'>): Promise<Industry> {
    const newIndustry: Industry = {
      ...industry,
      id: `industry_${Date.now()}`,
    };
    this.industries.push(newIndustry);
    await chrome.storage.local.set({
      [HEARTBEAT_STORAGE_KEYS.INDUSTRIES]: this.industries,
    });
    return newIndustry;
  }

  /**
   * Utility: Split array into chunks
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

// Singleton instance
let heartbeatManagerInstance: HeartbeatManager | null = null;

export function getHeartbeatManager(): HeartbeatManager {
  if (!heartbeatManagerInstance) {
    heartbeatManagerInstance = new HeartbeatManager();
  }
  return heartbeatManagerInstance;
}

// Initialize in background script
export async function initHeartbeat(): Promise<HeartbeatManager> {
  const manager = getHeartbeatManager();
  await manager.init();
  return manager;
}
