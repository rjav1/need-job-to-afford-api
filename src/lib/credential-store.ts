/**
 * Credential Store - Secure storage for job site login credentials
 * 
 * Handles password generation, encryption, and retrieval for
 * accounts created during job application flows.
 */

import { storage } from './storage';

// Storage key for credentials
const CREDENTIALS_KEY = 'jobSiteCredentials';
const ENCRYPTION_KEY_SEED = 'ai-job-applier-credential-store-v1';

// Types
export interface StoredCredential {
  id: string;
  platform: string;           // e.g., "workday", "greenhouse", "taleo"
  domain: string;             // Full domain: myworkdayjobs.com/company
  companyName?: string;       // Company if identifiable
  email: string;
  password: string;           // Encrypted
  createdAt: string;
  lastUsedAt: string;
  verified: boolean;          // Whether email was verified
  metadata?: {
    atsType?: string;
    signupUrl?: string;
    loginUrl?: string;
    notes?: string;
  };
}

export interface CredentialMatch {
  credential: StoredCredential;
  matchType: 'exact' | 'platform' | 'domain-partial';
  confidence: number;
}

export interface PasswordOptions {
  length?: number;
  includeUppercase?: boolean;
  includeLowercase?: boolean;
  includeNumbers?: boolean;
  includeSymbols?: boolean;
  excludeAmbiguous?: boolean;  // Exclude l, 1, I, O, 0, etc.
}

const DEFAULT_PASSWORD_OPTIONS: PasswordOptions = {
  length: 16,
  includeUppercase: true,
  includeLowercase: true,
  includeNumbers: true,
  includeSymbols: true,
  excludeAmbiguous: true,
};

// Character sets for password generation
const CHAR_SETS = {
  uppercase: 'ABCDEFGHJKLMNPQRSTUVWXYZ',  // Excludes I, O
  uppercaseFull: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghjkmnpqrstuvwxyz',    // Excludes i, l, o
  lowercaseFull: 'abcdefghijklmnopqrstuvwxyz',
  numbers: '23456789',                      // Excludes 0, 1
  numbersFull: '0123456789',
  symbols: '!@#$%^&*-_=+',                 // Safe symbols that work on most sites
  symbolsFull: '!@#$%^&*()_+-=[]{}|;:,.<>?',
};

/**
 * Generate a cryptographically secure password
 */
export function generateSecurePassword(options: PasswordOptions = {}): string {
  const opts = { ...DEFAULT_PASSWORD_OPTIONS, ...options };
  
  let charset = '';
  const requiredChars: string[] = [];
  
  // Build character set and ensure at least one of each required type
  if (opts.includeUppercase) {
    const set = opts.excludeAmbiguous ? CHAR_SETS.uppercase : CHAR_SETS.uppercaseFull;
    charset += set;
    requiredChars.push(getRandomChar(set));
  }
  if (opts.includeLowercase) {
    const set = opts.excludeAmbiguous ? CHAR_SETS.lowercase : CHAR_SETS.lowercaseFull;
    charset += set;
    requiredChars.push(getRandomChar(set));
  }
  if (opts.includeNumbers) {
    const set = opts.excludeAmbiguous ? CHAR_SETS.numbers : CHAR_SETS.numbersFull;
    charset += set;
    requiredChars.push(getRandomChar(set));
  }
  if (opts.includeSymbols) {
    const set = opts.excludeAmbiguous ? CHAR_SETS.symbols : CHAR_SETS.symbolsFull;
    charset += set;
    requiredChars.push(getRandomChar(set));
  }
  
  if (charset.length === 0) {
    throw new Error('At least one character set must be enabled');
  }
  
  // Generate remaining characters
  const remainingLength = (opts.length || 16) - requiredChars.length;
  const remainingChars: string[] = [];
  
  for (let i = 0; i < remainingLength; i++) {
    remainingChars.push(getRandomChar(charset));
  }
  
  // Combine and shuffle
  const allChars = [...requiredChars, ...remainingChars];
  return shuffleArray(allChars).join('');
}

/**
 * Get a random character from a string using crypto API
 */
function getRandomChar(charset: string): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return charset[array[0] % charset.length];
}

/**
 * Fisher-Yates shuffle using crypto API
 */
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const randomArray = new Uint32Array(1);
    crypto.getRandomValues(randomArray);
    const j = randomArray[0] % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Simple XOR-based obfuscation for stored passwords
 * Note: This is NOT true encryption, but provides basic protection
 * against casual inspection. For true security, use a proper encryption library.
 */
function obfuscatePassword(password: string): string {
  const key = ENCRYPTION_KEY_SEED;
  let result = '';
  for (let i = 0; i < password.length; i++) {
    result += String.fromCharCode(password.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return btoa(result);  // Base64 encode
}

/**
 * Deobfuscate a stored password
 */
function deobfuscatePassword(encoded: string): string {
  const key = ENCRYPTION_KEY_SEED;
  const decoded = atob(encoded);
  let result = '';
  for (let i = 0; i < decoded.length; i++) {
    result += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}

/**
 * Normalize domain for matching
 */
function normalizeDomain(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove www. and get hostname + pathname for Workday-style URLs
    let domain = parsed.hostname.replace(/^www\./, '');
    
    // For Workday, include the company path
    if (domain.includes('myworkdayjobs.com') || domain.includes('workday.com')) {
      const pathParts = parsed.pathname.split('/').filter(Boolean);
      if (pathParts.length > 0) {
        domain = `${domain}/${pathParts[0]}`;
      }
    }
    
    return domain.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/**
 * Detect platform type from URL
 */
export function detectPlatform(url: string): string {
  const urlLower = url.toLowerCase();
  
  if (urlLower.includes('workday') || urlLower.includes('myworkdayjobs')) return 'workday';
  if (urlLower.includes('greenhouse.io')) return 'greenhouse';
  if (urlLower.includes('lever.co')) return 'lever';
  if (urlLower.includes('taleo')) return 'taleo';
  if (urlLower.includes('icims')) return 'icims';
  if (urlLower.includes('ashbyhq.com')) return 'ashby';
  if (urlLower.includes('jobvite.com')) return 'jobvite';
  if (urlLower.includes('smartrecruiters')) return 'smartrecruiters';
  if (urlLower.includes('bamboohr.com')) return 'bamboohr';
  if (urlLower.includes('jazz.co')) return 'jazzhr';
  if (urlLower.includes('workable.com')) return 'workable';
  if (urlLower.includes('breezy.hr')) return 'breezyhr';
  if (urlLower.includes('applicantpro')) return 'applicantpro';
  if (urlLower.includes('ultipro') || urlLower.includes('ukg.net')) return 'ultipro';
  
  return 'unknown';
}

/**
 * Credential Store class
 */
class CredentialStoreImpl {
  private cache: StoredCredential[] | null = null;
  
  /**
   * Load all credentials from storage
   */
  async loadAll(): Promise<StoredCredential[]> {
    if (this.cache) return this.cache;
    
    const result = await chrome.storage.local.get(CREDENTIALS_KEY);
    this.cache = result[CREDENTIALS_KEY] || [];
    return this.cache;
  }
  
  /**
   * Save credentials to storage
   */
  private async saveAll(credentials: StoredCredential[]): Promise<void> {
    this.cache = credentials;
    await chrome.storage.local.set({ [CREDENTIALS_KEY]: credentials });
  }
  
  /**
   * Store a new credential
   */
  async store(credential: Omit<StoredCredential, 'id' | 'createdAt' | 'lastUsedAt' | 'password'> & { password: string }): Promise<StoredCredential> {
    const credentials = await this.loadAll();
    
    const stored: StoredCredential = {
      ...credential,
      id: `cred-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      password: obfuscatePassword(credential.password),
      createdAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
    };
    
    // Remove any existing credential for same domain/email
    const filtered = credentials.filter(
      c => !(c.domain === stored.domain && c.email === stored.email)
    );
    
    filtered.push(stored);
    await this.saveAll(filtered);
    
    console.log(`[CredentialStore] Stored credential for ${stored.platform}:${stored.domain}`);
    return stored;
  }
  
  /**
   * Find credentials for a URL/domain
   */
  async findForUrl(url: string): Promise<CredentialMatch | null> {
    const credentials = await this.loadAll();
    const domain = normalizeDomain(url);
    const platform = detectPlatform(url);
    
    // 1. Try exact domain match
    const exactMatch = credentials.find(c => normalizeDomain(c.domain) === domain);
    if (exactMatch) {
      return {
        credential: { ...exactMatch, password: deobfuscatePassword(exactMatch.password) },
        matchType: 'exact',
        confidence: 1.0,
      };
    }
    
    // 2. Try platform + partial domain match (for Workday subdomains, etc.)
    if (platform !== 'unknown') {
      const platformMatches = credentials.filter(c => c.platform === platform);
      
      // For Workday, the company path matters
      for (const cred of platformMatches) {
        const credDomain = normalizeDomain(cred.domain);
        if (domain.includes(credDomain) || credDomain.includes(domain)) {
          return {
            credential: { ...cred, password: deobfuscatePassword(cred.password) },
            matchType: 'domain-partial',
            confidence: 0.8,
          };
        }
      }
      
      // Return most recently used credential for this platform
      if (platformMatches.length > 0) {
        const mostRecent = platformMatches.sort(
          (a, b) => new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime()
        )[0];
        
        return {
          credential: { ...mostRecent, password: deobfuscatePassword(mostRecent.password) },
          matchType: 'platform',
          confidence: 0.5,
        };
      }
    }
    
    return null;
  }
  
  /**
   * Find credential by email
   */
  async findByEmail(email: string): Promise<StoredCredential[]> {
    const credentials = await this.loadAll();
    return credentials
      .filter(c => c.email.toLowerCase() === email.toLowerCase())
      .map(c => ({ ...c, password: deobfuscatePassword(c.password) }));
  }
  
  /**
   * Get credential by ID
   */
  async getById(id: string): Promise<StoredCredential | null> {
    const credentials = await this.loadAll();
    const cred = credentials.find(c => c.id === id);
    return cred ? { ...cred, password: deobfuscatePassword(cred.password) } : null;
  }
  
  /**
   * Update last used time
   */
  async updateLastUsed(id: string): Promise<void> {
    const credentials = await this.loadAll();
    const index = credentials.findIndex(c => c.id === id);
    
    if (index >= 0) {
      credentials[index].lastUsedAt = new Date().toISOString();
      await this.saveAll(credentials);
    }
  }
  
  /**
   * Mark credential as verified
   */
  async markVerified(id: string): Promise<void> {
    const credentials = await this.loadAll();
    const index = credentials.findIndex(c => c.id === id);
    
    if (index >= 0) {
      credentials[index].verified = true;
      credentials[index].lastUsedAt = new Date().toISOString();
      await this.saveAll(credentials);
    }
  }
  
  /**
   * Update credential metadata
   */
  async updateMetadata(id: string, metadata: Partial<StoredCredential['metadata']>): Promise<void> {
    const credentials = await this.loadAll();
    const index = credentials.findIndex(c => c.id === id);
    
    if (index >= 0) {
      credentials[index].metadata = { ...credentials[index].metadata, ...metadata };
      await this.saveAll(credentials);
    }
  }
  
  /**
   * Delete a credential
   */
  async delete(id: string): Promise<void> {
    const credentials = await this.loadAll();
    const filtered = credentials.filter(c => c.id !== id);
    await this.saveAll(filtered);
  }
  
  /**
   * Delete all credentials for a platform
   */
  async deleteByPlatform(platform: string): Promise<number> {
    const credentials = await this.loadAll();
    const filtered = credentials.filter(c => c.platform !== platform);
    const deleted = credentials.length - filtered.length;
    await this.saveAll(filtered);
    return deleted;
  }
  
  /**
   * Export credentials (for backup)
   * Returns encrypted format
   */
  async export(): Promise<string> {
    const credentials = await this.loadAll();
    return btoa(JSON.stringify(credentials));
  }
  
  /**
   * Import credentials (from backup)
   */
  async import(data: string, merge: boolean = true): Promise<number> {
    try {
      const imported: StoredCredential[] = JSON.parse(atob(data));
      
      if (merge) {
        const existing = await this.loadAll();
        const merged = [...existing];
        
        for (const cred of imported) {
          const existingIndex = merged.findIndex(
            c => c.domain === cred.domain && c.email === cred.email
          );
          
          if (existingIndex >= 0) {
            // Keep newer one
            if (new Date(cred.lastUsedAt) > new Date(merged[existingIndex].lastUsedAt)) {
              merged[existingIndex] = cred;
            }
          } else {
            merged.push(cred);
          }
        }
        
        await this.saveAll(merged);
        return imported.length;
      } else {
        await this.saveAll(imported);
        return imported.length;
      }
    } catch (error) {
      console.error('[CredentialStore] Import failed:', error);
      throw new Error('Invalid credential backup data');
    }
  }
  
  /**
   * Get statistics
   */
  async getStats(): Promise<{
    total: number;
    byPlatform: Record<string, number>;
    verified: number;
    unverified: number;
  }> {
    const credentials = await this.loadAll();
    
    const byPlatform: Record<string, number> = {};
    let verified = 0;
    let unverified = 0;
    
    for (const cred of credentials) {
      byPlatform[cred.platform] = (byPlatform[cred.platform] || 0) + 1;
      if (cred.verified) {
        verified++;
      } else {
        unverified++;
      }
    }
    
    return {
      total: credentials.length,
      byPlatform,
      verified,
      unverified,
    };
  }
  
  /**
   * Clear cache (force reload from storage)
   */
  clearCache(): void {
    this.cache = null;
  }
}

// Singleton instance
export const credentialStore = new CredentialStoreImpl();

// Helper function to create a credential with auto-generated password
export async function createCredential(
  url: string,
  email: string,
  companyName?: string,
  passwordOptions?: PasswordOptions
): Promise<{ credential: StoredCredential; generatedPassword: string }> {
  const password = generateSecurePassword(passwordOptions);
  const platform = detectPlatform(url);
  const domain = normalizeDomain(url);
  
  const credential = await credentialStore.store({
    platform,
    domain,
    companyName,
    email,
    password,
    verified: false,
    metadata: {
      atsType: platform,
      signupUrl: url,
    },
  });
  
  return {
    credential: { ...credential, password },  // Return with plaintext password
    generatedPassword: password,
  };
}

// Password strength checker
export function checkPasswordStrength(password: string): {
  score: number;  // 0-4
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;
  
  // Length check
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (password.length < 8) feedback.push('Use at least 8 characters');
  
  // Character variety
  if (/[a-z]/.test(password)) score += 0.25;
  else feedback.push('Add lowercase letters');
  
  if (/[A-Z]/.test(password)) score += 0.25;
  else feedback.push('Add uppercase letters');
  
  if (/[0-9]/.test(password)) score += 0.25;
  else feedback.push('Add numbers');
  
  if (/[^a-zA-Z0-9]/.test(password)) score += 0.25;
  else feedback.push('Add special characters');
  
  // Penalize common patterns
  if (/^[a-zA-Z]+$/.test(password)) {
    score -= 0.5;
    feedback.push('Avoid using only letters');
  }
  
  if (/^[0-9]+$/.test(password)) {
    score -= 1;
    feedback.push('Avoid using only numbers');
  }
  
  if (/(.)\1{2,}/.test(password)) {
    score -= 0.5;
    feedback.push('Avoid repeated characters');
  }
  
  return {
    score: Math.max(0, Math.min(4, Math.round(score))),
    feedback,
  };
}
