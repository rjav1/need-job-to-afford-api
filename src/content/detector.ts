import { DetectedField, FieldType } from '../lib/types';

// Field detection patterns
const FIELD_PATTERNS: Record<FieldType, RegExp[]> = {
  firstName: [/first\s*name/i, /given\s*name/i, /fname/i, /^first$/i],
  lastName: [/last\s*name/i, /surname/i, /family\s*name/i, /lname/i, /^last$/i],
  fullName: [/full\s*name/i, /^name$/i, /your\s*name/i, /legal\s*name/i],
  email: [/e-?mail/i, /email\s*address/i],
  phone: [/phone/i, /mobile/i, /cell/i, /telephone/i, /contact\s*number/i],
  address: [/street\s*address/i, /address\s*line/i, /^address$/i, /mailing\s*address/i],
  city: [/^city$/i, /city\s*name/i],
  state: [/^state$/i, /province/i, /region/i],
  zipCode: [/zip/i, /postal/i, /post\s*code/i],
  country: [/country/i, /nation/i],
  linkedin: [/linkedin/i, /linked-in/i],
  github: [/github/i, /git-hub/i],
  portfolio: [/portfolio/i, /website/i, /personal\s*site/i, /url/i],
  university: [/university/i, /college/i, /school/i, /institution/i, /alma\s*mater/i],
  degree: [/degree/i, /qualification/i, /diploma/i],
  major: [/major/i, /field\s*of\s*study/i, /concentration/i, /specialization/i],
  gpa: [/gpa/i, /grade\s*point/i, /cumulative\s*gpa/i],
  graduationDate: [/graduat/i, /completion\s*date/i, /expected\s*graduat/i],
  workAuthorization: [/work\s*auth/i, /visa/i, /sponsor/i, /legal.*work/i, /authorized.*work/i, /citizenship/i],
  yearsOfExperience: [/years?\s*(of)?\s*experience/i, /experience\s*level/i, /how\s*many\s*years/i],
  resume: [/resume/i, /cv/i, /curriculum/i],
  coverLetter: [/cover\s*letter/i, /letter\s*of\s*interest/i],
  openEnded: [/why/i, /describe/i, /tell\s*us/i, /explain/i, /what\s*makes/i, /how\s*would/i],
  unknown: [],
};

// Detect field type from label text
function detectFieldType(labelText: string, inputType: string, inputName: string): { type: FieldType; confidence: number } {
  const text = `${labelText} ${inputName}`.toLowerCase();
  
  // Check for file inputs (resume)
  if (inputType === 'file') {
    if (/resume|cv/i.test(text)) return { type: 'resume', confidence: 0.95 };
    if (/cover/i.test(text)) return { type: 'coverLetter', confidence: 0.9 };
  }
  
  // Check each pattern
  for (const [fieldType, patterns] of Object.entries(FIELD_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        return { type: fieldType as FieldType, confidence: 0.85 };
      }
    }
  }
  
  // Check for textarea (likely open-ended)
  if (inputType === 'textarea' && text.length > 20) {
    return { type: 'openEnded', confidence: 0.7 };
  }
  
  return { type: 'unknown', confidence: 0 };
}

// Get label text for an input element
function getLabelText(element: HTMLElement): string {
  // Check for associated label
  const id = element.id;
  if (id) {
    const label = document.querySelector(`label[for="${id}"]`);
    if (label) return label.textContent?.trim() || '';
  }
  
  // Check for parent label
  const parentLabel = element.closest('label');
  if (parentLabel) {
    return parentLabel.textContent?.trim() || '';
  }
  
  // Check for aria-label
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel;
  
  // Check for placeholder
  const placeholder = element.getAttribute('placeholder');
  if (placeholder) return placeholder;
  
  // Check for nearby text (previous sibling, parent div with text)
  const parent = element.parentElement;
  if (parent) {
    const textNodes = Array.from(parent.childNodes)
      .filter(n => n.nodeType === Node.TEXT_NODE)
      .map(n => n.textContent?.trim())
      .filter(Boolean);
    if (textNodes.length) return textNodes[0] || '';
    
    // Check for span/div with label class
    const labelSpan = parent.querySelector('.label, .field-label, [class*="label"]');
    if (labelSpan) return labelSpan.textContent?.trim() || '';
  }
  
  return '';
}

// Main detection function
export function detectFormFields(): DetectedField[] {
  const fields: DetectedField[] = [];
  
  // Find all form inputs
  const inputs = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select'
  );
  
  for (const input of inputs) {
    // Skip invisible elements
    if (!isVisible(input)) continue;
    
    const label = getLabelText(input);
    const inputType = input.tagName.toLowerCase() === 'textarea' ? 'textarea' : 
                      (input as HTMLInputElement).type || 'text';
    const inputName = input.name || input.id || '';
    
    const { type, confidence } = detectFieldType(label, inputType, inputName);
    
    if (type !== 'unknown' || label) {
      fields.push({
        element: input,
        fieldType: type,
        label: label,
        isRequired: input.required || input.getAttribute('aria-required') === 'true',
        confidence,
      });
    }
  }
  
  return fields;
}

// Check if element is visible
function isVisible(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el);
  return style.display !== 'none' && 
         style.visibility !== 'hidden' && 
         style.opacity !== '0' &&
         el.offsetParent !== null;
}

// Detect job page info (company, title)
export function detectJobInfo(): { company: string; title: string } {
  const info = { company: '', title: '' };
  
  // LinkedIn
  if (window.location.hostname.includes('linkedin.com')) {
    info.company = document.querySelector('.jobs-unified-top-card__company-name')?.textContent?.trim() || 
                   document.querySelector('.topcard__org-name-link')?.textContent?.trim() || '';
    info.title = document.querySelector('.jobs-unified-top-card__job-title')?.textContent?.trim() ||
                 document.querySelector('.topcard__title')?.textContent?.trim() || '';
  }
  
  // Greenhouse
  if (window.location.hostname.includes('greenhouse.io')) {
    info.company = document.querySelector('.company-name')?.textContent?.trim() ||
                   document.querySelector('[class*="company"]')?.textContent?.trim() || '';
    info.title = document.querySelector('.app-title')?.textContent?.trim() ||
                 document.querySelector('h1')?.textContent?.trim() || '';
  }
  
  // Lever
  if (window.location.hostname.includes('lever.co')) {
    info.company = document.querySelector('.posting-headline h2')?.textContent?.trim() || '';
    info.title = document.querySelector('.posting-headline h2')?.textContent?.trim() || '';
  }
  
  // Workday
  if (window.location.hostname.includes('workday.com') || window.location.hostname.includes('myworkdayjobs.com')) {
    info.title = document.querySelector('[data-automation-id="jobPostingHeader"]')?.textContent?.trim() ||
                 document.querySelector('h1')?.textContent?.trim() || '';
  }
  
  // Fallback - try to get from page title
  if (!info.title && document.title) {
    info.title = document.title.split(' - ')[0].split(' | ')[0].trim();
  }
  
  return info;
}

// Get all open-ended questions (textareas with substantial labels)
export function detectOpenEndedQuestions(): DetectedField[] {
  return detectFormFields().filter(f => 
    f.fieldType === 'openEnded' || 
    (f.element.tagName === 'TEXTAREA' && f.label.length > 15)
  );
}
