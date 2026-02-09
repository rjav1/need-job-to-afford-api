// Background service worker for AI Job Applier

import { initTabHandler, setupTabHandlerMessages } from '../lib/tab-handler';

// Initialize tab handler for multi-tab management (OAuth, external forms)
const tabHandler = initTabHandler({
  autoCloseOnSuccess: true,
  returnToOrigin: true,
  oauthTimeout: 120000,
});

// Setup message handlers for tab operations
setupTabHandlerMessages();

// Log tab events for debugging
tabHandler.onEvent((event) => {
  console.log(`[TabHandler Event] ${event.type}`, event.session?.id, event.data);
});

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Open options page on first install
    chrome.runtime.openOptionsPage();
  }
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'OPEN_OPTIONS':
      chrome.runtime.openOptionsPage();
      break;
      
    case 'LOG_APPLICATION':
      // Log application to storage
      logApplication(message.data);
      break;
      
    case 'GET_PROFILE':
      // Get profile from storage
      chrome.storage.local.get('userProfile', (result) => {
        sendResponse(result.userProfile || null);
      });
      return true; // async response
      
    case 'NAVIGATE_TO_JOB':
      // Open job URL in new tab
      chrome.tabs.create({ url: message.url, active: true }, (tab) => {
        sendResponse({ tabId: tab?.id });
      });
      return true;
      
    case 'APPLY_TO_JOB':
      // Open job in new tab and apply
      handleApplyToJob(message.job, message.config).then(result => {
        sendResponse({ result });
      });
      return true;
      
    case 'GET_APPLY_CONFIG':
      // Get apply configuration
      chrome.storage.local.get('applyConfig', (result) => {
        sendResponse(result.applyConfig || null);
      });
      return true;
      
    case 'SAVE_APPLY_CONFIG':
      // Save apply configuration
      chrome.storage.local.set({ applyConfig: message.config }, () => {
        sendResponse({ success: true });
      });
      return true;
  }
});

// Handle apply to job request (swarm mode)
async function handleApplyToJob(
  job: { url: string; title: string; company: string },
  config: any
): Promise<any> {
  return new Promise((resolve) => {
    // Create new tab for the job
    chrome.tabs.create({ url: job.url, active: false }, async (tab) => {
      if (!tab?.id) {
        resolve({ success: false, error: 'Failed to create tab' });
        return;
      }
      
      // Wait for page to load
      const tabId = tab.id;
      
      const onCompleted = (details: chrome.webNavigation.WebNavigationFramedCallbackDetails) => {
        if (details.tabId === tabId && details.frameId === 0) {
          chrome.webNavigation.onCompleted.removeListener(onCompleted);
          
          // Send fill message to content script
          setTimeout(() => {
            chrome.tabs.sendMessage(tabId, { 
              type: 'AUTO_APPLY',
              config,
            }, (response) => {
              // Close tab after applying (unless stopped at review)
              if (response?.result && !response.result.stoppedAtReview) {
                setTimeout(() => {
                  chrome.tabs.remove(tabId);
                }, 2000);
              }
              resolve(response?.result || { success: false, error: 'No response from content script' });
            });
          }, 2000); // Wait 2s for page to fully render
        }
      };
      
      chrome.webNavigation.onCompleted.addListener(onCompleted);
      
      // Timeout after 30 seconds
      setTimeout(() => {
        chrome.webNavigation.onCompleted.removeListener(onCompleted);
        resolve({ success: false, error: 'Page load timeout' });
      }, 30000);
    });
  });
}

// Log application to history
async function logApplication(data: {
  companyName: string;
  jobTitle: string;
  jobUrl: string;
}) {
  const result = await chrome.storage.local.get('applications');
  const applications = result.applications || [];
  
  applications.unshift({
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    ...data,
    appliedAt: new Date().toISOString(),
    status: 'applied',
    aiResponsesUsed: [],
  });
  
  // Keep only last 100 applications
  if (applications.length > 100) {
    applications.length = 100;
  }
  
  await chrome.storage.local.set({ applications });
}

// Set up context menu
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'ai-job-applier-fill',
    title: 'Fill with AI Job Applier',
    contexts: ['editable'],
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'ai-job-applier-fill' && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'FILL_FIELD_AT_CURSOR' });
  }
});

console.log('AI Job Applier background script loaded');
