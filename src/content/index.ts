import { detectFormFields, detectJobInfo, detectOpenEndedQuestions } from './detector';
import { fillAllFields, previewFill, fillField } from './filler';
import { storage, generateId } from '../lib/storage';
import { DetectedField } from '../lib/types';
import { logApplication } from '../lib/application-logger';
import { recordAcceptance, recordCorrection } from '../lib/feedback-learner';

// State
let detectedFields: DetectedField[] = [];
let floatingButton: HTMLElement | null = null;

// Initialize content script
async function init() {
  console.log('[AI Job Applier] Content script loaded');
  
  // Wait for page to fully load
  if (document.readyState !== 'complete') {
    await new Promise(resolve => window.addEventListener('load', resolve));
  }
  
  // Detect fields
  detectedFields = detectFormFields();
  console.log(`[AI Job Applier] Detected ${detectedFields.length} form fields`);
  
  // Create floating action button
  createFloatingButton();
  
  // Listen for messages from popup
  chrome.runtime.onMessage.addListener(handleMessage);
}

// Create floating button
function createFloatingButton() {
  if (floatingButton) return;
  
  floatingButton = document.createElement('div');
  floatingButton.id = 'ai-job-applier-fab';
  floatingButton.innerHTML = `
    <div class="ai-job-applier-fab-content">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/>
      </svg>
      <span class="ai-job-applier-fab-badge">${detectedFields.length}</span>
    </div>
  `;
  
  floatingButton.addEventListener('click', () => {
    showQuickMenu();
  });
  
  document.body.appendChild(floatingButton);
}

// Show quick menu
function showQuickMenu() {
  const existing = document.getElementById('ai-job-applier-menu');
  if (existing) {
    existing.remove();
    return;
  }
  
  const jobInfo = detectJobInfo();
  const menu = document.createElement('div');
  menu.id = 'ai-job-applier-menu';
  menu.innerHTML = `
    <div class="ai-job-applier-menu-header">
      <h3>AI Job Applier</h3>
      ${jobInfo.company ? `<p>${jobInfo.title} at ${jobInfo.company}</p>` : ''}
    </div>
    <div class="ai-job-applier-menu-stats">
      <span>${detectedFields.length} fields detected</span>
    </div>
    <div class="ai-job-applier-menu-actions">
      <button id="ai-fill-all" class="ai-btn primary">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 11 12 14 22 4"></polyline>
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
        </svg>
        Auto-Fill All
      </button>
      <button id="ai-preview" class="ai-btn secondary">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
        Preview
      </button>
      <button id="ai-settings" class="ai-btn secondary">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
        Settings
      </button>
    </div>
    <button class="ai-job-applier-menu-close">×</button>
  `;
  
  document.body.appendChild(menu);
  
  // Event listeners
  menu.querySelector('#ai-fill-all')?.addEventListener('click', handleFillAll);
  menu.querySelector('#ai-preview')?.addEventListener('click', handlePreview);
  menu.querySelector('#ai-settings')?.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
  menu.querySelector('.ai-job-applier-menu-close')?.addEventListener('click', () => {
    menu.remove();
  });
}

// Handle fill all
async function handleFillAll() {
  const profile = await storage.getProfile();
  
  if (!profile.firstName || !profile.email) {
    alert('Please set up your profile first! Click the Settings button.');
    return;
  }
  
  const statusEl = document.querySelector('.ai-job-applier-menu-stats');
  if (statusEl) {
    statusEl.innerHTML = '<span class="loading">Filling forms...</span>';
  }
  
  const { filled, failed } = await fillAllFields(detectedFields, profile, {
    useAI: true,
    onProgress: (current, total) => {
      if (statusEl) {
        statusEl.innerHTML = `<span>Filled ${current}/${total} fields...</span>`;
      }
    },
  });
  
  if (statusEl) {
    statusEl.innerHTML = `<span class="success">✓ Filled ${filled} fields</span>`;
    if (failed.length > 0) {
      statusEl.innerHTML += `<br><span class="error">Could not fill: ${failed.join(', ')}</span>`;
    }
  }
}

// Handle preview
async function handlePreview() {
  const profile = await storage.getProfile();
  const preview = previewFill(detectedFields, profile);
  
  const previewHtml = preview.map(p => `
    <div class="preview-item">
      <strong>${p.label}</strong>
      <span>${p.value || '(empty)'}</span>
    </div>
  `).join('');
  
  const modal = document.createElement('div');
  modal.id = 'ai-job-applier-preview';
  modal.innerHTML = `
    <div class="preview-content">
      <h3>Preview Auto-Fill</h3>
      <div class="preview-list">${previewHtml}</div>
      <button class="ai-btn primary" id="confirm-fill">Fill Now</button>
      <button class="ai-btn secondary" id="cancel-fill">Cancel</button>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  modal.querySelector('#confirm-fill')?.addEventListener('click', async () => {
    modal.remove();
    await handleFillAll();
  });
  
  modal.querySelector('#cancel-fill')?.addEventListener('click', () => {
    modal.remove();
  });
}

// Handle messages from popup/background
function handleMessage(
  message: any, 
  sender: chrome.runtime.MessageSender, 
  sendResponse: (response: any) => void
) {
  switch (message.type) {
    case 'GET_FIELDS':
      sendResponse({ 
        fields: detectedFields.map(f => ({
          fieldType: f.fieldType,
          label: f.label,
          isRequired: f.isRequired,
        })),
        jobInfo: detectJobInfo(),
      });
      break;
      
    case 'FILL_ALL':
      handleFillAll().then(() => sendResponse({ success: true }));
      return true; // async response
      
    case 'FILL_FIELD':
      storage.getProfile().then(profile => {
        const field = detectedFields.find(f => f.label === message.label);
        if (field) {
          fillField(field, profile).then(success => sendResponse({ success }));
        }
      });
      return true;
      
    case 'REFRESH_DETECTION':
      detectedFields = detectFormFields();
      sendResponse({ count: detectedFields.length });
      break;
      
    case 'AUTO_APPLY':
      // Handle auto-apply from swarm mode
      handleAutoApply(message.config).then(result => {
        sendResponse({ result });
      });
      return true;
  }
}

// Handle auto-apply (for swarm mode and one-click)
async function handleAutoApply(config: any): Promise<any> {
  const profile = await storage.getProfile();
  const jobInfo = detectJobInfo();
  
  // Re-detect fields on fresh page
  detectedFields = detectFormFields();
  
  const result = {
    success: false,
    jobUrl: window.location.href,
    jobTitle: jobInfo.title || 'Unknown Position',
    company: jobInfo.company || 'Unknown Company',
    fieldsFilled: 0,
    totalFields: detectedFields.length,
    stoppedAtReview: false,
    submitted: false,
    errors: [] as string[],
    timestamp: new Date().toISOString(),
  };
  
  if (!profile.firstName || !profile.email) {
    result.errors.push('Profile incomplete');
    return result;
  }
  
  if (detectedFields.length === 0) {
    result.errors.push('No form fields detected');
    return result;
  }
  
  try {
    // Fill all fields
    const { filled, failed } = await fillAllFields(detectedFields, profile, {
      useAI: true,
    });
    
    result.fieldsFilled = filled;
    result.errors = failed;
    result.success = filled > 0;
    
    // Log the application
    await logApplication({
      id: generateId(),
      jobUrl: result.jobUrl,
      jobTitle: result.jobTitle,
      company: result.company,
      fieldsDetected: result.totalFields,
      fieldsFilled: result.fieldsFilled,
      fieldsSkipped: failed.length,
      status: result.success ? 'filled' : 'error',
      mode: config?.submitAutomatically ? 'full-auto' : 'one-click',
      stoppedAtReview: false,
      timestamp: result.timestamp,
      errors: result.errors,
      fieldDetails: detectedFields.map(f => ({
        fieldType: f.fieldType,
        label: f.label,
        filled: !failed.includes(f.label || f.fieldType),
      })),
    });
    
    // Check for review page and handle submission
    if (config?.submitAutomatically) {
      const submitBtn = findSubmitButton();
      if (submitBtn) {
        submitBtn.click();
        result.submitted = true;
      }
    } else {
      // Check if we should stop at review
      if (isReviewPage()) {
        result.stoppedAtReview = true;
        showReviewNotification(result);
      }
    }
    
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
  }
  
  return result;
}

// Find submit button on page
function findSubmitButton(): HTMLButtonElement | null {
  const selectors = [
    'button[type="submit"]',
    'input[type="submit"]',
    'button[data-qa="submit-button"]',
    'button[data-automation-id="submit"]',
    '#submit-btn',
    '.submit-button',
    'button.btn-submit',
  ];
  
  for (const selector of selectors) {
    const btn = document.querySelector<HTMLButtonElement>(selector);
    if (btn) return btn;
  }
  
  return null;
}

// Check if current page is a review page
function isReviewPage(): boolean {
  const pageText = document.body.innerText.toLowerCase();
  const reviewIndicators = [
    'review your application',
    'review application',
    'submit application',
    'confirm submission',
    'review and submit',
    'application summary',
  ];
  
  return reviewIndicators.some(indicator => pageText.includes(indicator));
}

// Show notification when stopped at review page
function showReviewNotification(result: any): void {
  const notification = document.createElement('div');
  notification.id = 'ai-apply-review-notification';
  notification.innerHTML = `
    <div style="
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      z-index: 9999999;
      max-width: 350px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    ">
      <h3 style="margin: 0 0 10px; font-size: 16px;">📋 Ready for Review</h3>
      <p style="margin: 5px 0; font-size: 14px;"><strong>${result.jobTitle}</strong></p>
      <p style="margin: 5px 0; font-size: 14px;">${result.company}</p>
      <p style="margin: 10px 0 0; font-size: 13px; opacity: 0.9;">
        Filled ${result.fieldsFilled}/${result.totalFields} fields
      </p>
      <button onclick="this.parentElement.parentElement.remove()" style="
        margin-top: 12px;
        padding: 8px 16px;
        background: white;
        color: #667eea;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 600;
      ">Got it</button>
    </div>
  `;
  document.body.appendChild(notification);
  
  // Auto-dismiss after 10 seconds
  setTimeout(() => notification.remove(), 10000);
}

// Initialize
init();
