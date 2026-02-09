/**
 * Application Logger
 * 
 * Comprehensive logging for every job application with detailed tracking.
 * Stores application history, field-level details, and analytics.
 */

import { generateId } from './storage';

// Storage key
const APPLICATIONS_LOG_KEY = 'applicationsLog';
const MAX_LOG_ENTRIES = 500;

// Application log entry with full details
export interface ApplicationLogEntry {
  id: string;
  jobUrl: string;
  jobTitle: string;
  company: string;
  
  // Field tracking
  fieldsDetected: number;
  fieldsFilled: number;
  fieldsSkipped: number;
  fieldDetails: FieldDetail[];
  
  // Status
  status: 'filled' | 'submitted' | 'error' | 'partial' | 'review-stopped';
  mode: 'manual' | 'one-click' | 'full-auto' | 'swarm';
  stoppedAtReview: boolean;
  
  // Timing
  timestamp: string;
  durationMs?: number;
  
  // Errors
  errors: string[];
  
  // User feedback (populated later)
  feedback?: ApplicationFeedback;
  
  // Source info
  source?: {
    platform: 'linkedin' | 'greenhouse' | 'lever' | 'workday' | 'other';
    pageTitle: string;
    domain: string;
  };
}

export interface FieldDetail {
  fieldType: string;
  label: string;
  filled: boolean;
  value?: string;  // Only stored if user opts in (privacy)
  aiGenerated?: boolean;
  confidence?: number;
}

export interface ApplicationFeedback {
  rating: 1 | 2 | 3 | 4 | 5;
  correctFields: string[];
  incorrectFields: string[];
  notes?: string;
  submittedAt: string;
}

// Analytics summary
export interface ApplicationAnalytics {
  totalApplications: number;
  successfulFills: number;
  submissions: number;
  errors: number;
  averageFieldsFilled: number;
  byPlatform: Record<string, number>;
  byCompany: Record<string, number>;
  byDate: Record<string, number>;
  topErrors: Array<{ error: string; count: number }>;
  fieldAccuracy: Record<string, { filled: number; correct: number }>;
}

/**
 * Log a new application
 */
export async function logApplication(entry: ApplicationLogEntry): Promise<void> {
  const logs = await getApplicationLogs();
  
  // Add source info if not provided
  if (!entry.source) {
    entry.source = {
      platform: detectPlatform(entry.jobUrl),
      pageTitle: typeof document !== 'undefined' ? document.title : '',
      domain: new URL(entry.jobUrl).hostname,
    };
  }
  
  // Ensure ID
  if (!entry.id) {
    entry.id = generateId();
  }
  
  // Add to beginning of array
  logs.unshift(entry);
  
  // Trim to max size
  if (logs.length > MAX_LOG_ENTRIES) {
    logs.length = MAX_LOG_ENTRIES;
  }
  
  await chrome.storage.local.set({ [APPLICATIONS_LOG_KEY]: logs });
  
  // Also send to webhook if enabled
  await sendLogWebhook(entry);
  
  console.log('[AI Job Applier] Application logged:', entry.jobTitle, '@', entry.company);
}

/**
 * Get all application logs
 */
export async function getApplicationLogs(): Promise<ApplicationLogEntry[]> {
  const result = await chrome.storage.local.get(APPLICATIONS_LOG_KEY);
  return result[APPLICATIONS_LOG_KEY] || [];
}

/**
 * Get application by ID
 */
export async function getApplicationById(id: string): Promise<ApplicationLogEntry | null> {
  const logs = await getApplicationLogs();
  return logs.find(log => log.id === id) || null;
}

/**
 * Update an existing application log entry
 */
export async function updateApplicationLog(
  id: string, 
  updates: Partial<ApplicationLogEntry>
): Promise<boolean> {
  const logs = await getApplicationLogs();
  const index = logs.findIndex(log => log.id === id);
  
  if (index === -1) return false;
  
  logs[index] = { ...logs[index], ...updates };
  await chrome.storage.local.set({ [APPLICATIONS_LOG_KEY]: logs });
  
  return true;
}

/**
 * Add feedback to an application
 */
export async function addApplicationFeedback(
  id: string,
  feedback: ApplicationFeedback
): Promise<boolean> {
  return updateApplicationLog(id, { feedback });
}

/**
 * Delete an application log entry
 */
export async function deleteApplicationLog(id: string): Promise<boolean> {
  const logs = await getApplicationLogs();
  const filtered = logs.filter(log => log.id !== id);
  
  if (filtered.length === logs.length) return false;
  
  await chrome.storage.local.set({ [APPLICATIONS_LOG_KEY]: filtered });
  return true;
}

/**
 * Clear all application logs
 */
export async function clearApplicationLogs(): Promise<void> {
  await chrome.storage.local.remove(APPLICATIONS_LOG_KEY);
}

/**
 * Get applications filtered by various criteria
 */
export async function queryApplications(query: {
  status?: ApplicationLogEntry['status'];
  mode?: ApplicationLogEntry['mode'];
  company?: string;
  platform?: string;
  startDate?: string;
  endDate?: string;
  hasErrors?: boolean;
  hasFeedback?: boolean;
  limit?: number;
}): Promise<ApplicationLogEntry[]> {
  let logs = await getApplicationLogs();
  
  if (query.status) {
    logs = logs.filter(log => log.status === query.status);
  }
  
  if (query.mode) {
    logs = logs.filter(log => log.mode === query.mode);
  }
  
  if (query.company) {
    const company = query.company.toLowerCase();
    logs = logs.filter(log => log.company.toLowerCase().includes(company));
  }
  
  if (query.platform) {
    logs = logs.filter(log => log.source?.platform === query.platform);
  }
  
  if (query.startDate) {
    logs = logs.filter(log => log.timestamp >= query.startDate!);
  }
  
  if (query.endDate) {
    logs = logs.filter(log => log.timestamp <= query.endDate!);
  }
  
  if (query.hasErrors !== undefined) {
    logs = logs.filter(log => 
      query.hasErrors ? log.errors.length > 0 : log.errors.length === 0
    );
  }
  
  if (query.hasFeedback !== undefined) {
    logs = logs.filter(log => 
      query.hasFeedback ? log.feedback !== undefined : log.feedback === undefined
    );
  }
  
  if (query.limit) {
    logs = logs.slice(0, query.limit);
  }
  
  return logs;
}

/**
 * Get analytics summary
 */
export async function getApplicationAnalytics(): Promise<ApplicationAnalytics> {
  const logs = await getApplicationLogs();
  
  const analytics: ApplicationAnalytics = {
    totalApplications: logs.length,
    successfulFills: logs.filter(l => l.status === 'filled' || l.status === 'submitted').length,
    submissions: logs.filter(l => l.status === 'submitted').length,
    errors: logs.filter(l => l.status === 'error').length,
    averageFieldsFilled: 0,
    byPlatform: {},
    byCompany: {},
    byDate: {},
    topErrors: [],
    fieldAccuracy: {},
  };
  
  // Calculate averages and distributions
  let totalFields = 0;
  const errorCounts: Record<string, number> = {};
  
  for (const log of logs) {
    totalFields += log.fieldsFilled;
    
    // By platform
    const platform = log.source?.platform || 'other';
    analytics.byPlatform[platform] = (analytics.byPlatform[platform] || 0) + 1;
    
    // By company
    analytics.byCompany[log.company] = (analytics.byCompany[log.company] || 0) + 1;
    
    // By date (YYYY-MM-DD)
    const date = log.timestamp.split('T')[0];
    analytics.byDate[date] = (analytics.byDate[date] || 0) + 1;
    
    // Errors
    for (const error of log.errors) {
      errorCounts[error] = (errorCounts[error] || 0) + 1;
    }
    
    // Field accuracy (if we have feedback)
    if (log.feedback) {
      for (const field of log.fieldDetails) {
        if (!analytics.fieldAccuracy[field.fieldType]) {
          analytics.fieldAccuracy[field.fieldType] = { filled: 0, correct: 0 };
        }
        analytics.fieldAccuracy[field.fieldType].filled++;
        if (log.feedback.correctFields.includes(field.fieldType)) {
          analytics.fieldAccuracy[field.fieldType].correct++;
        }
      }
    }
  }
  
  analytics.averageFieldsFilled = logs.length > 0 ? totalFields / logs.length : 0;
  
  // Sort and get top errors
  analytics.topErrors = Object.entries(errorCounts)
    .map(([error, count]) => ({ error, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  return analytics;
}

/**
 * Export logs as JSON
 */
export async function exportLogsAsJson(): Promise<string> {
  const logs = await getApplicationLogs();
  return JSON.stringify(logs, null, 2);
}

/**
 * Export logs as CSV
 */
export async function exportLogsAsCsv(): Promise<string> {
  const logs = await getApplicationLogs();
  
  const headers = [
    'ID',
    'Timestamp',
    'Job Title',
    'Company',
    'URL',
    'Platform',
    'Status',
    'Mode',
    'Fields Detected',
    'Fields Filled',
    'Fields Skipped',
    'Stopped at Review',
    'Errors',
    'Feedback Rating',
  ];
  
  const rows = logs.map(log => [
    log.id,
    log.timestamp,
    `"${log.jobTitle.replace(/"/g, '""')}"`,
    `"${log.company.replace(/"/g, '""')}"`,
    log.jobUrl,
    log.source?.platform || 'unknown',
    log.status,
    log.mode,
    log.fieldsDetected,
    log.fieldsFilled,
    log.fieldsSkipped,
    log.stoppedAtReview ? 'Yes' : 'No',
    `"${log.errors.join('; ').replace(/"/g, '""')}"`,
    log.feedback?.rating || '',
  ]);
  
  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

/**
 * Get recent applications (last N entries)
 */
export async function getRecentApplications(count: number = 10): Promise<ApplicationLogEntry[]> {
  const logs = await getApplicationLogs();
  return logs.slice(0, count);
}

/**
 * Get applications for today
 */
export async function getTodayApplications(): Promise<ApplicationLogEntry[]> {
  const today = new Date().toISOString().split('T')[0];
  return queryApplications({ startDate: today });
}

/**
 * Check if we've already applied to a job
 */
export async function hasAppliedTo(jobUrl: string): Promise<boolean> {
  const logs = await getApplicationLogs();
  return logs.some(log => 
    log.jobUrl === jobUrl && 
    (log.status === 'filled' || log.status === 'submitted')
  );
}

/**
 * Get application history for a company
 */
export async function getCompanyHistory(company: string): Promise<ApplicationLogEntry[]> {
  return queryApplications({ company });
}

// Helper functions
function detectPlatform(url: string): 'linkedin' | 'greenhouse' | 'lever' | 'workday' | 'other' {
  const hostname = new URL(url).hostname.toLowerCase();
  
  if (hostname.includes('linkedin.com')) return 'linkedin';
  if (hostname.includes('greenhouse.io')) return 'greenhouse';
  if (hostname.includes('lever.co')) return 'lever';
  if (hostname.includes('workday.com') || hostname.includes('myworkdayjobs.com')) return 'workday';
  
  return 'other';
}

/**
 * Send log entry to webhook (if configured)
 */
async function sendLogWebhook(entry: ApplicationLogEntry): Promise<void> {
  try {
    const result = await chrome.storage.local.get('settings');
    const settings = result.settings || {};
    
    if (!settings.webhookEnabled || !settings.webhookUrl) {
      return;
    }
    
    const statusEmoji = {
      'filled': '✅',
      'submitted': '🚀',
      'error': '❌',
      'partial': '⚠️',
      'review-stopped': '📋',
    };
    
    const statusColor = {
      'filled': 0x10b981,
      'submitted': 0x3b82f6,
      'error': 0xef4444,
      'partial': 0xf59e0b,
      'review-stopped': 0x8b5cf6,
    };
    
    const embed = {
      title: `${statusEmoji[entry.status]} ${entry.status.toUpperCase()}: ${entry.jobTitle}`,
      color: statusColor[entry.status],
      fields: [
        { name: '🏢 Company', value: entry.company, inline: true },
        { name: '📊 Mode', value: entry.mode, inline: true },
        { name: '📝 Fields', value: `${entry.fieldsFilled}/${entry.fieldsDetected}`, inline: true },
        { name: '🔗 URL', value: entry.jobUrl.slice(0, 100), inline: false },
      ],
      timestamp: entry.timestamp,
      footer: { text: `Platform: ${entry.source?.platform || 'unknown'}` },
    };
    
    if (entry.errors.length > 0) {
      embed.fields.push({
        name: '⚠️ Errors',
        value: entry.errors.slice(0, 3).join('\n').slice(0, 200),
        inline: false,
      });
    }
    
    await fetch(settings.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });
    
  } catch (error) {
    console.log('[AI Job Applier] Log webhook error:', error);
  }
}

// Export storage key for direct access if needed
export { APPLICATIONS_LOG_KEY };
