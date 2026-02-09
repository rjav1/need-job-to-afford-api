/**
 * Feedback Learner
 * 
 * Learns from user corrections to improve form filling accuracy over time.
 * Stores field patterns, company-specific preferences, and common corrections.
 */

import { FieldType } from './types';

// Storage keys
const FEEDBACK_DATA_KEY = 'feedbackData';
const FIELD_PATTERNS_KEY = 'fieldPatterns';
const COMPANY_PREFERENCES_KEY = 'companyPreferences';

// Feedback entry for a single field correction
export interface FieldFeedback {
  fieldType: FieldType;
  fieldLabel: string;
  originalValue: string;
  correctedValue: string;
  company?: string;
  jobTitle?: string;
  timestamp: string;
  accepted: boolean;  // True if original was accepted, false if corrected
}

// Aggregated field pattern
export interface FieldPattern {
  fieldType: FieldType;
  patterns: PatternEntry[];
  preferredValues: string[];
  commonCorrections: CorrectionEntry[];
  successRate: number;
  totalOccurrences: number;
}

export interface PatternEntry {
  label: string;
  count: number;
  lastSeen: string;
}

export interface CorrectionEntry {
  original: string;
  corrected: string;
  count: number;
  context?: string;  // Company or job context where this correction was made
}

// Company-specific preferences
export interface CompanyPreferences {
  company: string;
  fieldOverrides: Record<string, string>;  // fieldType -> preferred value
  notes: string[];
  applicationCount: number;
  lastApplied: string;
}

// Learning data store
export interface FeedbackStore {
  feedback: FieldFeedback[];
  fieldPatterns: Record<string, FieldPattern>;
  companyPreferences: Record<string, CompanyPreferences>;
  lastUpdated: string;
}

/**
 * Record feedback for a field fill
 */
export async function recordFeedback(feedback: FieldFeedback): Promise<void> {
  const store = await getFeedbackStore();
  
  // Add to feedback history
  store.feedback.unshift(feedback);
  
  // Limit feedback history
  if (store.feedback.length > 1000) {
    store.feedback.length = 1000;
  }
  
  // Update field patterns
  updateFieldPattern(store, feedback);
  
  // Update company preferences if company is specified
  if (feedback.company) {
    updateCompanyPreferences(store, feedback);
  }
  
  store.lastUpdated = new Date().toISOString();
  await saveFeedbackStore(store);
  
  console.log('[AI Job Applier] Feedback recorded:', feedback.fieldType, 
    feedback.accepted ? 'accepted' : 'corrected');
}

/**
 * Record that user accepted a field value (implicit positive feedback)
 */
export async function recordAcceptance(
  fieldType: FieldType,
  fieldLabel: string,
  value: string,
  company?: string,
  jobTitle?: string
): Promise<void> {
  await recordFeedback({
    fieldType,
    fieldLabel,
    originalValue: value,
    correctedValue: value,
    company,
    jobTitle,
    timestamp: new Date().toISOString(),
    accepted: true,
  });
}

/**
 * Record that user corrected a field value
 */
export async function recordCorrection(
  fieldType: FieldType,
  fieldLabel: string,
  originalValue: string,
  correctedValue: string,
  company?: string,
  jobTitle?: string
): Promise<void> {
  await recordFeedback({
    fieldType,
    fieldLabel,
    originalValue,
    correctedValue,
    company,
    jobTitle,
    timestamp: new Date().toISOString(),
    accepted: false,
  });
}

/**
 * Get suggestion for a field based on learned patterns
 */
export async function getFieldSuggestion(
  fieldType: FieldType,
  fieldLabel: string,
  company?: string
): Promise<string | null> {
  const store = await getFeedbackStore();
  
  // Check company-specific override first
  if (company) {
    const companyPrefs = store.companyPreferences[company.toLowerCase()];
    if (companyPrefs?.fieldOverrides[fieldType]) {
      return companyPrefs.fieldOverrides[fieldType];
    }
  }
  
  // Check for common corrections matching this label
  const pattern = store.fieldPatterns[fieldType];
  if (pattern) {
    // Look for a recent correction that matches the label
    const matchingCorrection = pattern.commonCorrections.find(c => 
      fieldLabel.toLowerCase().includes(c.context?.toLowerCase() || '') ||
      c.count >= 3  // High confidence correction
    );
    
    if (matchingCorrection) {
      return matchingCorrection.corrected;
    }
    
    // Return most preferred value if high success rate
    if (pattern.preferredValues.length > 0 && pattern.successRate > 0.8) {
      return pattern.preferredValues[0];
    }
  }
  
  return null;
}

/**
 * Get all suggestions for a company/job
 */
export async function getFieldSuggestions(
  company?: string,
  jobTitle?: string
): Promise<Record<string, string>> {
  const store = await getFeedbackStore();
  const suggestions: Record<string, string> = {};
  
  // Company-specific overrides take priority
  if (company) {
    const companyPrefs = store.companyPreferences[company.toLowerCase()];
    if (companyPrefs?.fieldOverrides) {
      Object.assign(suggestions, companyPrefs.fieldOverrides);
    }
  }
  
  // Add high-confidence pattern suggestions
  for (const [fieldType, pattern] of Object.entries(store.fieldPatterns)) {
    if (!suggestions[fieldType] && pattern.preferredValues.length > 0) {
      // Only suggest if high success rate
      if (pattern.successRate > 0.75 && pattern.totalOccurrences >= 5) {
        suggestions[fieldType] = pattern.preferredValues[0];
      }
    }
  }
  
  return suggestions;
}

/**
 * Get company preferences
 */
export async function getCompanyPreferences(company: string): Promise<CompanyPreferences | null> {
  const store = await getFeedbackStore();
  return store.companyPreferences[company.toLowerCase()] || null;
}

/**
 * Set company-specific field override
 */
export async function setCompanyFieldOverride(
  company: string,
  fieldType: string,
  value: string
): Promise<void> {
  const store = await getFeedbackStore();
  const key = company.toLowerCase();
  
  if (!store.companyPreferences[key]) {
    store.companyPreferences[key] = {
      company,
      fieldOverrides: {},
      notes: [],
      applicationCount: 0,
      lastApplied: new Date().toISOString(),
    };
  }
  
  store.companyPreferences[key].fieldOverrides[fieldType] = value;
  store.lastUpdated = new Date().toISOString();
  
  await saveFeedbackStore(store);
}

/**
 * Add a note for a company
 */
export async function addCompanyNote(company: string, note: string): Promise<void> {
  const store = await getFeedbackStore();
  const key = company.toLowerCase();
  
  if (!store.companyPreferences[key]) {
    store.companyPreferences[key] = {
      company,
      fieldOverrides: {},
      notes: [],
      applicationCount: 0,
      lastApplied: new Date().toISOString(),
    };
  }
  
  store.companyPreferences[key].notes.push(`${new Date().toISOString()}: ${note}`);
  store.lastUpdated = new Date().toISOString();
  
  await saveFeedbackStore(store);
}

/**
 * Get field patterns statistics
 */
export async function getFieldStats(): Promise<Record<string, {
  successRate: number;
  corrections: number;
  acceptances: number;
}>> {
  const store = await getFeedbackStore();
  const stats: Record<string, any> = {};
  
  for (const [fieldType, pattern] of Object.entries(store.fieldPatterns)) {
    const corrections = pattern.commonCorrections.reduce((sum, c) => sum + c.count, 0);
    const acceptances = pattern.totalOccurrences - corrections;
    
    stats[fieldType] = {
      successRate: pattern.successRate,
      corrections,
      acceptances,
    };
  }
  
  return stats;
}

/**
 * Get learning insights
 */
export async function getLearningInsights(): Promise<{
  totalFeedback: number;
  companiesLearned: number;
  fieldsOptimized: number;
  topCorrections: CorrectionEntry[];
  recentActivity: string[];
}> {
  const store = await getFeedbackStore();
  
  // Get all corrections sorted by count
  const allCorrections: CorrectionEntry[] = [];
  for (const pattern of Object.values(store.fieldPatterns)) {
    allCorrections.push(...pattern.commonCorrections);
  }
  allCorrections.sort((a, b) => b.count - a.count);
  
  // Recent activity (last 5 feedback items)
  const recentActivity = store.feedback.slice(0, 5).map(f => 
    `${f.accepted ? '✓' : '✏️'} ${f.fieldType}: ${f.accepted ? f.originalValue : `${f.originalValue} → ${f.correctedValue}`}`
  );
  
  // Count fields with good success rate
  const fieldsOptimized = Object.values(store.fieldPatterns).filter(p => 
    p.successRate > 0.8 && p.totalOccurrences >= 5
  ).length;
  
  return {
    totalFeedback: store.feedback.length,
    companiesLearned: Object.keys(store.companyPreferences).length,
    fieldsOptimized,
    topCorrections: allCorrections.slice(0, 10),
    recentActivity,
  };
}

/**
 * Clear all learning data
 */
export async function clearLearningData(): Promise<void> {
  await chrome.storage.local.remove([
    FEEDBACK_DATA_KEY,
    FIELD_PATTERNS_KEY,
    COMPANY_PREFERENCES_KEY,
  ]);
}

/**
 * Export learning data for backup
 */
export async function exportLearningData(): Promise<string> {
  const store = await getFeedbackStore();
  return JSON.stringify(store, null, 2);
}

/**
 * Import learning data from backup
 */
export async function importLearningData(jsonData: string): Promise<boolean> {
  try {
    const data = JSON.parse(jsonData);
    if (data.feedback && data.fieldPatterns && data.companyPreferences) {
      await saveFeedbackStore(data);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// Internal functions

function updateFieldPattern(store: FeedbackStore, feedback: FieldFeedback): void {
  const key = feedback.fieldType;
  
  if (!store.fieldPatterns[key]) {
    store.fieldPatterns[key] = {
      fieldType: feedback.fieldType,
      patterns: [],
      preferredValues: [],
      commonCorrections: [],
      successRate: 1,
      totalOccurrences: 0,
    };
  }
  
  const pattern = store.fieldPatterns[key];
  pattern.totalOccurrences++;
  
  // Update patterns (label variations)
  const existingPattern = pattern.patterns.find(p => 
    p.label.toLowerCase() === feedback.fieldLabel.toLowerCase()
  );
  
  if (existingPattern) {
    existingPattern.count++;
    existingPattern.lastSeen = feedback.timestamp;
  } else {
    pattern.patterns.push({
      label: feedback.fieldLabel,
      count: 1,
      lastSeen: feedback.timestamp,
    });
  }
  
  // Update success rate and corrections
  if (feedback.accepted) {
    // Successful fill - track preferred value
    const valueIndex = pattern.preferredValues.indexOf(feedback.originalValue);
    if (valueIndex === -1) {
      pattern.preferredValues.push(feedback.originalValue);
    } else {
      // Move to front (most recently confirmed)
      pattern.preferredValues.splice(valueIndex, 1);
      pattern.preferredValues.unshift(feedback.originalValue);
    }
  } else {
    // Correction - track the correction
    const existingCorrection = pattern.commonCorrections.find(c => 
      c.original === feedback.originalValue && 
      c.corrected === feedback.correctedValue
    );
    
    if (existingCorrection) {
      existingCorrection.count++;
    } else {
      pattern.commonCorrections.push({
        original: feedback.originalValue,
        corrected: feedback.correctedValue,
        count: 1,
        context: feedback.company,
      });
    }
    
    // Add corrected value to preferred values
    if (!pattern.preferredValues.includes(feedback.correctedValue)) {
      pattern.preferredValues.unshift(feedback.correctedValue);
    }
  }
  
  // Recalculate success rate
  const totalCorrections = pattern.commonCorrections.reduce((sum, c) => sum + c.count, 0);
  pattern.successRate = 1 - (totalCorrections / pattern.totalOccurrences);
  
  // Limit arrays
  pattern.patterns = pattern.patterns.slice(0, 20);
  pattern.preferredValues = pattern.preferredValues.slice(0, 10);
  pattern.commonCorrections = pattern.commonCorrections
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}

function updateCompanyPreferences(store: FeedbackStore, feedback: FieldFeedback): void {
  if (!feedback.company) return;
  
  const key = feedback.company.toLowerCase();
  
  if (!store.companyPreferences[key]) {
    store.companyPreferences[key] = {
      company: feedback.company,
      fieldOverrides: {},
      notes: [],
      applicationCount: 0,
      lastApplied: feedback.timestamp,
    };
  }
  
  const prefs = store.companyPreferences[key];
  prefs.lastApplied = feedback.timestamp;
  
  // If user corrected a value, save it as company-specific override
  if (!feedback.accepted) {
    prefs.fieldOverrides[feedback.fieldType] = feedback.correctedValue;
  }
}

async function getFeedbackStore(): Promise<FeedbackStore> {
  const result = await chrome.storage.local.get(FEEDBACK_DATA_KEY);
  return result[FEEDBACK_DATA_KEY] || {
    feedback: [],
    fieldPatterns: {},
    companyPreferences: {},
    lastUpdated: new Date().toISOString(),
  };
}

async function saveFeedbackStore(store: FeedbackStore): Promise<void> {
  await chrome.storage.local.set({ [FEEDBACK_DATA_KEY]: store });
}

// Export storage keys for testing/debugging
export { FEEDBACK_DATA_KEY, FIELD_PATTERNS_KEY, COMPANY_PREFERENCES_KEY };
