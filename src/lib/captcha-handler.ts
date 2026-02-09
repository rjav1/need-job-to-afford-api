/**
 * CAPTCHA Handler
 * 
 * Detects and handles CAPTCHAs on job application pages.
 * Supports reCAPTCHA v2/v3, hCaptcha, Cloudflare Turnstile, and custom implementations.
 * 
 * Features:
 * - Automatic CAPTCHA detection
 * - User notification for manual solving
 * - Integration points for solving services (2captcha, anti-captcha)
 * - Session persistence to minimize repeat challenges
 */

import { storage, generateId } from './storage';

// ====================
// Types
// ====================

export type CaptchaType = 
  | 'recaptcha-v2'
  | 'recaptcha-v3' 
  | 'hcaptcha'
  | 'cloudflare-turnstile'
  | 'funcaptcha'
  | 'text-captcha'
  | 'image-captcha'
  | 'unknown';

export type CaptchaSolverService = '2captcha' | 'anti-captcha' | 'capsolver' | 'manual';

export type CaptchaStatus = 
  | 'detected'
  | 'solving'
  | 'solved'
  | 'failed'
  | 'expired'
  | 'waiting-user';

export interface CaptchaInfo {
  id: string;
  type: CaptchaType;
  siteKey?: string;
  pageUrl: string;
  element: HTMLElement | null;
  iframe?: HTMLIFrameElement | null;
  status: CaptchaStatus;
  detectedAt: string;
  solvedAt?: string;
  token?: string;
}

export interface CaptchaSession {
  domain: string;
  cookies: string[];
  solvedAt: string;
  expiresAt: string;
  captchaType: CaptchaType;
}

export interface CaptchaSolverConfig {
  service: CaptchaSolverService;
  apiKey?: string;
  timeout: number;  // ms
  retries: number;
  softId?: string;  // For 2captcha affiliates
}

export interface SolveResult {
  success: boolean;
  token?: string;
  error?: string;
  cost?: number;  // In credits/cents
  solveTime?: number;  // ms
}

export interface CaptchaHandlerConfig {
  enabled: boolean;
  autoSolve: boolean;  // Use solving service automatically
  solver: CaptchaSolverConfig;
  pauseOnDetection: boolean;  // Pause auto-apply when CAPTCHA detected
  notifyUser: boolean;  // Show notification for manual solving
  sessionPersistence: boolean;  // Store solved sessions
  sessionDuration: number;  // How long to trust a session (ms)
}

export const DEFAULT_CAPTCHA_CONFIG: CaptchaHandlerConfig = {
  enabled: true,
  autoSolve: false,
  solver: {
    service: 'manual',
    timeout: 120000,  // 2 minutes
    retries: 3,
  },
  pauseOnDetection: true,
  notifyUser: true,
  sessionPersistence: true,
  sessionDuration: 24 * 60 * 60 * 1000,  // 24 hours
};

// Storage keys
const STORAGE_KEYS = {
  CAPTCHA_CONFIG: 'captchaConfig',
  CAPTCHA_SESSIONS: 'captchaSessions',
  SOLVER_API_KEYS: 'captchaSolverApiKeys',
};

// ====================
// Detection Patterns
// ====================

const CAPTCHA_PATTERNS = {
  // reCAPTCHA v2 (checkbox)
  recaptchaV2: {
    scripts: [
      'google.com/recaptcha/api.js',
      'google.com/recaptcha/enterprise.js',
      'gstatic.com/recaptcha',
    ],
    elements: [
      '.g-recaptcha',
      '[data-sitekey]',
      '#recaptcha',
      'iframe[src*="recaptcha"]',
    ],
    iframes: [
      'google.com/recaptcha/api2/anchor',
      'google.com/recaptcha/api2/bframe',
    ],
  },
  
  // reCAPTCHA v3 (invisible)
  recaptchaV3: {
    scripts: [
      'google.com/recaptcha/api.js?render=',
    ],
    globals: ['grecaptcha'],
    elements: [
      '[data-sitekey][data-size="invisible"]',
    ],
  },
  
  // hCaptcha
  hcaptcha: {
    scripts: [
      'hcaptcha.com/1/api.js',
      'js.hcaptcha.com',
    ],
    elements: [
      '.h-captcha',
      '[data-hcaptcha-widget-id]',
      'iframe[src*="hcaptcha.com"]',
    ],
    iframes: [
      'hcaptcha.com/captcha',
    ],
  },
  
  // Cloudflare Turnstile
  turnstile: {
    scripts: [
      'challenges.cloudflare.com/turnstile',
    ],
    elements: [
      '.cf-turnstile',
      '[data-turnstile-widget-id]',
      'iframe[src*="challenges.cloudflare.com"]',
    ],
    iframes: [
      'challenges.cloudflare.com',
    ],
  },
  
  // FunCaptcha (Arkose Labs)
  funcaptcha: {
    scripts: [
      'funcaptcha.com',
      'arkoselabs.com',
    ],
    elements: [
      '#FunCaptcha',
      '[data-pkey]',
      'iframe[src*="funcaptcha"]',
    ],
  },
};

// ====================
// CAPTCHA Detector
// ====================

class CaptchaDetector {
  private detected: CaptchaInfo[] = [];
  private observer: MutationObserver | null = null;
  
  /**
   * Scan page for CAPTCHAs
   */
  detect(): CaptchaInfo[] {
    this.detected = [];
    
    // Check for each CAPTCHA type
    const recaptchaV2 = this.detectRecaptchaV2();
    const recaptchaV3 = this.detectRecaptchaV3();
    const hcaptcha = this.detectHCaptcha();
    const turnstile = this.detectTurnstile();
    const funcaptcha = this.detectFunCaptcha();
    const textCaptcha = this.detectTextCaptcha();
    
    if (recaptchaV2) this.detected.push(recaptchaV2);
    if (recaptchaV3) this.detected.push(recaptchaV3);
    if (hcaptcha) this.detected.push(hcaptcha);
    if (turnstile) this.detected.push(turnstile);
    if (funcaptcha) this.detected.push(funcaptcha);
    if (textCaptcha) this.detected.push(textCaptcha);
    
    return this.detected;
  }
  
  /**
   * Check if any CAPTCHA is present
   */
  hasCaptcha(): boolean {
    return this.detect().length > 0;
  }
  
  /**
   * Get the primary CAPTCHA (most visible/important)
   */
  getPrimaryCaptcha(): CaptchaInfo | null {
    const detected = this.detect();
    if (detected.length === 0) return null;
    
    // Prioritize visible, interactive CAPTCHAs
    const priority: CaptchaType[] = [
      'recaptcha-v2',
      'hcaptcha',
      'cloudflare-turnstile',
      'funcaptcha',
      'text-captcha',
      'recaptcha-v3',
    ];
    
    for (const type of priority) {
      const captcha = detected.find(c => c.type === type);
      if (captcha) return captcha;
    }
    
    return detected[0];
  }
  
  /**
   * Detect reCAPTCHA v2
   */
  private detectRecaptchaV2(): CaptchaInfo | null {
    // Check for script
    const scripts = Array.from(document.scripts);
    const hasScript = scripts.some(s => 
      CAPTCHA_PATTERNS.recaptchaV2.scripts.some(p => s.src?.includes(p))
    );
    
    // Check for element
    for (const selector of CAPTCHA_PATTERNS.recaptchaV2.elements) {
      const element = document.querySelector(selector);
      if (element) {
        const siteKey = element.getAttribute('data-sitekey') || this.extractSiteKeyFromScript('recaptcha');
        const iframe = document.querySelector('iframe[src*="recaptcha"]') as HTMLIFrameElement | null;
        
        // Make sure it's not v3 (invisible)
        if (element.getAttribute('data-size') === 'invisible') continue;
        
        return {
          id: generateId(),
          type: 'recaptcha-v2',
          siteKey: siteKey || undefined,
          pageUrl: window.location.href,
          element: element as HTMLElement,
          iframe,
          status: 'detected',
          detectedAt: new Date().toISOString(),
        };
      }
    }
    
    // Check iframes
    for (const iframeSrc of CAPTCHA_PATTERNS.recaptchaV2.iframes) {
      const iframe = document.querySelector(`iframe[src*="${iframeSrc}"]`) as HTMLIFrameElement | null;
      if (iframe) {
        return {
          id: generateId(),
          type: 'recaptcha-v2',
          siteKey: this.extractSiteKeyFromIframe(iframe.src),
          pageUrl: window.location.href,
          element: iframe,
          iframe,
          status: 'detected',
          detectedAt: new Date().toISOString(),
        };
      }
    }
    
    return null;
  }
  
  /**
   * Detect reCAPTCHA v3 (invisible)
   */
  private detectRecaptchaV3(): CaptchaInfo | null {
    // Check for v3 script pattern
    const scripts = Array.from(document.scripts);
    const v3Script = scripts.find(s => 
      s.src?.includes('recaptcha/api.js?render=') || s.src?.includes('recaptcha/enterprise.js')
    );
    
    if (v3Script) {
      const siteKey = this.extractSiteKeyFromScript('recaptcha', v3Script.src);
      
      // Also check for invisible data attribute
      const invisibleElement = document.querySelector('[data-sitekey][data-size="invisible"]');
      
      return {
        id: generateId(),
        type: 'recaptcha-v3',
        siteKey: siteKey || undefined,
        pageUrl: window.location.href,
        element: invisibleElement as HTMLElement || null,
        status: 'detected',
        detectedAt: new Date().toISOString(),
      };
    }
    
    // Check for grecaptcha global with v3 execute method
    if ((window as any).grecaptcha?.execute) {
      return {
        id: generateId(),
        type: 'recaptcha-v3',
        pageUrl: window.location.href,
        element: null,
        status: 'detected',
        detectedAt: new Date().toISOString(),
      };
    }
    
    return null;
  }
  
  /**
   * Detect hCaptcha
   */
  private detectHCaptcha(): CaptchaInfo | null {
    // Check for script
    const scripts = Array.from(document.scripts);
    const hasScript = scripts.some(s =>
      CAPTCHA_PATTERNS.hcaptcha.scripts.some(p => s.src?.includes(p))
    );
    
    // Check for elements
    for (const selector of CAPTCHA_PATTERNS.hcaptcha.elements) {
      const element = document.querySelector(selector);
      if (element) {
        const siteKey = element.getAttribute('data-sitekey');
        const iframe = document.querySelector('iframe[src*="hcaptcha.com"]') as HTMLIFrameElement | null;
        
        return {
          id: generateId(),
          type: 'hcaptcha',
          siteKey: siteKey || undefined,
          pageUrl: window.location.href,
          element: element as HTMLElement,
          iframe,
          status: 'detected',
          detectedAt: new Date().toISOString(),
        };
      }
    }
    
    return null;
  }
  
  /**
   * Detect Cloudflare Turnstile
   */
  private detectTurnstile(): CaptchaInfo | null {
    // Check for script
    const scripts = Array.from(document.scripts);
    const hasScript = scripts.some(s =>
      CAPTCHA_PATTERNS.turnstile.scripts.some(p => s.src?.includes(p))
    );
    
    // Check for elements
    for (const selector of CAPTCHA_PATTERNS.turnstile.elements) {
      const element = document.querySelector(selector);
      if (element) {
        const siteKey = element.getAttribute('data-sitekey');
        const iframe = document.querySelector('iframe[src*="challenges.cloudflare.com"]') as HTMLIFrameElement | null;
        
        return {
          id: generateId(),
          type: 'cloudflare-turnstile',
          siteKey: siteKey || undefined,
          pageUrl: window.location.href,
          element: element as HTMLElement,
          iframe,
          status: 'detected',
          detectedAt: new Date().toISOString(),
        };
      }
    }
    
    return null;
  }
  
  /**
   * Detect FunCaptcha (Arkose Labs)
   */
  private detectFunCaptcha(): CaptchaInfo | null {
    for (const selector of CAPTCHA_PATTERNS.funcaptcha.elements) {
      const element = document.querySelector(selector);
      if (element) {
        const publicKey = element.getAttribute('data-pkey');
        
        return {
          id: generateId(),
          type: 'funcaptcha',
          siteKey: publicKey || undefined,
          pageUrl: window.location.href,
          element: element as HTMLElement,
          status: 'detected',
          detectedAt: new Date().toISOString(),
        };
      }
    }
    
    return null;
  }
  
  /**
   * Detect text/image CAPTCHAs (generic patterns)
   */
  private detectTextCaptcha(): CaptchaInfo | null {
    // Look for common text CAPTCHA patterns
    const patterns = [
      'input[name*="captcha" i]',
      'input[id*="captcha" i]',
      'img[src*="captcha" i]',
      'img[alt*="captcha" i]',
      '.captcha-image',
      '#captcha-image',
    ];
    
    for (const selector of patterns) {
      const element = document.querySelector(selector);
      if (element) {
        // Make sure it's not part of a known CAPTCHA system
        const isKnown = this.detected.some(c => 
          c.element?.contains(element) || element.contains(c.element!)
        );
        
        if (!isKnown) {
          const isImage = element.tagName === 'IMG';
          return {
            id: generateId(),
            type: isImage ? 'image-captcha' : 'text-captcha',
            pageUrl: window.location.href,
            element: element as HTMLElement,
            status: 'detected',
            detectedAt: new Date().toISOString(),
          };
        }
      }
    }
    
    return null;
  }
  
  /**
   * Extract siteKey from script URL or inline script
   */
  private extractSiteKeyFromScript(type: 'recaptcha' | 'hcaptcha', src?: string): string | null {
    if (src?.includes('render=')) {
      const match = src.match(/render=([^&]+)/);
      if (match) return match[1];
    }
    
    // Try to find in inline scripts
    const scripts = Array.from(document.scripts);
    for (const script of scripts) {
      if (script.textContent) {
        // Common patterns for siteKey in code
        const patterns = [
          /sitekey['":\s]+['"]([^'"]+)['"]/i,
          /data-sitekey['":\s]+['"]([^'"]+)['"]/i,
          /grecaptcha\.execute\(['"]([^'"]+)['"]/i,
          /hcaptcha\.execute\(['"]([^'"]+)['"]/i,
        ];
        
        for (const pattern of patterns) {
          const match = script.textContent.match(pattern);
          if (match) return match[1];
        }
      }
    }
    
    return null;
  }
  
  /**
   * Extract siteKey from iframe URL
   */
  private extractSiteKeyFromIframe(src: string): string | null {
    const match = src.match(/[?&]k=([^&]+)/);
    return match ? match[1] : null;
  }
  
  /**
   * Watch for dynamically loaded CAPTCHAs
   */
  startWatching(callback: (captcha: CaptchaInfo) => void): void {
    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          const detected = this.detect();
          for (const captcha of detected) {
            if (!this.detected.find(c => c.type === captcha.type)) {
              callback(captcha);
            }
          }
        }
      }
    });
    
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }
  
  /**
   * Stop watching for CAPTCHAs
   */
  stopWatching(): void {
    this.observer?.disconnect();
    this.observer = null;
  }
}

// ====================
// Session Manager
// ====================

class CaptchaSessionManager {
  private sessions: Map<string, CaptchaSession> = new Map();
  
  async load(): Promise<void> {
    const stored = await storage.get<Record<string, CaptchaSession>>(STORAGE_KEYS.CAPTCHA_SESSIONS);
    if (stored) {
      this.sessions = new Map(Object.entries(stored));
      // Clean expired sessions
      this.cleanExpired();
    }
  }
  
  async save(): Promise<void> {
    const data = Object.fromEntries(this.sessions);
    await storage.set(STORAGE_KEYS.CAPTCHA_SESSIONS, data);
  }
  
  /**
   * Check if domain has a valid solved session
   */
  hasValidSession(domain: string): boolean {
    const session = this.sessions.get(domain);
    if (!session) return false;
    
    const now = Date.now();
    const expires = new Date(session.expiresAt).getTime();
    return now < expires;
  }
  
  /**
   * Get session for domain
   */
  getSession(domain: string): CaptchaSession | null {
    if (this.hasValidSession(domain)) {
      return this.sessions.get(domain) || null;
    }
    return null;
  }
  
  /**
   * Store solved session
   */
  async storeSession(
    domain: string,
    captchaType: CaptchaType,
    durationMs: number = 24 * 60 * 60 * 1000
  ): Promise<void> {
    const now = new Date();
    const session: CaptchaSession = {
      domain,
      cookies: this.getCurrentCookies(),
      solvedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + durationMs).toISOString(),
      captchaType,
    };
    
    this.sessions.set(domain, session);
    await this.save();
  }
  
  /**
   * Clear session for domain
   */
  async clearSession(domain: string): Promise<void> {
    this.sessions.delete(domain);
    await this.save();
  }
  
  /**
   * Clean expired sessions
   */
  private cleanExpired(): void {
    const now = Date.now();
    for (const [domain, session] of this.sessions) {
      if (new Date(session.expiresAt).getTime() < now) {
        this.sessions.delete(domain);
      }
    }
  }
  
  /**
   * Get current cookies (for session persistence)
   */
  private getCurrentCookies(): string[] {
    return document.cookie.split(';').map(c => c.trim());
  }
}

// ====================
// Solver Integration
// ====================

/**
 * Abstract base class for CAPTCHA solvers
 */
abstract class CaptchaSolver {
  protected apiKey: string;
  protected timeout: number;
  
  constructor(apiKey: string, timeout: number = 120000) {
    this.apiKey = apiKey;
    this.timeout = timeout;
  }
  
  abstract solve(captcha: CaptchaInfo): Promise<SolveResult>;
  abstract getBalance(): Promise<number>;
}

/**
 * 2captcha.com solver implementation
 */
class TwoCaptchaSolver extends CaptchaSolver {
  private baseUrl = 'https://2captcha.com';
  
  async solve(captcha: CaptchaInfo): Promise<SolveResult> {
    const startTime = Date.now();
    
    try {
      // Create task based on CAPTCHA type
      const taskId = await this.createTask(captcha);
      if (!taskId) {
        return { success: false, error: 'Failed to create task' };
      }
      
      // Poll for result
      const token = await this.pollResult(taskId);
      if (!token) {
        return { success: false, error: 'Solve timeout' };
      }
      
      return {
        success: true,
        token,
        solveTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  private async createTask(captcha: CaptchaInfo): Promise<string | null> {
    let method: string;
    let params: Record<string, string> = {
      key: this.apiKey,
      pageurl: captcha.pageUrl,
      json: '1',
    };
    
    switch (captcha.type) {
      case 'recaptcha-v2':
        method = 'userrecaptcha';
        params.googlekey = captcha.siteKey || '';
        break;
      case 'recaptcha-v3':
        method = 'userrecaptcha';
        params.googlekey = captcha.siteKey || '';
        params.version = 'v3';
        params.action = 'submit';  // Common action
        params.min_score = '0.3';
        break;
      case 'hcaptcha':
        method = 'hcaptcha';
        params.sitekey = captcha.siteKey || '';
        break;
      case 'cloudflare-turnstile':
        method = 'turnstile';
        params.sitekey = captcha.siteKey || '';
        break;
      default:
        return null;
    }
    
    params.method = method;
    
    const url = `${this.baseUrl}/in.php?${new URLSearchParams(params)}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 1) {
      return data.request;
    }
    
    console.error('2captcha task creation failed:', data);
    return null;
  }
  
  private async pollResult(taskId: string): Promise<string | null> {
    const startTime = Date.now();
    const pollInterval = 5000;  // 5 seconds
    
    while (Date.now() - startTime < this.timeout) {
      await this.sleep(pollInterval);
      
      const url = `${this.baseUrl}/res.php?key=${this.apiKey}&action=get&id=${taskId}&json=1`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 1) {
        return data.request;  // This is the token
      }
      
      if (data.request !== 'CAPCHA_NOT_READY') {
        console.error('2captcha error:', data.request);
        return null;
      }
    }
    
    return null;
  }
  
  async getBalance(): Promise<number> {
    const url = `${this.baseUrl}/res.php?key=${this.apiKey}&action=getbalance&json=1`;
    const response = await fetch(url);
    const data = await response.json();
    return parseFloat(data.request) || 0;
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Anti-captcha.com solver implementation
 */
class AntiCaptchaSolver extends CaptchaSolver {
  private baseUrl = 'https://api.anti-captcha.com';
  
  async solve(captcha: CaptchaInfo): Promise<SolveResult> {
    const startTime = Date.now();
    
    try {
      const taskId = await this.createTask(captcha);
      if (!taskId) {
        return { success: false, error: 'Failed to create task' };
      }
      
      const result = await this.pollResult(taskId);
      if (!result) {
        return { success: false, error: 'Solve timeout' };
      }
      
      return {
        success: true,
        token: result.token,
        cost: result.cost,
        solveTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  private async createTask(captcha: CaptchaInfo): Promise<number | null> {
    let task: Record<string, any>;
    
    switch (captcha.type) {
      case 'recaptcha-v2':
        task = {
          type: 'RecaptchaV2TaskProxyless',
          websiteURL: captcha.pageUrl,
          websiteKey: captcha.siteKey,
        };
        break;
      case 'recaptcha-v3':
        task = {
          type: 'RecaptchaV3TaskProxyless',
          websiteURL: captcha.pageUrl,
          websiteKey: captcha.siteKey,
          minScore: 0.3,
          pageAction: 'submit',
        };
        break;
      case 'hcaptcha':
        task = {
          type: 'HCaptchaTaskProxyless',
          websiteURL: captcha.pageUrl,
          websiteKey: captcha.siteKey,
        };
        break;
      case 'cloudflare-turnstile':
        task = {
          type: 'TurnstileTaskProxyless',
          websiteURL: captcha.pageUrl,
          websiteKey: captcha.siteKey,
        };
        break;
      default:
        return null;
    }
    
    const response = await fetch(`${this.baseUrl}/createTask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientKey: this.apiKey,
        task,
      }),
    });
    
    const data = await response.json();
    
    if (data.errorId === 0) {
      return data.taskId;
    }
    
    console.error('Anti-captcha task creation failed:', data);
    return null;
  }
  
  private async pollResult(taskId: number): Promise<{ token: string; cost: number } | null> {
    const startTime = Date.now();
    const pollInterval = 5000;
    
    while (Date.now() - startTime < this.timeout) {
      await this.sleep(pollInterval);
      
      const response = await fetch(`${this.baseUrl}/getTaskResult`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientKey: this.apiKey,
          taskId,
        }),
      });
      
      const data = await response.json();
      
      if (data.status === 'ready') {
        return {
          token: data.solution.gRecaptchaResponse || data.solution.token,
          cost: data.cost,
        };
      }
      
      if (data.errorId !== 0) {
        console.error('Anti-captcha error:', data);
        return null;
      }
    }
    
    return null;
  }
  
  async getBalance(): Promise<number> {
    const response = await fetch(`${this.baseUrl}/getBalance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientKey: this.apiKey }),
    });
    
    const data = await response.json();
    return data.balance || 0;
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ====================
// Main Handler
// ====================

export class CaptchaHandler {
  private config: CaptchaHandlerConfig;
  private detector: CaptchaDetector;
  private sessionManager: CaptchaSessionManager;
  private solver: CaptchaSolver | null = null;
  private eventCallbacks: ((event: CaptchaEvent) => void)[] = [];
  
  constructor(config: Partial<CaptchaHandlerConfig> = {}) {
    this.config = { ...DEFAULT_CAPTCHA_CONFIG, ...config };
    this.detector = new CaptchaDetector();
    this.sessionManager = new CaptchaSessionManager();
  }
  
  /**
   * Initialize the handler
   */
  async initialize(): Promise<void> {
    // Load config from storage
    const storedConfig = await storage.get<CaptchaHandlerConfig>(STORAGE_KEYS.CAPTCHA_CONFIG);
    if (storedConfig) {
      this.config = { ...this.config, ...storedConfig };
    }
    
    // Load sessions
    await this.sessionManager.load();
    
    // Initialize solver if configured
    if (this.config.autoSolve && this.config.solver.apiKey) {
      this.initializeSolver();
    }
  }
  
  /**
   * Initialize the appropriate solver
   */
  private initializeSolver(): void {
    const { service, apiKey, timeout } = this.config.solver;
    
    if (!apiKey) return;
    
    switch (service) {
      case '2captcha':
        this.solver = new TwoCaptchaSolver(apiKey, timeout);
        break;
      case 'anti-captcha':
        this.solver = new AntiCaptchaSolver(apiKey, timeout);
        break;
      // Add more solvers as needed
    }
  }
  
  /**
   * Check for CAPTCHA on current page
   */
  detect(): CaptchaInfo | null {
    return this.detector.getPrimaryCaptcha();
  }
  
  /**
   * Check if page has any CAPTCHA
   */
  hasCaptcha(): boolean {
    return this.detector.hasCaptcha();
  }
  
  /**
   * Check if domain has valid solved session
   */
  hasValidSession(): boolean {
    const domain = window.location.hostname;
    return this.sessionManager.hasValidSession(domain);
  }
  
  /**
   * Handle CAPTCHA - main entry point
   * Returns true if CAPTCHA was handled successfully
   */
  async handle(): Promise<boolean> {
    const captcha = this.detect();
    
    if (!captcha) {
      return true;  // No CAPTCHA, continue
    }
    
    // Check for valid session
    if (this.hasValidSession()) {
      console.log('[CaptchaHandler] Valid session exists, skipping CAPTCHA');
      return true;
    }
    
    // Emit detection event
    this.emit({
      type: 'detected',
      captcha,
    });
    
    // Try auto-solve if configured
    if (this.config.autoSolve && this.solver) {
      return this.autoSolve(captcha);
    }
    
    // Otherwise, wait for manual solve
    if (this.config.pauseOnDetection) {
      return this.waitForManualSolve(captcha);
    }
    
    return false;
  }
  
  /**
   * Auto-solve using configured service
   */
  private async autoSolve(captcha: CaptchaInfo): Promise<boolean> {
    if (!this.solver) return false;
    
    this.emit({
      type: 'solving',
      captcha,
    });
    
    const result = await this.solver.solve(captcha);
    
    if (result.success && result.token) {
      // Inject the token
      const injected = await this.injectToken(captcha, result.token);
      
      if (injected) {
        // Store session for future visits
        if (this.config.sessionPersistence) {
          await this.sessionManager.storeSession(
            window.location.hostname,
            captcha.type,
            this.config.sessionDuration
          );
        }
        
        this.emit({
          type: 'solved',
          captcha,
          token: result.token,
          solveTime: result.solveTime,
        });
        
        return true;
      }
    }
    
    this.emit({
      type: 'failed',
      captcha,
      error: result.error,
    });
    
    return false;
  }
  
  /**
   * Wait for user to manually solve CAPTCHA
   */
  private async waitForManualSolve(captcha: CaptchaInfo): Promise<boolean> {
    // Notify user
    if (this.config.notifyUser) {
      this.emit({
        type: 'waiting-user',
        captcha,
        message: `CAPTCHA detected (${captcha.type}). Please solve it manually.`,
      });
      
      // Show notification if possible
      this.showNotification(captcha);
    }
    
    // Wait for CAPTCHA to be solved
    return new Promise((resolve) => {
      const checkInterval = 1000;  // 1 second
      const maxWait = 5 * 60 * 1000;  // 5 minutes
      const startTime = Date.now();
      
      const checker = setInterval(async () => {
        // Check if solved (token present in response field)
        const solved = this.checkIfSolved(captcha);
        
        if (solved) {
          clearInterval(checker);
          
          // Store session
          if (this.config.sessionPersistence) {
            await this.sessionManager.storeSession(
              window.location.hostname,
              captcha.type,
              this.config.sessionDuration
            );
          }
          
          this.emit({
            type: 'solved',
            captcha,
          });
          
          resolve(true);
          return;
        }
        
        // Timeout
        if (Date.now() - startTime > maxWait) {
          clearInterval(checker);
          
          this.emit({
            type: 'timeout',
            captcha,
          });
          
          resolve(false);
        }
      }, checkInterval);
    });
  }
  
  /**
   * Check if CAPTCHA has been solved
   */
  private checkIfSolved(captcha: CaptchaInfo): boolean {
    switch (captcha.type) {
      case 'recaptcha-v2':
      case 'recaptcha-v3':
        // Check for response token
        const recaptchaResponse = document.querySelector('#g-recaptcha-response, [name="g-recaptcha-response"]') as HTMLTextAreaElement;
        if (recaptchaResponse?.value) return true;
        
        // Check grecaptcha object
        if ((window as any).grecaptcha?.getResponse?.()) return true;
        break;
        
      case 'hcaptcha':
        const hcaptchaResponse = document.querySelector('[name="h-captcha-response"]') as HTMLTextAreaElement;
        if (hcaptchaResponse?.value) return true;
        
        // Check hcaptcha object
        if ((window as any).hcaptcha?.getResponse?.()) return true;
        break;
        
      case 'cloudflare-turnstile':
        const turnstileResponse = document.querySelector('[name="cf-turnstile-response"]') as HTMLInputElement;
        if (turnstileResponse?.value) return true;
        
        // Check for turnstile success class
        const turnstileWidget = document.querySelector('.cf-turnstile');
        if (turnstileWidget?.querySelector('[data-success="true"]')) return true;
        break;
    }
    
    // Check if CAPTCHA element is hidden/removed (common after solve)
    if (captcha.element) {
      const style = window.getComputedStyle(captcha.element);
      if (style.display === 'none' || style.visibility === 'hidden') {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Inject solved token into page
   */
  private async injectToken(captcha: CaptchaInfo, token: string): Promise<boolean> {
    try {
      switch (captcha.type) {
        case 'recaptcha-v2':
        case 'recaptcha-v3':
          // Find response textarea
          let responseField = document.querySelector('#g-recaptcha-response, [name="g-recaptcha-response"]') as HTMLTextAreaElement;
          
          if (!responseField) {
            // Create if doesn't exist
            responseField = document.createElement('textarea');
            responseField.name = 'g-recaptcha-response';
            responseField.id = 'g-recaptcha-response';
            responseField.style.display = 'none';
            captcha.element?.appendChild(responseField) || document.body.appendChild(responseField);
          }
          
          responseField.value = token;
          
          // Trigger callback if available
          if ((window as any).___grecaptcha_cfg?.clients) {
            const clients = (window as any).___grecaptcha_cfg.clients;
            for (const clientId in clients) {
              const client = clients[clientId];
              if (client?.callback) {
                client.callback(token);
              }
            }
          }
          break;
          
        case 'hcaptcha':
          let hcaptchaField = document.querySelector('[name="h-captcha-response"]') as HTMLTextAreaElement;
          
          if (!hcaptchaField) {
            hcaptchaField = document.createElement('textarea');
            hcaptchaField.name = 'h-captcha-response';
            hcaptchaField.style.display = 'none';
            captcha.element?.appendChild(hcaptchaField) || document.body.appendChild(hcaptchaField);
          }
          
          hcaptchaField.value = token;
          break;
          
        case 'cloudflare-turnstile':
          let turnstileField = document.querySelector('[name="cf-turnstile-response"]') as HTMLInputElement;
          
          if (!turnstileField) {
            turnstileField = document.createElement('input');
            turnstileField.type = 'hidden';
            turnstileField.name = 'cf-turnstile-response';
            captcha.element?.appendChild(turnstileField) || document.body.appendChild(turnstileField);
          }
          
          turnstileField.value = token;
          break;
          
        default:
          console.warn('[CaptchaHandler] Token injection not supported for:', captcha.type);
          return false;
      }
      
      return true;
    } catch (error) {
      console.error('[CaptchaHandler] Failed to inject token:', error);
      return false;
    }
  }
  
  /**
   * Show notification to user
   */
  private showNotification(captcha: CaptchaInfo): void {
    // Try browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('CAPTCHA Detected', {
        body: `Please solve the ${captcha.type} on ${window.location.hostname}`,
        icon: '/icons/icon48.png',
      });
    }
    
    // Also create in-page notification
    this.createInPageNotification(captcha);
  }
  
  /**
   * Create in-page notification element
   */
  private createInPageNotification(captcha: CaptchaInfo): void {
    const existing = document.getElementById('captcha-handler-notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.id = 'captcha-handler-notification';
    notification.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        max-width: 350px;
        animation: slideIn 0.3s ease-out;
      ">
        <style>
          @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
        </style>
        <div style="display: flex; align-items: center; gap: 12px;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
          <div>
            <div style="font-weight: 600; margin-bottom: 4px;">CAPTCHA Detected</div>
            <div style="font-size: 13px; opacity: 0.9;">
              ${captcha.type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </div>
            <div style="font-size: 12px; opacity: 0.8; margin-top: 4px;">
              Please solve it to continue
            </div>
          </div>
          <button onclick="this.parentElement.parentElement.parentElement.remove()" style="
            background: none;
            border: none;
            color: white;
            cursor: pointer;
            opacity: 0.8;
            padding: 4px;
          ">✕</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 10 seconds
    setTimeout(() => notification.remove(), 10000);
  }
  
  /**
   * Subscribe to events
   */
  on(callback: (event: CaptchaEvent) => void): () => void {
    this.eventCallbacks.push(callback);
    return () => {
      const idx = this.eventCallbacks.indexOf(callback);
      if (idx >= 0) this.eventCallbacks.splice(idx, 1);
    };
  }
  
  /**
   * Emit event
   */
  private emit(event: CaptchaEvent): void {
    for (const callback of this.eventCallbacks) {
      try {
        callback(event);
      } catch (e) {
        console.error('[CaptchaHandler] Event callback error:', e);
      }
    }
  }
  
  /**
   * Configure solver API key
   */
  async setSolverApiKey(service: CaptchaSolverService, apiKey: string): Promise<void> {
    this.config.solver.service = service;
    this.config.solver.apiKey = apiKey;
    this.initializeSolver();
    
    // Persist
    const keys = await storage.get<Record<string, string>>(STORAGE_KEYS.SOLVER_API_KEYS) || {};
    keys[service] = apiKey;
    await storage.set(STORAGE_KEYS.SOLVER_API_KEYS, keys);
    await storage.set(STORAGE_KEYS.CAPTCHA_CONFIG, this.config);
  }
  
  /**
   * Get solver balance
   */
  async getSolverBalance(): Promise<number> {
    if (!this.solver) return 0;
    return this.solver.getBalance();
  }
  
  /**
   * Update configuration
   */
  async updateConfig(config: Partial<CaptchaHandlerConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    await storage.set(STORAGE_KEYS.CAPTCHA_CONFIG, this.config);
    
    if (config.solver?.apiKey || config.solver?.service) {
      this.initializeSolver();
    }
  }
  
  /**
   * Get current configuration
   */
  getConfig(): CaptchaHandlerConfig {
    return { ...this.config };
  }
  
  /**
   * Clear all stored sessions
   */
  async clearSessions(): Promise<void> {
    await storage.set(STORAGE_KEYS.CAPTCHA_SESSIONS, {});
    await this.sessionManager.load();
  }
  
  /**
   * Start watching for dynamically loaded CAPTCHAs
   */
  startWatching(callback: (captcha: CaptchaInfo) => void): void {
    this.detector.startWatching(callback);
  }
  
  /**
   * Stop watching
   */
  stopWatching(): void {
    this.detector.stopWatching();
  }
}

// ====================
// Event Types
// ====================

export interface CaptchaEvent {
  type: 'detected' | 'solving' | 'solved' | 'failed' | 'waiting-user' | 'timeout';
  captcha: CaptchaInfo;
  message?: string;
  token?: string;
  error?: string;
  solveTime?: number;
}

// ====================
// Singleton Instance
// ====================

let captchaHandlerInstance: CaptchaHandler | null = null;

export function getCaptchaHandler(): CaptchaHandler {
  if (!captchaHandlerInstance) {
    captchaHandlerInstance = new CaptchaHandler();
  }
  return captchaHandlerInstance;
}

export async function initializeCaptchaHandler(config?: Partial<CaptchaHandlerConfig>): Promise<CaptchaHandler> {
  captchaHandlerInstance = new CaptchaHandler(config);
  await captchaHandlerInstance.initialize();
  return captchaHandlerInstance;
}

// ====================
// Utility Functions
// ====================

/**
 * Quick check if current page has CAPTCHA
 */
export function pageHasCaptcha(): boolean {
  const handler = getCaptchaHandler();
  return handler.hasCaptcha();
}

/**
 * Handle CAPTCHA on current page
 */
export async function handlePageCaptcha(): Promise<boolean> {
  const handler = getCaptchaHandler();
  await handler.initialize();
  return handler.handle();
}

/**
 * Check if domain has valid session (no CAPTCHA needed)
 */
export function hasValidCaptchaSession(): boolean {
  const handler = getCaptchaHandler();
  return handler.hasValidSession();
}
