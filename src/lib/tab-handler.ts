/**
 * Multi-Tab Handler
 * 
 * Manages tab switching, OAuth popup handling, and multi-tab workflows.
 * Detects when job sites open new tabs (LinkedIn auth, external forms)
 * and handles them gracefully.
 */

// ========================================
// Types
// ========================================

export interface TabInfo {
  id: number;
  windowId: number;
  url: string;
  title: string;
  active: boolean;
  status: 'loading' | 'complete';
  openerTabId?: number;
  createdAt: number;
}

export interface TabSession {
  id: string;
  originTab: TabInfo;
  childTabs: TabInfo[];
  purpose: TabPurpose;
  state: TabSessionState;
  startedAt: number;
  completedAt?: number;
  timeout: number;
  autoClose: boolean;
}

export type TabPurpose = 
  | 'oauth'           // OAuth login flow (LinkedIn, Google, etc.)
  | 'external-form'   // External form (separate ATS page)
  | 'document-upload' // Document upload/preview
  | 'verification'    // Email/phone verification
  | 'unknown';

export type TabSessionState = 
  | 'active'          // Session in progress
  | 'waiting'         // Waiting for user action in popup
  | 'completed'       // Successfully completed
  | 'failed'          // Failed or timed out
  | 'cancelled';      // User cancelled

export interface OAuthProvider {
  name: string;
  urlPatterns: RegExp[];
  successPatterns: RegExp[];
  failurePatterns: RegExp[];
  timeout: number;
}

export interface TabHandlerConfig {
  defaultTimeout: number;          // Default timeout for tab sessions (ms)
  oauthTimeout: number;            // OAuth-specific timeout (ms)
  pollInterval: number;            // How often to check tab status (ms)
  autoCloseOnSuccess: boolean;     // Auto-close child tabs on success
  returnToOrigin: boolean;         // Return to origin tab on completion
  maxChildTabs: number;            // Max child tabs before warning
}

export interface TabEvent {
  type: TabEventType;
  session: TabSession;
  tab?: TabInfo;
  data?: any;
}

export type TabEventType = 
  | 'session-started'
  | 'tab-opened'
  | 'tab-closed'
  | 'tab-navigated'
  | 'oauth-detected'
  | 'oauth-success'
  | 'oauth-failed'
  | 'session-completed'
  | 'session-failed'
  | 'session-timeout';

type TabEventCallback = (event: TabEvent) => void;

// ========================================
// OAuth Provider Definitions
// ========================================

const OAUTH_PROVIDERS: OAuthProvider[] = [
  {
    name: 'LinkedIn',
    urlPatterns: [
      /linkedin\.com\/oauth/i,
      /linkedin\.com\/uas\/login/i,
      /linkedin\.com\/checkpoint/i,
      /linkedin\.com\/authwall/i,
    ],
    successPatterns: [
      /linkedin\.com\/feed/i,
      /linkedin\.com\/in\//i,
      /callback.*code=/i,
      /\?oauth_token=/i,
    ],
    failurePatterns: [
      /linkedin\.com\/uas\/login.*error/i,
      /access_denied/i,
    ],
    timeout: 120000, // 2 minutes
  },
  {
    name: 'Google',
    urlPatterns: [
      /accounts\.google\.com\/o\/oauth/i,
      /accounts\.google\.com\/signin/i,
      /accounts\.google\.com\/ServiceLogin/i,
    ],
    successPatterns: [
      /callback.*code=/i,
      /oauth2callback/i,
      /\?state=.*&code=/i,
    ],
    failurePatterns: [
      /error=access_denied/i,
      /error=consent_required/i,
    ],
    timeout: 120000,
  },
  {
    name: 'Microsoft',
    urlPatterns: [
      /login\.microsoftonline\.com/i,
      /login\.live\.com/i,
      /microsoft\.com\/oauth/i,
    ],
    successPatterns: [
      /callback.*code=/i,
      /\?code=.*&state=/i,
    ],
    failurePatterns: [
      /error=access_denied/i,
      /error_description=/i,
    ],
    timeout: 120000,
  },
  {
    name: 'GitHub',
    urlPatterns: [
      /github\.com\/login\/oauth/i,
      /github\.com\/login\?/i,
      /github\.com\/sessions/i,
    ],
    successPatterns: [
      /callback.*code=/i,
      /github\.com\/settings/i,
    ],
    failurePatterns: [
      /error=access_denied/i,
    ],
    timeout: 120000,
  },
  {
    name: 'Indeed',
    urlPatterns: [
      /secure\.indeed\.com\/auth/i,
      /indeed\.com\/account\/login/i,
    ],
    successPatterns: [
      /indeed\.com\/jobs/i,
      /indeed\.com\/viewjob/i,
    ],
    failurePatterns: [
      /login.*error/i,
    ],
    timeout: 120000,
  },
];

// ATS patterns that may open new tabs
const ATS_PATTERNS: { name: string; patterns: RegExp[] }[] = [
  { name: 'Greenhouse', patterns: [/boards\.greenhouse\.io/i, /greenhouse\.io\/embed/i] },
  { name: 'Lever', patterns: [/jobs\.lever\.co/i] },
  { name: 'Workday', patterns: [/myworkdayjobs\.com/i, /workday\.com/i] },
  { name: 'iCIMS', patterns: [/icims\.com/i, /careers-.*\.icims\.com/i] },
  { name: 'Taleo', patterns: [/taleo\.net/i] },
  { name: 'BrassRing', patterns: [/brassring\.com/i] },
  { name: 'SmartRecruiters', patterns: [/smartrecruiters\.com/i, /jobs\.smartrecruiters\.com/i] },
  { name: 'Ashby', patterns: [/jobs\.ashbyhq\.com/i, /ashbyhq\.com/i] },
];

// ========================================
// Default Configuration
// ========================================

const DEFAULT_CONFIG: TabHandlerConfig = {
  defaultTimeout: 300000,      // 5 minutes
  oauthTimeout: 120000,        // 2 minutes
  pollInterval: 500,           // 500ms
  autoCloseOnSuccess: true,
  returnToOrigin: true,
  maxChildTabs: 5,
};

// ========================================
// Tab Handler Class
// ========================================

export class TabHandler {
  private config: TabHandlerConfig;
  private sessions: Map<string, TabSession> = new Map();
  private tabToSession: Map<number, string> = new Map();
  private eventCallbacks: TabEventCallback[] = [];
  private isListening: boolean = false;
  private pollIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: Partial<TabHandlerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ----------------------------------------
  // Lifecycle
  // ----------------------------------------

  /**
   * Start listening for tab events
   */
  startListening(): void {
    if (this.isListening) return;
    this.isListening = true;

    // Listen for new tabs being created
    chrome.tabs.onCreated.addListener(this.handleTabCreated);
    
    // Listen for tab updates (navigation, load state)
    chrome.tabs.onUpdated.addListener(this.handleTabUpdated);
    
    // Listen for tabs being closed
    chrome.tabs.onRemoved.addListener(this.handleTabRemoved);
    
    // Listen for tab activation
    chrome.tabs.onActivated.addListener(this.handleTabActivated);

    console.log('[TabHandler] Started listening for tab events');
  }

  /**
   * Stop listening for tab events
   */
  stopListening(): void {
    if (!this.isListening) return;
    this.isListening = false;

    chrome.tabs.onCreated.removeListener(this.handleTabCreated);
    chrome.tabs.onUpdated.removeListener(this.handleTabUpdated);
    chrome.tabs.onRemoved.removeListener(this.handleTabRemoved);
    chrome.tabs.onActivated.removeListener(this.handleTabActivated);

    // Clear all poll intervals
    this.pollIntervals.forEach(interval => clearInterval(interval));
    this.pollIntervals.clear();

    console.log('[TabHandler] Stopped listening for tab events');
  }

  /**
   * Register event callback
   */
  onEvent(callback: TabEventCallback): () => void {
    this.eventCallbacks.push(callback);
    return () => {
      this.eventCallbacks = this.eventCallbacks.filter(cb => cb !== callback);
    };
  }

  // ----------------------------------------
  // Session Management
  // ----------------------------------------

  /**
   * Start a new tab session for tracking child tabs
   * Call this before an action that might open new tabs (e.g., clicking "Sign in with LinkedIn")
   */
  async startSession(originTabId: number, purpose: TabPurpose = 'unknown'): Promise<TabSession> {
    const originTab = await this.getTabInfo(originTabId);
    
    if (!originTab) {
      throw new Error(`Origin tab ${originTabId} not found`);
    }

    const session: TabSession = {
      id: this.generateSessionId(),
      originTab,
      childTabs: [],
      purpose,
      state: 'active',
      startedAt: Date.now(),
      timeout: purpose === 'oauth' ? this.config.oauthTimeout : this.config.defaultTimeout,
      autoClose: this.config.autoCloseOnSuccess,
    };

    this.sessions.set(session.id, session);
    this.tabToSession.set(originTabId, session.id);

    // Start timeout monitoring
    this.startSessionTimeout(session);

    this.emitEvent({ type: 'session-started', session });

    console.log(`[TabHandler] Started session ${session.id} for tab ${originTabId} (${purpose})`);
    return session;
  }

  /**
   * Get active session for a tab (either as origin or child)
   */
  getSessionForTab(tabId: number): TabSession | undefined {
    const sessionId = this.tabToSession.get(tabId);
    if (sessionId) {
      return this.sessions.get(sessionId);
    }
    return undefined;
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): TabSession[] {
    return Array.from(this.sessions.values()).filter(s => s.state === 'active' || s.state === 'waiting');
  }

  /**
   * Complete a session (success)
   */
  async completeSession(sessionId: string, autoReturn: boolean = true): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.state = 'completed';
    session.completedAt = Date.now();

    // Stop timeout monitoring
    this.stopSessionTimeout(sessionId);

    // Auto-close child tabs if configured
    if (session.autoClose) {
      for (const childTab of session.childTabs) {
        try {
          await chrome.tabs.remove(childTab.id);
          console.log(`[TabHandler] Auto-closed child tab ${childTab.id}`);
        } catch (e) {
          // Tab may already be closed
        }
      }
    }

    // Return to origin tab if configured
    if (autoReturn && this.config.returnToOrigin) {
      try {
        await chrome.tabs.update(session.originTab.id, { active: true });
        await chrome.windows.update(session.originTab.windowId, { focused: true });
        console.log(`[TabHandler] Returned to origin tab ${session.originTab.id}`);
      } catch (e) {
        console.warn(`[TabHandler] Could not return to origin tab:`, e);
      }
    }

    this.emitEvent({ type: 'session-completed', session });

    // Clean up session tracking
    this.cleanupSession(sessionId);
  }

  /**
   * Fail a session
   */
  failSession(sessionId: string, reason: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.state = 'failed';
    session.completedAt = Date.now();

    this.stopSessionTimeout(sessionId);
    this.emitEvent({ type: 'session-failed', session, data: { reason } });
    this.cleanupSession(sessionId);

    console.log(`[TabHandler] Session ${sessionId} failed: ${reason}`);
  }

  /**
   * Cancel a session
   */
  async cancelSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.state = 'cancelled';
    session.completedAt = Date.now();

    this.stopSessionTimeout(sessionId);

    // Close child tabs
    for (const childTab of session.childTabs) {
      try {
        await chrome.tabs.remove(childTab.id);
      } catch (e) {
        // Tab may already be closed
      }
    }

    this.cleanupSession(sessionId);
    console.log(`[TabHandler] Session ${sessionId} cancelled`);
  }

  // ----------------------------------------
  // Tab Operations
  // ----------------------------------------

  /**
   * Switch to a specific tab
   */
  async switchToTab(tabId: number): Promise<void> {
    try {
      const tab = await chrome.tabs.get(tabId);
      await chrome.tabs.update(tabId, { active: true });
      await chrome.windows.update(tab.windowId, { focused: true });
    } catch (e) {
      console.error(`[TabHandler] Failed to switch to tab ${tabId}:`, e);
      throw e;
    }
  }

  /**
   * Wait for a tab to reach a specific URL pattern
   */
  async waitForNavigation(
    tabId: number, 
    urlPattern: RegExp, 
    timeout: number = 30000
  ): Promise<TabInfo> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkTab = async () => {
        try {
          const tab = await chrome.tabs.get(tabId);
          
          if (tab.url && urlPattern.test(tab.url)) {
            resolve(this.chromeTabToInfo(tab));
            return true;
          }
          
          if (Date.now() - startTime > timeout) {
            reject(new Error(`Timeout waiting for navigation to ${urlPattern}`));
            return true;
          }
          
          return false;
        } catch (e) {
          reject(new Error(`Tab ${tabId} was closed`));
          return true;
        }
      };

      const poll = async () => {
        const done = await checkTab();
        if (!done) {
          setTimeout(poll, this.config.pollInterval);
        }
      };

      poll();
    });
  }

  /**
   * Wait for a new tab to open from current tab
   */
  async waitForNewTab(
    originTabId: number,
    timeout: number = 10000
  ): Promise<TabInfo> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let resolved = false;

      const listener = (tab: chrome.tabs.Tab) => {
        if (resolved) return;
        
        // Check if this tab was opened from our origin tab
        if (tab.openerTabId === originTabId) {
          resolved = true;
          chrome.tabs.onCreated.removeListener(listener);
          resolve(this.chromeTabToInfo(tab));
        }
      };

      chrome.tabs.onCreated.addListener(listener);

      // Timeout handler
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          chrome.tabs.onCreated.removeListener(listener);
          reject(new Error('Timeout waiting for new tab'));
        }
      }, timeout);
    });
  }

  /**
   * Wait for a tab to close
   */
  async waitForTabClose(tabId: number, timeout: number = 60000): Promise<void> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let resolved = false;

      const listener = (closedTabId: number) => {
        if (closedTabId === tabId && !resolved) {
          resolved = true;
          chrome.tabs.onRemoved.removeListener(listener);
          resolve();
        }
      };

      chrome.tabs.onRemoved.addListener(listener);

      // Check if already closed
      chrome.tabs.get(tabId).catch(() => {
        if (!resolved) {
          resolved = true;
          chrome.tabs.onRemoved.removeListener(listener);
          resolve();
        }
      });

      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          chrome.tabs.onRemoved.removeListener(listener);
          reject(new Error('Timeout waiting for tab to close'));
        }
      }, timeout);
    });
  }

  // ----------------------------------------
  // OAuth Handling
  // ----------------------------------------

  /**
   * Handle OAuth flow - waits for OAuth to complete and returns to origin
   */
  async handleOAuthFlow(
    originTabId: number,
    provider?: string
  ): Promise<{ success: boolean; error?: string }> {
    const session = await this.startSession(originTabId, 'oauth');

    try {
      // Wait for OAuth popup to open
      const oauthTab = await this.waitForNewTab(originTabId, 10000);
      
      console.log(`[TabHandler] OAuth popup opened: ${oauthTab.url}`);

      // Detect provider from URL
      const detectedProvider = this.detectOAuthProvider(oauthTab.url);
      if (detectedProvider) {
        this.emitEvent({ type: 'oauth-detected', session, data: { provider: detectedProvider.name } });
      }

      // Wait for OAuth to complete (success or failure)
      const result = await this.waitForOAuthCompletion(oauthTab.id, detectedProvider);
      
      if (result.success) {
        this.emitEvent({ type: 'oauth-success', session, data: { provider: detectedProvider?.name } });
        await this.completeSession(session.id);
        return { success: true };
      } else {
        this.emitEvent({ type: 'oauth-failed', session, data: { error: result.error } });
        this.failSession(session.id, result.error || 'OAuth failed');
        return { success: false, error: result.error };
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'OAuth flow failed';
      this.failSession(session.id, errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Detect OAuth provider from URL
   */
  detectOAuthProvider(url: string): OAuthProvider | undefined {
    for (const provider of OAUTH_PROVIDERS) {
      if (provider.urlPatterns.some(pattern => pattern.test(url))) {
        return provider;
      }
    }
    return undefined;
  }

  /**
   * Wait for OAuth to complete
   */
  private async waitForOAuthCompletion(
    tabId: number,
    provider?: OAuthProvider
  ): Promise<{ success: boolean; error?: string }> {
    const timeout = provider?.timeout || this.config.oauthTimeout;
    const startTime = Date.now();

    return new Promise((resolve) => {
      let resolved = false;

      const checkCompletion = async () => {
        if (resolved) return;

        try {
          const tab = await chrome.tabs.get(tabId);
          const url = tab.url || '';

          // Check for success
          if (provider) {
            if (provider.successPatterns.some(p => p.test(url))) {
              resolved = true;
              resolve({ success: true });
              return;
            }
            if (provider.failurePatterns.some(p => p.test(url))) {
              resolved = true;
              resolve({ success: false, error: 'OAuth was denied or failed' });
              return;
            }
          }

          // Generic success patterns (callback with code)
          if (/[?&]code=/.test(url) || /oauth.*callback/i.test(url)) {
            resolved = true;
            resolve({ success: true });
            return;
          }

          // Generic failure patterns
          if (/error=access_denied/i.test(url) || /error=consent_required/i.test(url)) {
            resolved = true;
            resolve({ success: false, error: 'Access denied' });
            return;
          }

          // Timeout check
          if (Date.now() - startTime > timeout) {
            resolved = true;
            resolve({ success: false, error: 'OAuth timeout' });
            return;
          }

          // Continue polling
          setTimeout(checkCompletion, this.config.pollInterval);

        } catch (e) {
          // Tab was closed - could be success (redirect closed it) or user cancelled
          resolved = true;
          resolve({ success: true }); // Assume success if tab closed without error URL
        }
      };

      // Also listen for tab close
      const closeListener = (closedTabId: number) => {
        if (closedTabId === tabId && !resolved) {
          resolved = true;
          chrome.tabs.onRemoved.removeListener(closeListener);
          resolve({ success: true }); // Tab closed = assume success
        }
      };
      chrome.tabs.onRemoved.addListener(closeListener);

      checkCompletion();
    });
  }

  // ----------------------------------------
  // ATS Detection
  // ----------------------------------------

  /**
   * Detect if a URL is an ATS system
   */
  detectATS(url: string): { name: string; patterns: RegExp[] } | undefined {
    for (const ats of ATS_PATTERNS) {
      if (ats.patterns.some(pattern => pattern.test(url))) {
        return ats;
      }
    }
    return undefined;
  }

  /**
   * Check if current page might open external tabs
   */
  mightOpenExternalTabs(url: string): boolean {
    // ATS systems often open external auth or forms
    if (this.detectATS(url)) return true;
    
    // Job boards
    const jobBoardPatterns = [
      /linkedin\.com\/jobs/i,
      /indeed\.com/i,
      /glassdoor\.com/i,
      /ziprecruiter\.com/i,
      /monster\.com/i,
    ];
    
    return jobBoardPatterns.some(p => p.test(url));
  }

  // ----------------------------------------
  // Tab Event Handlers
  // ----------------------------------------

  private handleTabCreated = async (tab: chrome.tabs.Tab) => {
    if (!tab.id) return;

    // Check if this tab was opened from a tracked origin tab
    if (tab.openerTabId) {
      const session = this.getSessionForTab(tab.openerTabId);
      
      if (session && session.state === 'active') {
        const tabInfo = this.chromeTabToInfo(tab);
        session.childTabs.push(tabInfo);
        this.tabToSession.set(tab.id, session.id);

        // Check for OAuth
        if (tab.pendingUrl || tab.url) {
          const url = tab.pendingUrl || tab.url || '';
          const provider = this.detectOAuthProvider(url);
          if (provider) {
            session.purpose = 'oauth';
            this.emitEvent({ type: 'oauth-detected', session, tab: tabInfo, data: { provider: provider.name } });
          }
        }

        this.emitEvent({ type: 'tab-opened', session, tab: tabInfo });

        // Warn if too many child tabs
        if (session.childTabs.length >= this.config.maxChildTabs) {
          console.warn(`[TabHandler] Session ${session.id} has ${session.childTabs.length} child tabs!`);
        }

        console.log(`[TabHandler] Child tab ${tab.id} added to session ${session.id}`);
      }
    }
  };

  private handleTabUpdated = async (
    tabId: number,
    changeInfo: chrome.tabs.TabChangeInfo,
    tab: chrome.tabs.Tab
  ) => {
    const session = this.getSessionForTab(tabId);
    if (!session) return;

    // Update tab info in session
    const isOrigin = session.originTab.id === tabId;
    const tabInfo = this.chromeTabToInfo(tab);

    if (isOrigin) {
      session.originTab = tabInfo;
    } else {
      const idx = session.childTabs.findIndex(t => t.id === tabId);
      if (idx >= 0) {
        session.childTabs[idx] = tabInfo;
      }
    }

    // Check for navigation changes
    if (changeInfo.url) {
      this.emitEvent({ type: 'tab-navigated', session, tab: tabInfo });

      // Check for OAuth completion
      if (session.purpose === 'oauth' && !isOrigin) {
        const provider = this.detectOAuthProvider(tabInfo.url);
        if (provider) {
          const isSuccess = provider.successPatterns.some(p => p.test(tabInfo.url));
          const isFailure = provider.failurePatterns.some(p => p.test(tabInfo.url));

          if (isSuccess) {
            this.emitEvent({ type: 'oauth-success', session, tab: tabInfo });
            await this.completeSession(session.id);
          } else if (isFailure) {
            this.emitEvent({ type: 'oauth-failed', session, tab: tabInfo });
            this.failSession(session.id, 'OAuth access denied');
          }
        }
      }
    }
  };

  private handleTabRemoved = (tabId: number) => {
    const session = this.getSessionForTab(tabId);
    if (!session) return;

    if (session.originTab.id === tabId) {
      // Origin tab closed - fail the session
      this.failSession(session.id, 'Origin tab was closed');
    } else {
      // Child tab closed
      session.childTabs = session.childTabs.filter(t => t.id !== tabId);
      this.tabToSession.delete(tabId);
      
      this.emitEvent({ type: 'tab-closed', session, tab: { id: tabId } as TabInfo });

      // If all child tabs closed and this was an OAuth session, consider it complete
      if (session.purpose === 'oauth' && session.childTabs.length === 0) {
        this.completeSession(session.id);
      }
    }
  };

  private handleTabActivated = async (activeInfo: chrome.tabs.TabActiveInfo) => {
    const session = this.getSessionForTab(activeInfo.tabId);
    if (session) {
      // Update which tab is active
      session.originTab.active = session.originTab.id === activeInfo.tabId;
      session.childTabs.forEach(t => {
        t.active = t.id === activeInfo.tabId;
      });
    }
  };

  // ----------------------------------------
  // Helpers
  // ----------------------------------------

  private async getTabInfo(tabId: number): Promise<TabInfo | null> {
    try {
      const tab = await chrome.tabs.get(tabId);
      return this.chromeTabToInfo(tab);
    } catch {
      return null;
    }
  }

  private chromeTabToInfo(tab: chrome.tabs.Tab): TabInfo {
    return {
      id: tab.id!,
      windowId: tab.windowId,
      url: tab.url || tab.pendingUrl || '',
      title: tab.title || '',
      active: tab.active,
      status: tab.status as 'loading' | 'complete',
      openerTabId: tab.openerTabId,
      createdAt: Date.now(),
    };
  }

  private generateSessionId(): string {
    return `tab-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private startSessionTimeout(session: TabSession): void {
    const interval = setInterval(() => {
      if (Date.now() - session.startedAt > session.timeout) {
        this.emitEvent({ type: 'session-timeout', session });
        this.failSession(session.id, 'Session timed out');
      }
    }, 5000);
    
    this.pollIntervals.set(session.id, interval);
  }

  private stopSessionTimeout(sessionId: string): void {
    const interval = this.pollIntervals.get(sessionId);
    if (interval) {
      clearInterval(interval);
      this.pollIntervals.delete(sessionId);
    }
  }

  private cleanupSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Remove tab-to-session mappings
    this.tabToSession.delete(session.originTab.id);
    session.childTabs.forEach(t => this.tabToSession.delete(t.id));

    // Keep session for history but mark completed
    // Sessions are kept for 5 minutes then cleaned
    setTimeout(() => {
      this.sessions.delete(sessionId);
    }, 300000);
  }

  private emitEvent(event: TabEvent): void {
    this.eventCallbacks.forEach(cb => {
      try {
        cb(event);
      } catch (e) {
        console.error('[TabHandler] Event callback error:', e);
      }
    });
  }
}

// ========================================
// Singleton Instance
// ========================================

let tabHandlerInstance: TabHandler | null = null;

/**
 * Get the singleton TabHandler instance
 */
export function getTabHandler(config?: Partial<TabHandlerConfig>): TabHandler {
  if (!tabHandlerInstance) {
    tabHandlerInstance = new TabHandler(config);
  }
  return tabHandlerInstance;
}

/**
 * Initialize and start the tab handler
 */
export function initTabHandler(config?: Partial<TabHandlerConfig>): TabHandler {
  const handler = getTabHandler(config);
  handler.startListening();
  return handler;
}

// ========================================
// Content Script Utilities
// ========================================

/**
 * Request the background script to start a tab session
 * (Use from content scripts)
 */
export async function requestTabSession(purpose: TabPurpose = 'oauth'): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: 'TAB_SESSION_START', purpose },
      (response) => {
        if (response?.sessionId) {
          resolve(response.sessionId);
        } else {
          reject(new Error(response?.error || 'Failed to start tab session'));
        }
      }
    );
  });
}

/**
 * Notify background that we're about to trigger an action that may open a new tab
 */
export async function notifyPendingTabOpen(reason: string = 'oauth'): Promise<void> {
  chrome.runtime.sendMessage({
    type: 'TAB_PENDING_OPEN',
    reason,
    tabId: undefined, // Will be filled by background
  });
}

/**
 * Check if we're currently in an OAuth popup
 */
export function isOAuthPopup(): boolean {
  const url = window.location.href;
  return OAUTH_PROVIDERS.some(p => p.urlPatterns.some(pattern => pattern.test(url)));
}

/**
 * Check if we returned from an OAuth flow
 */
export function isOAuthCallback(): boolean {
  const url = window.location.href;
  return /[?&]code=/.test(url) || /oauth.*callback/i.test(url);
}

// ========================================
// Background Script Message Handlers
// ========================================

/**
 * Setup message handlers for tab operations (call from background script)
 */
export function setupTabHandlerMessages(): void {
  const handler = getTabHandler();
  
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'TAB_SESSION_START': {
        const tabId = sender.tab?.id;
        if (!tabId) {
          sendResponse({ error: 'No tab ID' });
          return false;
        }
        
        handler.startSession(tabId, message.purpose)
          .then(session => sendResponse({ sessionId: session.id }))
          .catch(err => sendResponse({ error: err.message }));
        return true; // async
      }
      
      case 'TAB_SESSION_COMPLETE': {
        handler.completeSession(message.sessionId);
        sendResponse({ success: true });
        return false;
      }
      
      case 'TAB_SESSION_FAIL': {
        handler.failSession(message.sessionId, message.reason);
        sendResponse({ success: true });
        return false;
      }
      
      case 'TAB_PENDING_OPEN': {
        const tabId = sender.tab?.id;
        if (tabId) {
          // Start session automatically if not already tracking
          const existingSession = handler.getSessionForTab(tabId);
          if (!existingSession) {
            handler.startSession(tabId, message.reason || 'unknown');
          }
        }
        sendResponse({ success: true });
        return false;
      }
      
      case 'TAB_GET_SESSION': {
        const tabId = sender.tab?.id || message.tabId;
        if (tabId) {
          const session = handler.getSessionForTab(tabId);
          sendResponse({ session: session || null });
        } else {
          sendResponse({ session: null });
        }
        return false;
      }
      
      case 'TAB_HANDLE_OAUTH': {
        const tabId = sender.tab?.id;
        if (!tabId) {
          sendResponse({ error: 'No tab ID' });
          return false;
        }
        
        handler.handleOAuthFlow(tabId, message.provider)
          .then(result => sendResponse(result))
          .catch(err => sendResponse({ success: false, error: err.message }));
        return true; // async
      }
    }
    
    return false;
  });

  console.log('[TabHandler] Message handlers registered');
}

export default TabHandler;
