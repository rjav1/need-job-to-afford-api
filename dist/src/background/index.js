var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
const OAUTH_PROVIDERS = [
  {
    name: "LinkedIn",
    urlPatterns: [
      /linkedin\.com\/oauth/i,
      /linkedin\.com\/uas\/login/i,
      /linkedin\.com\/checkpoint/i,
      /linkedin\.com\/authwall/i
    ],
    successPatterns: [
      /linkedin\.com\/feed/i,
      /linkedin\.com\/in\//i,
      /callback.*code=/i,
      /\?oauth_token=/i
    ],
    failurePatterns: [
      /linkedin\.com\/uas\/login.*error/i,
      /access_denied/i
    ],
    timeout: 12e4
    // 2 minutes
  },
  {
    name: "Google",
    urlPatterns: [
      /accounts\.google\.com\/o\/oauth/i,
      /accounts\.google\.com\/signin/i,
      /accounts\.google\.com\/ServiceLogin/i
    ],
    successPatterns: [
      /callback.*code=/i,
      /oauth2callback/i,
      /\?state=.*&code=/i
    ],
    failurePatterns: [
      /error=access_denied/i,
      /error=consent_required/i
    ],
    timeout: 12e4
  },
  {
    name: "Microsoft",
    urlPatterns: [
      /login\.microsoftonline\.com/i,
      /login\.live\.com/i,
      /microsoft\.com\/oauth/i
    ],
    successPatterns: [
      /callback.*code=/i,
      /\?code=.*&state=/i
    ],
    failurePatterns: [
      /error=access_denied/i,
      /error_description=/i
    ],
    timeout: 12e4
  },
  {
    name: "GitHub",
    urlPatterns: [
      /github\.com\/login\/oauth/i,
      /github\.com\/login\?/i,
      /github\.com\/sessions/i
    ],
    successPatterns: [
      /callback.*code=/i,
      /github\.com\/settings/i
    ],
    failurePatterns: [
      /error=access_denied/i
    ],
    timeout: 12e4
  },
  {
    name: "Indeed",
    urlPatterns: [
      /secure\.indeed\.com\/auth/i,
      /indeed\.com\/account\/login/i
    ],
    successPatterns: [
      /indeed\.com\/jobs/i,
      /indeed\.com\/viewjob/i
    ],
    failurePatterns: [
      /login.*error/i
    ],
    timeout: 12e4
  }
];
const ATS_PATTERNS = [
  { name: "Greenhouse", patterns: [/boards\.greenhouse\.io/i, /greenhouse\.io\/embed/i] },
  { name: "Lever", patterns: [/jobs\.lever\.co/i] },
  { name: "Workday", patterns: [/myworkdayjobs\.com/i, /workday\.com/i] },
  { name: "iCIMS", patterns: [/icims\.com/i, /careers-.*\.icims\.com/i] },
  { name: "Taleo", patterns: [/taleo\.net/i] },
  { name: "BrassRing", patterns: [/brassring\.com/i] },
  { name: "SmartRecruiters", patterns: [/smartrecruiters\.com/i, /jobs\.smartrecruiters\.com/i] },
  { name: "Ashby", patterns: [/jobs\.ashbyhq\.com/i, /ashbyhq\.com/i] }
];
const DEFAULT_CONFIG = {
  defaultTimeout: 3e5,
  // 5 minutes
  oauthTimeout: 12e4,
  // 2 minutes
  pollInterval: 500,
  // 500ms
  autoCloseOnSuccess: true,
  returnToOrigin: true,
  maxChildTabs: 5
};
class TabHandler {
  constructor(config = {}) {
    __publicField(this, "config");
    __publicField(this, "sessions", /* @__PURE__ */ new Map());
    __publicField(this, "tabToSession", /* @__PURE__ */ new Map());
    __publicField(this, "eventCallbacks", []);
    __publicField(this, "isListening", false);
    __publicField(this, "pollIntervals", /* @__PURE__ */ new Map());
    // ----------------------------------------
    // Tab Event Handlers
    // ----------------------------------------
    __publicField(this, "handleTabCreated", async (tab) => {
      if (!tab.id) return;
      if (tab.openerTabId) {
        const session = this.getSessionForTab(tab.openerTabId);
        if (session && session.state === "active") {
          const tabInfo = this.chromeTabToInfo(tab);
          session.childTabs.push(tabInfo);
          this.tabToSession.set(tab.id, session.id);
          if (tab.pendingUrl || tab.url) {
            const url = tab.pendingUrl || tab.url || "";
            const provider = this.detectOAuthProvider(url);
            if (provider) {
              session.purpose = "oauth";
              this.emitEvent({ type: "oauth-detected", session, tab: tabInfo, data: { provider: provider.name } });
            }
          }
          this.emitEvent({ type: "tab-opened", session, tab: tabInfo });
          if (session.childTabs.length >= this.config.maxChildTabs) {
            console.warn(`[TabHandler] Session ${session.id} has ${session.childTabs.length} child tabs!`);
          }
          console.log(`[TabHandler] Child tab ${tab.id} added to session ${session.id}`);
        }
      }
    });
    __publicField(this, "handleTabUpdated", async (tabId, changeInfo, tab) => {
      const session = this.getSessionForTab(tabId);
      if (!session) return;
      const isOrigin = session.originTab.id === tabId;
      const tabInfo = this.chromeTabToInfo(tab);
      if (isOrigin) {
        session.originTab = tabInfo;
      } else {
        const idx = session.childTabs.findIndex((t) => t.id === tabId);
        if (idx >= 0) {
          session.childTabs[idx] = tabInfo;
        }
      }
      if (changeInfo.url) {
        this.emitEvent({ type: "tab-navigated", session, tab: tabInfo });
        if (session.purpose === "oauth" && !isOrigin) {
          const provider = this.detectOAuthProvider(tabInfo.url);
          if (provider) {
            const isSuccess = provider.successPatterns.some((p) => p.test(tabInfo.url));
            const isFailure = provider.failurePatterns.some((p) => p.test(tabInfo.url));
            if (isSuccess) {
              this.emitEvent({ type: "oauth-success", session, tab: tabInfo });
              await this.completeSession(session.id);
            } else if (isFailure) {
              this.emitEvent({ type: "oauth-failed", session, tab: tabInfo });
              this.failSession(session.id, "OAuth access denied");
            }
          }
        }
      }
    });
    __publicField(this, "handleTabRemoved", (tabId) => {
      const session = this.getSessionForTab(tabId);
      if (!session) return;
      if (session.originTab.id === tabId) {
        this.failSession(session.id, "Origin tab was closed");
      } else {
        session.childTabs = session.childTabs.filter((t) => t.id !== tabId);
        this.tabToSession.delete(tabId);
        this.emitEvent({ type: "tab-closed", session, tab: { id: tabId } });
        if (session.purpose === "oauth" && session.childTabs.length === 0) {
          this.completeSession(session.id);
        }
      }
    });
    __publicField(this, "handleTabActivated", async (activeInfo) => {
      const session = this.getSessionForTab(activeInfo.tabId);
      if (session) {
        session.originTab.active = session.originTab.id === activeInfo.tabId;
        session.childTabs.forEach((t) => {
          t.active = t.id === activeInfo.tabId;
        });
      }
    });
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  // ----------------------------------------
  // Lifecycle
  // ----------------------------------------
  /**
   * Start listening for tab events
   */
  startListening() {
    if (this.isListening) return;
    this.isListening = true;
    chrome.tabs.onCreated.addListener(this.handleTabCreated);
    chrome.tabs.onUpdated.addListener(this.handleTabUpdated);
    chrome.tabs.onRemoved.addListener(this.handleTabRemoved);
    chrome.tabs.onActivated.addListener(this.handleTabActivated);
    console.log("[TabHandler] Started listening for tab events");
  }
  /**
   * Stop listening for tab events
   */
  stopListening() {
    if (!this.isListening) return;
    this.isListening = false;
    chrome.tabs.onCreated.removeListener(this.handleTabCreated);
    chrome.tabs.onUpdated.removeListener(this.handleTabUpdated);
    chrome.tabs.onRemoved.removeListener(this.handleTabRemoved);
    chrome.tabs.onActivated.removeListener(this.handleTabActivated);
    this.pollIntervals.forEach((interval) => clearInterval(interval));
    this.pollIntervals.clear();
    console.log("[TabHandler] Stopped listening for tab events");
  }
  /**
   * Register event callback
   */
  onEvent(callback) {
    this.eventCallbacks.push(callback);
    return () => {
      this.eventCallbacks = this.eventCallbacks.filter((cb) => cb !== callback);
    };
  }
  // ----------------------------------------
  // Session Management
  // ----------------------------------------
  /**
   * Start a new tab session for tracking child tabs
   * Call this before an action that might open new tabs (e.g., clicking "Sign in with LinkedIn")
   */
  async startSession(originTabId, purpose = "unknown") {
    const originTab = await this.getTabInfo(originTabId);
    if (!originTab) {
      throw new Error(`Origin tab ${originTabId} not found`);
    }
    const session = {
      id: this.generateSessionId(),
      originTab,
      childTabs: [],
      purpose,
      state: "active",
      startedAt: Date.now(),
      timeout: purpose === "oauth" ? this.config.oauthTimeout : this.config.defaultTimeout,
      autoClose: this.config.autoCloseOnSuccess
    };
    this.sessions.set(session.id, session);
    this.tabToSession.set(originTabId, session.id);
    this.startSessionTimeout(session);
    this.emitEvent({ type: "session-started", session });
    console.log(`[TabHandler] Started session ${session.id} for tab ${originTabId} (${purpose})`);
    return session;
  }
  /**
   * Get active session for a tab (either as origin or child)
   */
  getSessionForTab(tabId) {
    const sessionId = this.tabToSession.get(tabId);
    if (sessionId) {
      return this.sessions.get(sessionId);
    }
    return void 0;
  }
  /**
   * Get all active sessions
   */
  getActiveSessions() {
    return Array.from(this.sessions.values()).filter((s) => s.state === "active" || s.state === "waiting");
  }
  /**
   * Complete a session (success)
   */
  async completeSession(sessionId, autoReturn = true) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.state = "completed";
    session.completedAt = Date.now();
    this.stopSessionTimeout(sessionId);
    if (session.autoClose) {
      for (const childTab of session.childTabs) {
        try {
          await chrome.tabs.remove(childTab.id);
          console.log(`[TabHandler] Auto-closed child tab ${childTab.id}`);
        } catch (e) {
        }
      }
    }
    if (autoReturn && this.config.returnToOrigin) {
      try {
        await chrome.tabs.update(session.originTab.id, { active: true });
        await chrome.windows.update(session.originTab.windowId, { focused: true });
        console.log(`[TabHandler] Returned to origin tab ${session.originTab.id}`);
      } catch (e) {
        console.warn(`[TabHandler] Could not return to origin tab:`, e);
      }
    }
    this.emitEvent({ type: "session-completed", session });
    this.cleanupSession(sessionId);
  }
  /**
   * Fail a session
   */
  failSession(sessionId, reason) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.state = "failed";
    session.completedAt = Date.now();
    this.stopSessionTimeout(sessionId);
    this.emitEvent({ type: "session-failed", session, data: { reason } });
    this.cleanupSession(sessionId);
    console.log(`[TabHandler] Session ${sessionId} failed: ${reason}`);
  }
  /**
   * Cancel a session
   */
  async cancelSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.state = "cancelled";
    session.completedAt = Date.now();
    this.stopSessionTimeout(sessionId);
    for (const childTab of session.childTabs) {
      try {
        await chrome.tabs.remove(childTab.id);
      } catch (e) {
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
  async switchToTab(tabId) {
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
  async waitForNavigation(tabId, urlPattern, timeout = 3e4) {
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
  async waitForNewTab(originTabId, timeout = 1e4) {
    return new Promise((resolve, reject) => {
      let resolved = false;
      const listener = (tab) => {
        if (resolved) return;
        if (tab.openerTabId === originTabId) {
          resolved = true;
          chrome.tabs.onCreated.removeListener(listener);
          resolve(this.chromeTabToInfo(tab));
        }
      };
      chrome.tabs.onCreated.addListener(listener);
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          chrome.tabs.onCreated.removeListener(listener);
          reject(new Error("Timeout waiting for new tab"));
        }
      }, timeout);
    });
  }
  /**
   * Wait for a tab to close
   */
  async waitForTabClose(tabId, timeout = 6e4) {
    return new Promise((resolve, reject) => {
      let resolved = false;
      const listener = (closedTabId) => {
        if (closedTabId === tabId && !resolved) {
          resolved = true;
          chrome.tabs.onRemoved.removeListener(listener);
          resolve();
        }
      };
      chrome.tabs.onRemoved.addListener(listener);
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
          reject(new Error("Timeout waiting for tab to close"));
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
  async handleOAuthFlow(originTabId, provider) {
    const session = await this.startSession(originTabId, "oauth");
    try {
      const oauthTab = await this.waitForNewTab(originTabId, 1e4);
      console.log(`[TabHandler] OAuth popup opened: ${oauthTab.url}`);
      const detectedProvider = this.detectOAuthProvider(oauthTab.url);
      if (detectedProvider) {
        this.emitEvent({ type: "oauth-detected", session, data: { provider: detectedProvider.name } });
      }
      const result = await this.waitForOAuthCompletion(oauthTab.id, detectedProvider);
      if (result.success) {
        this.emitEvent({ type: "oauth-success", session, data: { provider: detectedProvider == null ? void 0 : detectedProvider.name } });
        await this.completeSession(session.id);
        return { success: true };
      } else {
        this.emitEvent({ type: "oauth-failed", session, data: { error: result.error } });
        this.failSession(session.id, result.error || "OAuth failed");
        return { success: false, error: result.error };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "OAuth flow failed";
      this.failSession(session.id, errorMsg);
      return { success: false, error: errorMsg };
    }
  }
  /**
   * Detect OAuth provider from URL
   */
  detectOAuthProvider(url) {
    for (const provider of OAUTH_PROVIDERS) {
      if (provider.urlPatterns.some((pattern) => pattern.test(url))) {
        return provider;
      }
    }
    return void 0;
  }
  /**
   * Wait for OAuth to complete
   */
  async waitForOAuthCompletion(tabId, provider) {
    const timeout = (provider == null ? void 0 : provider.timeout) || this.config.oauthTimeout;
    const startTime = Date.now();
    return new Promise((resolve) => {
      let resolved = false;
      const checkCompletion = async () => {
        if (resolved) return;
        try {
          const tab = await chrome.tabs.get(tabId);
          const url = tab.url || "";
          if (provider) {
            if (provider.successPatterns.some((p) => p.test(url))) {
              resolved = true;
              resolve({ success: true });
              return;
            }
            if (provider.failurePatterns.some((p) => p.test(url))) {
              resolved = true;
              resolve({ success: false, error: "OAuth was denied or failed" });
              return;
            }
          }
          if (/[?&]code=/.test(url) || /oauth.*callback/i.test(url)) {
            resolved = true;
            resolve({ success: true });
            return;
          }
          if (/error=access_denied/i.test(url) || /error=consent_required/i.test(url)) {
            resolved = true;
            resolve({ success: false, error: "Access denied" });
            return;
          }
          if (Date.now() - startTime > timeout) {
            resolved = true;
            resolve({ success: false, error: "OAuth timeout" });
            return;
          }
          setTimeout(checkCompletion, this.config.pollInterval);
        } catch (e) {
          resolved = true;
          resolve({ success: true });
        }
      };
      const closeListener = (closedTabId) => {
        if (closedTabId === tabId && !resolved) {
          resolved = true;
          chrome.tabs.onRemoved.removeListener(closeListener);
          resolve({ success: true });
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
  detectATS(url) {
    for (const ats of ATS_PATTERNS) {
      if (ats.patterns.some((pattern) => pattern.test(url))) {
        return ats;
      }
    }
    return void 0;
  }
  /**
   * Check if current page might open external tabs
   */
  mightOpenExternalTabs(url) {
    if (this.detectATS(url)) return true;
    const jobBoardPatterns = [
      /linkedin\.com\/jobs/i,
      /indeed\.com/i,
      /glassdoor\.com/i,
      /ziprecruiter\.com/i,
      /monster\.com/i
    ];
    return jobBoardPatterns.some((p) => p.test(url));
  }
  // ----------------------------------------
  // Helpers
  // ----------------------------------------
  async getTabInfo(tabId) {
    try {
      const tab = await chrome.tabs.get(tabId);
      return this.chromeTabToInfo(tab);
    } catch {
      return null;
    }
  }
  chromeTabToInfo(tab) {
    return {
      id: tab.id,
      windowId: tab.windowId,
      url: tab.url || tab.pendingUrl || "",
      title: tab.title || "",
      active: tab.active,
      status: tab.status,
      openerTabId: tab.openerTabId,
      createdAt: Date.now()
    };
  }
  generateSessionId() {
    return `tab-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  startSessionTimeout(session) {
    const interval = setInterval(() => {
      if (Date.now() - session.startedAt > session.timeout) {
        this.emitEvent({ type: "session-timeout", session });
        this.failSession(session.id, "Session timed out");
      }
    }, 5e3);
    this.pollIntervals.set(session.id, interval);
  }
  stopSessionTimeout(sessionId) {
    const interval = this.pollIntervals.get(sessionId);
    if (interval) {
      clearInterval(interval);
      this.pollIntervals.delete(sessionId);
    }
  }
  cleanupSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    this.tabToSession.delete(session.originTab.id);
    session.childTabs.forEach((t) => this.tabToSession.delete(t.id));
    setTimeout(() => {
      this.sessions.delete(sessionId);
    }, 3e5);
  }
  emitEvent(event) {
    this.eventCallbacks.forEach((cb) => {
      try {
        cb(event);
      } catch (e) {
        console.error("[TabHandler] Event callback error:", e);
      }
    });
  }
}
let tabHandlerInstance = null;
function getTabHandler(config) {
  if (!tabHandlerInstance) {
    tabHandlerInstance = new TabHandler(config);
  }
  return tabHandlerInstance;
}
function initTabHandler(config) {
  const handler = getTabHandler(config);
  handler.startListening();
  return handler;
}
function setupTabHandlerMessages() {
  const handler = getTabHandler();
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    var _a, _b, _c, _d;
    switch (message.type) {
      case "TAB_SESSION_START": {
        const tabId = (_a = sender.tab) == null ? void 0 : _a.id;
        if (!tabId) {
          sendResponse({ error: "No tab ID" });
          return false;
        }
        handler.startSession(tabId, message.purpose).then((session) => sendResponse({ sessionId: session.id })).catch((err) => sendResponse({ error: err.message }));
        return true;
      }
      case "TAB_SESSION_COMPLETE": {
        handler.completeSession(message.sessionId);
        sendResponse({ success: true });
        return false;
      }
      case "TAB_SESSION_FAIL": {
        handler.failSession(message.sessionId, message.reason);
        sendResponse({ success: true });
        return false;
      }
      case "TAB_PENDING_OPEN": {
        const tabId = (_b = sender.tab) == null ? void 0 : _b.id;
        if (tabId) {
          const existingSession = handler.getSessionForTab(tabId);
          if (!existingSession) {
            handler.startSession(tabId, message.reason || "unknown");
          }
        }
        sendResponse({ success: true });
        return false;
      }
      case "TAB_GET_SESSION": {
        const tabId = ((_c = sender.tab) == null ? void 0 : _c.id) || message.tabId;
        if (tabId) {
          const session = handler.getSessionForTab(tabId);
          sendResponse({ session: session || null });
        } else {
          sendResponse({ session: null });
        }
        return false;
      }
      case "TAB_HANDLE_OAUTH": {
        const tabId = (_d = sender.tab) == null ? void 0 : _d.id;
        if (!tabId) {
          sendResponse({ error: "No tab ID" });
          return false;
        }
        handler.handleOAuthFlow(tabId, message.provider).then((result) => sendResponse(result)).catch((err) => sendResponse({ success: false, error: err.message }));
        return true;
      }
    }
    return false;
  });
  console.log("[TabHandler] Message handlers registered");
}
const tabHandler = initTabHandler({
  autoCloseOnSuccess: true,
  returnToOrigin: true,
  oauthTimeout: 12e4
});
setupTabHandlerMessages();
tabHandler.onEvent((event) => {
  var _a;
  console.log(`[TabHandler Event] ${event.type}`, (_a = event.session) == null ? void 0 : _a.id, event.data);
});
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.runtime.openOptionsPage();
  }
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case "OPEN_OPTIONS":
      chrome.runtime.openOptionsPage();
      break;
    case "LOG_APPLICATION":
      logApplication(message.data);
      break;
    case "GET_PROFILE":
      chrome.storage.local.get("userProfile", (result) => {
        sendResponse(result.userProfile || null);
      });
      return true;
    case "NAVIGATE_TO_JOB":
      chrome.tabs.create({ url: message.url, active: true }, (tab) => {
        sendResponse({ tabId: tab == null ? void 0 : tab.id });
      });
      return true;
    case "APPLY_TO_JOB":
      handleApplyToJob(message.job, message.config).then((result) => {
        sendResponse({ result });
      });
      return true;
    case "GET_APPLY_CONFIG":
      chrome.storage.local.get("applyConfig", (result) => {
        sendResponse(result.applyConfig || null);
      });
      return true;
    case "SAVE_APPLY_CONFIG":
      chrome.storage.local.set({ applyConfig: message.config }, () => {
        sendResponse({ success: true });
      });
      return true;
  }
});
async function handleApplyToJob(job, config) {
  return new Promise((resolve) => {
    chrome.tabs.create({ url: job.url, active: false }, async (tab) => {
      if (!(tab == null ? void 0 : tab.id)) {
        resolve({ success: false, error: "Failed to create tab" });
        return;
      }
      const tabId = tab.id;
      const onCompleted = (details) => {
        if (details.tabId === tabId && details.frameId === 0) {
          chrome.webNavigation.onCompleted.removeListener(onCompleted);
          setTimeout(() => {
            chrome.tabs.sendMessage(tabId, {
              type: "AUTO_APPLY",
              config
            }, (response) => {
              if ((response == null ? void 0 : response.result) && !response.result.stoppedAtReview) {
                setTimeout(() => {
                  chrome.tabs.remove(tabId);
                }, 2e3);
              }
              resolve((response == null ? void 0 : response.result) || { success: false, error: "No response from content script" });
            });
          }, 2e3);
        }
      };
      chrome.webNavigation.onCompleted.addListener(onCompleted);
      setTimeout(() => {
        chrome.webNavigation.onCompleted.removeListener(onCompleted);
        resolve({ success: false, error: "Page load timeout" });
      }, 3e4);
    });
  });
}
async function logApplication(data) {
  const result = await chrome.storage.local.get("applications");
  const applications = result.applications || [];
  applications.unshift({
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    ...data,
    appliedAt: (/* @__PURE__ */ new Date()).toISOString(),
    status: "applied",
    aiResponsesUsed: []
  });
  if (applications.length > 100) {
    applications.length = 100;
  }
  await chrome.storage.local.set({ applications });
}
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "ai-job-applier-fill",
    title: "Fill with AI Job Applier",
    contexts: ["editable"]
  });
});
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "ai-job-applier-fill" && (tab == null ? void 0 : tab.id)) {
    chrome.tabs.sendMessage(tab.id, { type: "FILL_FIELD_AT_CURSOR" });
  }
});
console.log("AI Job Applier background script loaded");
//# sourceMappingURL=index.js.map
