import { DetectedField, UserProfile, FieldType } from '../lib/types';
import { storage } from '../lib/storage';
import { generateAIResponse, TestModeError } from '../lib/ai';
import { detectJobInfo } from './detector';

// Fill a single field with the appropriate value
export async function fillField(
  field: DetectedField, 
  profile: UserProfile,
  options: { useAI: boolean } = { useAI: true }
): Promise<boolean> {
  const value = getFieldValue(field.fieldType, profile);
  
  if (value !== null) {
    setInputValue(field.element, value);
    return true;
  }
  
  // For open-ended questions, use AI
  if (field.fieldType === 'openEnded' && options.useAI) {
    const jobInfo = detectJobInfo();
    try {
      const response = await generateAIResponse({
        question: field.label,
        companyName: jobInfo.company,
        jobTitle: jobInfo.title,
        userProfile: profile,
      });
      setInputValue(field.element, response);
      return true;
    } catch (error) {
      // Handle test mode - show Discord prompt
      if (error instanceof TestModeError) {
        showTestModeDialog(error, field.element);
        return false;
      }
      console.error('AI response error:', error);
      return false;
    }
  }
  
  return false;
}

// Show dialog for test mode (Discord-based AI)
function showTestModeDialog(error: TestModeError, targetElement: HTMLElement): void {
  const existing = document.getElementById('ai-job-applier-test-dialog');
  if (existing) existing.remove();
  
  const dialog = document.createElement('div');
  dialog.id = 'ai-job-applier-test-dialog';
  dialog.innerHTML = `
    <div class="test-dialog-content">
      <h3>🧪 Test Mode - Discord AI</h3>
      <p>Copy this to Discord <strong>#job-applier-ai</strong> channel:</p>
      <textarea id="discord-request" readonly>${error.discordMessage}</textarea>
      <button id="copy-discord-btn" class="ai-btn primary">📋 Copy to Clipboard</button>
      
      <hr>
      
      <p>Then paste Ronald's response here:</p>
      <textarea id="ai-response-input" placeholder="Paste the AI response here..."></textarea>
      <button id="use-response-btn" class="ai-btn primary">✅ Use This Response</button>
      
      ${error.templateFallback ? `
        <hr>
        <p>Or use the template response:</p>
        <button id="use-template-btn" class="ai-btn secondary">📝 Use Template Instead</button>
      ` : ''}
      
      <button id="close-dialog-btn" class="ai-btn secondary">❌ Cancel</button>
    </div>
  `;
  
  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    #ai-job-applier-test-dialog {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .test-dialog-content {
      background: white;
      padding: 24px;
      border-radius: 16px;
      max-width: 600px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
    }
    .test-dialog-content h3 {
      margin: 0 0 16px;
      color: #667eea;
    }
    .test-dialog-content p {
      margin: 8px 0;
      color: #475569;
      font-size: 14px;
    }
    .test-dialog-content textarea {
      width: 100%;
      min-height: 100px;
      padding: 12px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font-size: 13px;
      margin: 8px 0;
      resize: vertical;
    }
    .test-dialog-content hr {
      border: none;
      border-top: 1px solid #e2e8f0;
      margin: 16px 0;
    }
    .test-dialog-content .ai-btn {
      display: block;
      width: 100%;
      padding: 12px;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      cursor: pointer;
      margin: 8px 0;
    }
    .test-dialog-content .ai-btn.primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .test-dialog-content .ai-btn.secondary {
      background: #f1f5f9;
      color: #475569;
    }
  `;
  dialog.appendChild(style);
  document.body.appendChild(dialog);
  
  // Event handlers
  dialog.querySelector('#copy-discord-btn')?.addEventListener('click', () => {
    navigator.clipboard.writeText(error.discordMessage);
    (dialog.querySelector('#copy-discord-btn') as HTMLElement).textContent = '✅ Copied!';
  });
  
  dialog.querySelector('#use-response-btn')?.addEventListener('click', () => {
    const response = (dialog.querySelector('#ai-response-input') as HTMLTextAreaElement).value;
    if (response.trim()) {
      setInputValue(targetElement as any, response.trim());
      highlightField(targetElement, 'success');
      dialog.remove();
    }
  });
  
  dialog.querySelector('#use-template-btn')?.addEventListener('click', () => {
    if (error.templateFallback) {
      setInputValue(targetElement as any, error.templateFallback);
      highlightField(targetElement, 'success');
      dialog.remove();
    }
  });
  
  dialog.querySelector('#close-dialog-btn')?.addEventListener('click', () => {
    dialog.remove();
  });
}

// Get value from profile for a field type
function getFieldValue(fieldType: FieldType, profile: UserProfile): string | null {
  const mapping: Partial<Record<FieldType, string>> = {
    firstName: profile.firstName,
    lastName: profile.lastName,
    fullName: `${profile.firstName} ${profile.lastName}`.trim(),
    email: profile.email,
    phone: profile.phone,
    address: profile.address,
    city: profile.city,
    state: profile.state,
    zipCode: profile.zipCode,
    country: profile.country,
    linkedin: profile.linkedinUrl,
    github: profile.githubUrl,
    portfolio: profile.portfolioUrl,
    university: profile.university,
    degree: profile.degree,
    major: profile.major,
    gpa: profile.gpa,
    graduationDate: profile.graduationDate,
    yearsOfExperience: profile.yearsOfExperience,
  };
  
  return mapping[fieldType] || null;
}

// Smart fallback mappings for common fields
const SMART_FALLBACKS: Record<string, string[]> = {
  // Major fallbacks
  'computer engineering': ['computer science', 'electrical engineering', 'software engineering', 'engineering'],
  'software engineering': ['computer science', 'computer engineering', 'information technology'],
  'data science': ['computer science', 'statistics', 'mathematics', 'applied mathematics'],
  'information systems': ['information technology', 'computer science', 'business'],
  
  // Degree fallbacks  
  'bachelor of science': ['bs', 'b.s.', 'bachelors', 'undergraduate'],
  'bachelor of arts': ['ba', 'b.a.', 'bachelors', 'undergraduate'],
  'master of science': ['ms', 'm.s.', 'masters', 'graduate'],
  
  // Work auth fallbacks
  'us citizen': ['citizen', 'authorized', 'yes', 'no sponsorship required'],
  'permanent resident': ['green card', 'authorized', 'yes', 'no sponsorship required'],
  
  // Yes/No smart answers
  'yes': ['true', '1', 'agree', 'accept'],
  'no': ['false', '0', 'disagree', 'decline'],
};

// Find best matching option in a select dropdown
function findBestOption(options: HTMLOptionElement[], targetValue: string): HTMLOptionElement | null {
  const target = targetValue.toLowerCase().trim();
  
  // 1. Exact match
  let match = options.find(opt => 
    opt.value.toLowerCase() === target || 
    opt.text.toLowerCase() === target
  );
  if (match) return match;
  
  // 2. Contains match
  match = options.find(opt => 
    opt.value.toLowerCase().includes(target) ||
    opt.text.toLowerCase().includes(target) ||
    target.includes(opt.value.toLowerCase()) ||
    target.includes(opt.text.toLowerCase())
  );
  if (match) return match;
  
  // 3. Smart fallbacks
  const fallbacks = SMART_FALLBACKS[target] || [];
  for (const fallback of fallbacks) {
    match = options.find(opt => 
      opt.value.toLowerCase().includes(fallback) ||
      opt.text.toLowerCase().includes(fallback)
    );
    if (match) return match;
  }
  
  // 4. Fuzzy match - find option with most word overlap
  const targetWords = target.split(/\s+/);
  let bestMatch: HTMLOptionElement | null = null;
  let bestScore = 0;
  
  for (const opt of options) {
    const optText = (opt.value + ' ' + opt.text).toLowerCase();
    const optWords = optText.split(/\s+/);
    const overlap = targetWords.filter(w => optWords.some(ow => ow.includes(w) || w.includes(ow))).length;
    if (overlap > bestScore) {
      bestScore = overlap;
      bestMatch = opt;
    }
  }
  
  if (bestScore > 0) return bestMatch;
  
  return null;
}

// Set value on input element (handles different input types)
function setInputValue(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, 
  value: string
): void {
  // Dispatch events to trigger any validation/listeners
  const inputEvent = new Event('input', { bubbles: true });
  const changeEvent = new Event('change', { bubbles: true });
  
  if (element instanceof HTMLSelectElement) {
    // For select, use smart matching
    const options = Array.from(element.options).filter(opt => opt.value); // exclude empty options
    const match = findBestOption(options, value);
    if (match) {
      element.value = match.value;
      console.log(`[AI Job Applier] Selected "${match.text}" for value "${value}"`);
    } else {
      console.log(`[AI Job Applier] No match found for "${value}" in dropdown`);
    }
  } else {
    element.value = value;
  }
  
  element.dispatchEvent(inputEvent);
  element.dispatchEvent(changeEvent);
  
  // For React apps, we might need to trigger React's synthetic events
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    element.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 
    'value'
  )?.set;
  
  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

// Fill all detected fields
export async function fillAllFields(
  fields: DetectedField[],
  profile: UserProfile,
  options: { useAI: boolean; onProgress?: (filled: number, total: number) => void } = { useAI: true }
): Promise<{ filled: number; failed: string[] }> {
  let filled = 0;
  const failed: string[] = [];
  
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    
    // Skip unknown fields
    if (field.fieldType === 'unknown') continue;
    
    // Skip file inputs (resume upload needs special handling)
    if (field.element.type === 'file') continue;
    
    const success = await fillField(field, profile, options);
    
    if (success) {
      filled++;
      highlightField(field.element, 'success');
    } else {
      failed.push(field.label || field.fieldType);
      highlightField(field.element, 'error');
    }
    
    options.onProgress?.(i + 1, fields.length);
    
    // Small delay between fields to avoid rate limiting / detection
    await sleep(100);
  }
  
  return { filled, failed };
}

// Highlight field to show status
function highlightField(element: HTMLElement, status: 'success' | 'error' | 'pending'): void {
  const colors = {
    success: '#10b981',  // green
    error: '#ef4444',    // red
    pending: '#f59e0b',  // yellow
  };
  
  element.style.boxShadow = `0 0 0 2px ${colors[status]}`;
  element.style.transition = 'box-shadow 0.3s ease';
  
  // Remove highlight after 3 seconds
  setTimeout(() => {
    element.style.boxShadow = '';
  }, 3000);
}

// Sleep helper
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Preview what would be filled (without actually filling)
export function previewFill(
  fields: DetectedField[],
  profile: UserProfile
): Array<{ label: string; value: string; fieldType: FieldType }> {
  return fields
    .filter(f => f.fieldType !== 'unknown')
    .map(field => {
      const value = getFieldValue(field.fieldType, profile);
      return {
        label: field.label || field.fieldType,
        value: value || (field.fieldType === 'openEnded' ? '[AI Generated]' : '[Unknown]'),
        fieldType: field.fieldType,
      };
    });
}
