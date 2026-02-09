/**
 * Auto-Apply System
 * 
 * Orchestrates one-click apply, full auto mode, and swarm mode for job applications.
 * Handles navigation, form filling, and submission flow control.
 */

import { storage, generateId } from './storage';
import { UserProfile, ApplicationRecord, Settings } from './types';
import { detectFormFields, detectJobInfo } from '../content/detector';
import { fillAllFields } from '../content/filler';
import { logApplication, ApplicationLogEntry } from './application-logger';
import { recordFeedback, getFieldSuggestions } from './feedback-learner';

// Apply mode configuration
export type ApplyMode = 'manual' | 'one-click' | 'full-auto' | 'swarm';

export interface ApplyConfig {
  mode: ApplyMode;
  stopOnReview: boolean;  // Stop before final submit (default: true)
  submitAutomatically: boolean;  // Full auto mode submits without review
  delayBetweenJobs: number;  // Milliseconds between swarm applications
  maxApplications: number;  // Max jobs in swarm mode
  pauseOnError: boolean;  // Pause swarm on any error
}

export const DEFAULT_APPLY_CONFIG: ApplyConfig = {
  mode: 'one-click',
  stopOnReview: true,
  submitAutomatically: false,
  delayBetweenJobs: 3000,
  maxApplications: 10,
  pauseOnError: true,
};

// Application state tracking
export interface ApplyState {
  isRunning: boolean;
  currentJob: JobTarget | null;
  queue: JobTarget[];
  completed: string[];  // Job URLs
  failed: string[];
  progress: {
    total: number;
    completed: number;
    failed: number;
  };
  errors: ApplyError[];
}

export interface JobTarget {
  url: string;
  title: string;
  company: string;
  source: 'linkedin' | 'greenhouse' | 'lever' | 'workday' | 'other';
}

export interface ApplyError {
  jobUrl: string;
  error: string;
  timestamp: string;
  recoverable: boolean;
}

export interface ApplyResult {
  success: boolean;
  jobUrl: string;
  jobTitle: string;
  company: string;
  fieldsFilled: number;
  totalFields: number;
  stoppedAtReview: boolean;
  submitted: boolean;
  errors: string[];
  timestamp: string;
}

// Global state
let applyState: ApplyState = {
  isRunning: false,
  currentJob: null,
  queue: [],
  completed: [],
  failed: [],
  progress: { total: 0, completed: 0, failed: 0 },
  errors: [],
};

let applyConfig: ApplyConfig = { ...DEFAULT_APPLY_CONFIG };

// Event callbacks
type ApplyEventCallback = (event: ApplyEvent) => void;
let eventCallbacks: ApplyEventCallback[] = [];

export interface ApplyEvent {
  type: 'started' | 'progress' | 'completed' | 'failed' | 'paused' | 'review-stop' | 'swarm-next';
  data: any;
}

/**
 * Register event callback
 */
export function onApplyEvent(callback: ApplyEventCallback): () => void {
  eventCallbacks.push(callback);
  return () => {
    eventCallbacks = eventCallbacks.filter(cb => cb !== callback);
  };
}

function emitEvent(event: ApplyEvent): void {
  eventCallbacks.forEach(cb => cb(event));
}

/**
 * Get current apply state
 */
export function getApplyState(): ApplyState {
  return { ...applyState };
}

/**
 * Get current apply config
 */
export function getApplyConfig(): ApplyConfig {
  return { ...applyConfig };
}

/**
 * Update apply config
 */
export async function setApplyConfig(config: Partial<ApplyConfig>): Promise<void> {
  applyConfig = { ...applyConfig, ...config };
  await chrome.storage.local.set({ applyConfig });
}

/**
 * Load apply config from storage
 */
export async function loadApplyConfig(): Promise<ApplyConfig> {
  const result = await chrome.storage.local.get('applyConfig');
  applyConfig = { ...DEFAULT_APPLY_CONFIG, ...result.applyConfig };
  return applyConfig;
}

/**
 * One-Click Apply - Main entry point
 * 
 * Opens job page, fills all fields, stops at review page.
 */
export async function oneClickApply(jobUrl?: string): Promise<ApplyResult> {
  const profile = await storage.getProfile();
  
  if (!profile.firstName || !profile.email) {
    return createErrorResult('Profile incomplete - please fill in required fields');
  }
  
  applyState.isRunning = true;
  emitEvent({ type: 'started', data: { mode: 'one-click', url: jobUrl || window.location.href } });
  
  try {
    // If URL provided, navigate to it (handled by content script message)
    if (jobUrl && jobUrl !== window.location.href) {
      // Signal to open in new tab or navigate
      chrome.runtime.sendMessage({ 
        type: 'NAVIGATE_TO_JOB', 
        url: jobUrl 
      });
      // Wait for page load - actual filling happens via content script
      return createPendingResult(jobUrl);
    }
    
    // Fill current page
    return await fillCurrentPage(profile);
    
  } catch (error) {
    const errorResult = createErrorResult(
      error instanceof Error ? error.message : 'Unknown error during application'
    );
    
    applyState.errors.push({
      jobUrl: jobUrl || window.location.href,
      error: errorResult.errors[0],
      timestamp: new Date().toISOString(),
      recoverable: true,
    });
    
    emitEvent({ type: 'failed', data: errorResult });
    return errorResult;
    
  } finally {
    applyState.isRunning = false;
  }
}

/**
 * Fill the current page's form fields
 */
async function fillCurrentPage(profile: UserProfile): Promise<ApplyResult> {
  const jobInfo = detectJobInfo();
  const fields = detectFormFields();
  
  const result: ApplyResult = {
    success: false,
    jobUrl: window.location.href,
    jobTitle: jobInfo.title || 'Unknown Position',
    company: jobInfo.company || 'Unknown Company',
    fieldsFilled: 0,
    totalFields: fields.length,
    stoppedAtReview: false,
    submitted: false,
    errors: [],
    timestamp: new Date().toISOString(),
  };
  
  if (fields.length === 0) {
    result.errors.push('No form fields detected on this page');
    emitEvent({ type: 'failed', data: result });
    return result;
  }
  
  // Get learned suggestions for this company/job
  const suggestions = await getFieldSuggestions(result.company, result.jobTitle);
  
  // Fill all fields with progress tracking
  const { filled, failed } = await fillAllFields(fields, profile, {
    useAI: true,
    onProgress: (current, total) => {
      emitEvent({ 
        type: 'progress', 
        data: { current, total, jobTitle: result.jobTitle } 
      });
    },
  });
  
  result.fieldsFilled = filled;
  result.errors = failed;
  result.success = filled > 0;
  
  // Check if we're at a review/submit page
  const isReviewPage = detectReviewPage();
  
  if (isReviewPage) {
    if (applyConfig.stopOnReview && !applyConfig.submitAutomatically) {
      result.stoppedAtReview = true;
      showReviewStopNotification(result);
      emitEvent({ type: 'review-stop', data: result });
    } else if (applyConfig.submitAutomatically) {
      // Full auto mode - submit
      const submitted = await attemptSubmit();
      result.submitted = submitted;
    }
  }
  
  // Log the application
  await logApplication({
    id: generateId(),
    jobUrl: result.jobUrl,
    jobTitle: result.jobTitle,
    company: result.company,
    fieldsDetected: result.totalFields,
    fieldsFilled: result.fieldsFilled,
    fieldsSkipped: failed.length,
    status: result.success ? (result.submitted ? 'submitted' : 'filled') : 'error',
    mode: applyConfig.mode,
    stoppedAtReview: result.stoppedAtReview,
    timestamp: result.timestamp,
    errors: result.errors,
    fieldDetails: fields.map(f => ({
      fieldType: f.fieldType,
      label: f.label,
      filled: !failed.includes(f.label || f.fieldType),
    })),
  });
  
  emitEvent({ type: 'completed', data: result });
  return result;
}

/**
 * Full Auto Mode - Fill and submit without review
 */
export async function fullAutoApply(jobUrl?: string): Promise<ApplyResult> {
  const originalConfig = { ...applyConfig };
  
  // Temporarily enable auto-submit
  applyConfig.submitAutomatically = true;
  applyConfig.stopOnReview = false;
  
  try {
    const result = await oneClickApply(jobUrl);
    return result;
  } finally {
    // Restore original config
    applyConfig = originalConfig;
  }
}

/**
 * Swarm Mode - Apply to multiple jobs in sequence
 */
export async function swarmApply(jobs: JobTarget[]): Promise<ApplyResult[]> {
  if (applyState.isRunning) {
    throw new Error('Apply process already running');
  }
  
  const results: ApplyResult[] = [];
  
  applyState = {
    isRunning: true,
    currentJob: null,
    queue: [...jobs],
    completed: [],
    failed: [],
    progress: { total: jobs.length, completed: 0, failed: 0 },
    errors: [],
  };
  
  emitEvent({ type: 'started', data: { mode: 'swarm', total: jobs.length } });
  
  const profile = await storage.getProfile();
  
  for (let i = 0; i < Math.min(jobs.length, applyConfig.maxApplications); i++) {
    if (!applyState.isRunning) {
      // Paused or stopped
      break;
    }
    
    const job = applyState.queue[i];
    applyState.currentJob = job;
    
    emitEvent({ type: 'swarm-next', data: { job, index: i, total: jobs.length } });
    
    try {
      // Open job in new tab and apply
      const result = await applyToJob(job, profile);
      results.push(result);
      
      if (result.success) {
        applyState.completed.push(job.url);
        applyState.progress.completed++;
      } else {
        applyState.failed.push(job.url);
        applyState.progress.failed++;
        
        if (applyConfig.pauseOnError) {
          applyState.isRunning = false;
          emitEvent({ type: 'paused', data: { reason: 'error', job, error: result.errors } });
          break;
        }
      }
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      
      applyState.failed.push(job.url);
      applyState.progress.failed++;
      applyState.errors.push({
        jobUrl: job.url,
        error: errorMsg,
        timestamp: new Date().toISOString(),
        recoverable: true,
      });
      
      results.push(createErrorResult(errorMsg, job));
      
      if (applyConfig.pauseOnError) {
        applyState.isRunning = false;
        emitEvent({ type: 'paused', data: { reason: 'error', job, error: errorMsg } });
        break;
      }
    }
    
    // Delay between applications
    if (i < jobs.length - 1 && applyState.isRunning) {
      await sleep(applyConfig.delayBetweenJobs);
    }
  }
  
  applyState.isRunning = false;
  applyState.currentJob = null;
  
  emitEvent({ type: 'completed', data: { mode: 'swarm', results, state: applyState } });
  
  return results;
}

/**
 * Apply to a specific job (opens in new tab if needed)
 */
async function applyToJob(job: JobTarget, profile: UserProfile): Promise<ApplyResult> {
  // Message background to open tab and wait for result
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { 
        type: 'APPLY_TO_JOB', 
        job,
        config: applyConfig,
      },
      (response) => {
        if (response?.result) {
          resolve(response.result);
        } else {
          resolve(createErrorResult('Failed to apply - no response from content script', job));
        }
      }
    );
  });
}

/**
 * Pause swarm mode
 */
export function pauseSwarm(): void {
  if (applyState.isRunning) {
    applyState.isRunning = false;
    emitEvent({ type: 'paused', data: { reason: 'user', state: applyState } });
  }
}

/**
 * Resume swarm mode
 */
export async function resumeSwarm(): Promise<void> {
  if (!applyState.isRunning && applyState.queue.length > applyState.progress.completed + applyState.progress.failed) {
    const remainingJobs = applyState.queue.slice(applyState.progress.completed + applyState.progress.failed);
    await swarmApply(remainingJobs);
  }
}

/**
 * Stop and reset apply state
 */
export function stopApply(): void {
  applyState = {
    isRunning: false,
    currentJob: null,
    queue: [],
    completed: [],
    failed: [],
    progress: { total: 0, completed: 0, failed: 0 },
    errors: [],
  };
  emitEvent({ type: 'completed', data: { reason: 'stopped' } });
}

/**
 * Detect if current page is a review/submit page
 */
function detectReviewPage(): boolean {
  const pageText = document.body.innerText.toLowerCase();
  const reviewIndicators = [
    'review your application',
    'review application',
    'submit application',
    'confirm submission',
    'review and submit',
    'application summary',
    'ready to submit',
  ];
  
  // Check for submit buttons
  const submitButtons = document.querySelectorAll(
    'button[type="submit"], input[type="submit"], button:contains("Submit"), button:contains("Apply")'
  );
  
  const hasReviewText = reviewIndicators.some(indicator => pageText.includes(indicator));
  const hasSubmitButton = submitButtons.length > 0;
  
  // Also check for Greenhouse/Lever/Workday specific review pages
  const isGreenhouseReview = window.location.href.includes('greenhouse.io') && 
    (pageText.includes('review') || pageText.includes('submit'));
  const isLeverReview = window.location.href.includes('lever.co') && 
    document.querySelector('.application-confirmation, .postings-btn-wrapper');
  
  return hasReviewText || isGreenhouseReview || isLeverReview;
}

/**
 * Attempt to click submit button
 */
async function attemptSubmit(): Promise<boolean> {
  const submitSelectors = [
    'button[type="submit"]',
    'input[type="submit"]',
    'button[data-qa="submit-button"]',
    'button[data-automation-id="submit"]',
    '#submit-btn',
    '.submit-button',
    'button.btn-submit',
  ];
  
  for (const selector of submitSelectors) {
    const btn = document.querySelector<HTMLButtonElement | HTMLInputElement>(selector);
    if (btn && isVisible(btn)) {
      btn.click();
      await sleep(1000);
      
      // Check if submission was successful (page changed, success message, etc.)
      const success = detectSubmissionSuccess();
      return success;
    }
  }
  
  return false;
}

/**
 * Detect if submission was successful
 */
function detectSubmissionSuccess(): boolean {
  const successIndicators = [
    'application submitted',
    'thank you for applying',
    'application received',
    'successfully submitted',
    'we received your application',
    'thanks for applying',
  ];
  
  const pageText = document.body.innerText.toLowerCase();
  return successIndicators.some(indicator => pageText.includes(indicator));
}

/**
 * Show notification when stopped at review page
 */
function showReviewStopNotification(result: ApplyResult): void {
  const notification = document.createElement('div');
  notification.id = 'ai-apply-review-notification';
  notification.innerHTML = `
    <div class="review-notification-content">
      <h3>📋 Application Ready for Review</h3>
      <p><strong>${result.jobTitle}</strong> at <strong>${result.company}</strong></p>
      <p>Filled ${result.fieldsFilled}/${result.totalFields} fields</p>
      <p class="review-hint">Review your application and click Submit when ready.</p>
      <div class="review-actions">
        <button id="review-submit-auto" class="ai-btn primary">Submit Now</button>
        <button id="review-close" class="ai-btn secondary">I'll Review First</button>
      </div>
    </div>
  `;
  
  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    #ai-apply-review-notification {
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
      animation: slideIn 0.3s ease;
    }
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    .review-notification-content h3 {
      margin: 0 0 10px;
      font-size: 16px;
    }
    .review-notification-content p {
      margin: 5px 0;
      font-size: 14px;
      opacity: 0.9;
    }
    .review-hint {
      margin-top: 10px !important;
      font-style: italic;
    }
    .review-actions {
      display: flex;
      gap: 10px;
      margin-top: 15px;
    }
    .review-actions .ai-btn {
      flex: 1;
      padding: 10px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
    }
    .review-actions .ai-btn.primary {
      background: white;
      color: #667eea;
    }
    .review-actions .ai-btn.secondary {
      background: rgba(255,255,255,0.2);
      color: white;
    }
  `;
  notification.appendChild(style);
  document.body.appendChild(notification);
  
  // Event handlers
  notification.querySelector('#review-submit-auto')?.addEventListener('click', async () => {
    const submitted = await attemptSubmit();
    notification.remove();
    if (submitted) {
      showSuccessToast('Application submitted successfully!');
    }
  });
  
  notification.querySelector('#review-close')?.addEventListener('click', () => {
    notification.remove();
  });
  
  // Auto-dismiss after 30 seconds
  setTimeout(() => {
    notification.remove();
  }, 30000);
}

/**
 * Show success toast notification
 */
function showSuccessToast(message: string): void {
  const toast = document.createElement('div');
  toast.className = 'ai-apply-toast success';
  toast.textContent = `✅ ${message}`;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #10b981;
    color: white;
    padding: 15px 20px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    z-index: 9999999;
    animation: fadeIn 0.3s ease;
  `;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 5000);
}

// Helper functions
function createErrorResult(error: string, job?: JobTarget): ApplyResult {
  return {
    success: false,
    jobUrl: job?.url || window.location.href,
    jobTitle: job?.title || 'Unknown',
    company: job?.company || 'Unknown',
    fieldsFilled: 0,
    totalFields: 0,
    stoppedAtReview: false,
    submitted: false,
    errors: [error],
    timestamp: new Date().toISOString(),
  };
}

function createPendingResult(jobUrl: string): ApplyResult {
  return {
    success: true,
    jobUrl,
    jobTitle: 'Pending...',
    company: 'Pending...',
    fieldsFilled: 0,
    totalFields: 0,
    stoppedAtReview: false,
    submitted: false,
    errors: [],
    timestamp: new Date().toISOString(),
  };
}

function isVisible(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el);
  return style.display !== 'none' && 
         style.visibility !== 'hidden' && 
         style.opacity !== '0' &&
         el.offsetParent !== null;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Export for content script integration
export {
  detectReviewPage,
  attemptSubmit,
  fillCurrentPage,
};
