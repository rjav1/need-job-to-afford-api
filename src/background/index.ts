// Background service worker for AI Job Applier

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
  }
});

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
