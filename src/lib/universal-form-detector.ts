/**
 * Universal Form Detector - AI-powered form analysis for ANY job application site
 * Uses DOM analysis + AI vision to understand unknown forms
 */

import { DetectedField, FieldType } from './types';
import { storage } from './storage';
import { analyzeDOMForForms, DOMElement, FormContext, getDOMSnapshot, findActualInput } from './dom-analyzer';
import { formMemory, createSelectorFromElement, FieldSelector } from './form-memory';

export interface UniversalDetectionResult {
  fields: DetectedField[];
  context: FormContext;
  isKnownSite: boolean;
  atsType?: string;
  confidence: number;
  suggestedHints?: string[];
}

export interface AIFieldAnalysis {
  fieldType: FieldType;
  confidence: number;
  reasoning: string;
}

// Extended field patterns for universal detection
const UNIVERSAL_FIELD_PATTERNS: Record<FieldType, { patterns: RegExp[]; weight: number }> = {
  firstName: {
    patterns: [
      /first\s*name/i, /given\s*name/i, /fname/i, /^first$/i, /nombre/i,
      /forename/i, /vorname/i, /prénom/i
    ],
    weight: 0.9
  },
  lastName: {
    patterns: [
      /last\s*name/i, /surname/i, /family\s*name/i, /lname/i, /^last$/i,
      /apellido/i, /nachname/i, /nom\s*de\s*famille/i
    ],
    weight: 0.9
  },
  fullName: {
    patterns: [
      /full\s*name/i, /^name$/i, /your\s*name/i, /legal\s*name/i,
      /complete\s*name/i, /applicant\s*name/i, /candidate\s*name/i
    ],
    weight: 0.85
  },
  email: {
    patterns: [
      /e-?mail/i, /email\s*address/i, /correo/i, /courriel/i,
      /electronic\s*mail/i
    ],
    weight: 0.95
  },
  phone: {
    patterns: [
      /phone/i, /mobile/i, /cell/i, /telephone/i, /contact\s*number/i,
      /tel[eé]fono/i, /nummer/i, /numéro/i, /\+1/i, /\(\d{3}\)/i
    ],
    weight: 0.9
  },
  address: {
    patterns: [
      /street\s*address/i, /address\s*line/i, /^address$/i, /mailing\s*address/i,
      /home\s*address/i, /residential\s*address/i, /street\s*1/i, /address\s*1/i
    ],
    weight: 0.85
  },
  city: {
    patterns: [/^city$/i, /city\s*name/i, /ciudad/i, /ville/i, /stadt/i, /town/i],
    weight: 0.85
  },
  state: {
    patterns: [
      /^state$/i, /province/i, /region/i, /estado/i, /bundesland/i,
      /state\s*\/\s*province/i, /prefecture/i
    ],
    weight: 0.8
  },
  zipCode: {
    patterns: [
      /zip/i, /postal/i, /post\s*code/i, /código\s*postal/i, /plz/i,
      /postleitzahl/i, /code\s*postal/i
    ],
    weight: 0.85
  },
  country: {
    patterns: [/country/i, /nation/i, /país/i, /pays/i, /land/i, /location/i],
    weight: 0.8
  },
  linkedin: {
    patterns: [
      /linkedin/i, /linked-in/i, /linkedin\.com/i, /linkedin\s*url/i,
      /linkedin\s*profile/i
    ],
    weight: 0.95
  },
  github: {
    patterns: [
      /github/i, /git-hub/i, /github\.com/i, /github\s*url/i,
      /github\s*profile/i, /code\s*repository/i
    ],
    weight: 0.95
  },
  portfolio: {
    patterns: [
      /portfolio/i, /website/i, /personal\s*site/i, /^url$/i, /web\s*page/i,
      /personal\s*website/i, /online\s*portfolio/i
    ],
    weight: 0.8
  },
  university: {
    patterns: [
      /university/i, /college/i, /school/i, /institution/i, /alma\s*mater/i,
      /education/i, /universidad/i, /école/i, /hochschule/i
    ],
    weight: 0.8
  },
  degree: {
    patterns: [
      /degree/i, /qualification/i, /diploma/i, /certification/i,
      /bachelor/i, /master/i, /phd/i, /doctorate/i, /título/i
    ],
    weight: 0.8
  },
  major: {
    patterns: [
      /major/i, /field\s*of\s*study/i, /concentration/i, /specialization/i,
      /subject/i, /discipline/i, /area\s*of\s*study/i, /especialidad/i
    ],
    weight: 0.8
  },
  gpa: {
    patterns: [
      /gpa/i, /grade\s*point/i, /cumulative\s*gpa/i, /academic\s*average/i,
      /grades/i, /cgpa/i
    ],
    weight: 0.85
  },
  graduationDate: {
    patterns: [
      /graduat/i, /completion\s*date/i, /expected\s*graduat/i,
      /graduation\s*year/i, /year\s*of\s*completion/i, /fecha\s*de\s*graduación/i
    ],
    weight: 0.85
  },
  workAuthorization: {
    patterns: [
      /work\s*auth/i, /visa/i, /sponsor/i, /legal.*work/i, /authorized.*work/i,
      /citizenship/i, /immigration/i, /eligible\s*to\s*work/i, /permit/i,
      /right\s*to\s*work/i, /employment\s*eligibility/i
    ],
    weight: 0.9
  },
  yearsOfExperience: {
    patterns: [
      /years?\s*(of)?\s*experience/i, /experience\s*level/i,
      /how\s*many\s*years/i, /total\s*experience/i, /work\s*experience/i,
      /professional\s*experience/i
    ],
    weight: 0.85
  },
  resume: {
    patterns: [
      /resume/i, /cv/i, /curriculum/i, /upload.*resume/i, /attach.*resume/i,
      /lebenslauf/i, /curriculum\s*vitae/i
    ],
    weight: 0.95
  },
  coverLetter: {
    patterns: [
      /cover\s*letter/i, /letter\s*of\s*interest/i, /motivation\s*letter/i,
      /application\s*letter/i, /carta\s*de\s*presentación/i
    ],
    weight: 0.9
  },
  openEnded: {
    patterns: [
      /why/i, /describe/i, /tell\s*us/i, /explain/i, /what\s*makes/i,
      /how\s*would/i, /please\s*describe/i, /share.*experience/i,
      /what\s*interest/i, /why\s*do\s*you/i, /what\s*attract/i
    ],
    weight: 0.7
  },
  unknown: {
    patterns: [],
    weight: 0
  },
};

/**
 * Universal form detection - works on any site
 */
export async function detectFormsUniversally(): Promise<UniversalDetectionResult> {
  // Step 1: Deep DOM analysis
  const context = analyzeDOMForForms();
  
  // Step 2: Check for known site patterns
  const knownPattern = await formMemory.getPattern(window.location.href);
  const isKnownSite = !!knownPattern;
  
  // Step 3: Detect fields using multiple strategies
  const fields: DetectedField[] = [];
  const suggestedHints: string[] = [];
  
  for (const domElement of context.allFields) {
    // Try memory-based detection first (fastest)
    let detection = await detectFromMemory(domElement);
    
    // Try pattern-based detection
    if (!detection || detection.confidence < 0.7) {
      const patternDetection = detectFromPatterns(domElement);
      if (patternDetection && (!detection || patternDetection.confidence > detection.confidence)) {
        detection = patternDetection;
      }
    }
    
    // Try AI-based detection for low-confidence or unknown fields
    if (!detection || detection.confidence < 0.5) {
      const aiDetection = await detectWithAI(domElement, context);
      if (aiDetection && (!detection || aiDetection.confidence > detection.confidence)) {
        detection = aiDetection;
        if (aiDetection.reasoning) {
          suggestedHints.push(`Field "${getAllLabelText(domElement)}": ${aiDetection.reasoning}`);
        }
      }
    }
    
    // Create detected field
    const actualInput = findActualInput(domElement.element) || domElement.element;
    
    fields.push({
      element: actualInput as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
      fieldType: detection?.fieldType || 'unknown',
      label: getAllLabelText(domElement),
      isRequired: domElement.isRequired,
      confidence: detection?.confidence || 0,
    });
    
    // Learn from this detection
    if (detection && detection.confidence > 0.7) {
      const selector = createSelectorFromElement(domElement.element, getAllLabelText(domElement));
      await formMemory.recordSuccess(window.location.href, selector, detection.fieldType);
    }
  }
  
  // Calculate overall confidence
  const avgConfidence = fields.length > 0 
    ? fields.reduce((sum, f) => sum + f.confidence, 0) / fields.length 
    : 0;
  
  return {
    fields,
    context,
    isKnownSite,
    atsType: knownPattern?.hints?.atsType,
    confidence: avgConfidence,
    suggestedHints: suggestedHints.length > 0 ? suggestedHints : undefined,
  };
}

/**
 * Get all label text for a DOM element
 */
function getAllLabelText(element: DOMElement): string {
  const texts = [
    element.ariaLabel,
    element.placeholder,
    ...element.nearbyText,
    ...element.parentLabels,
    ...element.siblingLabels,
  ].filter(t => t && t.length > 0);
  
  return texts[0] || '';
}

/**
 * Detect field type from memory
 */
async function detectFromMemory(element: DOMElement): Promise<{ fieldType: FieldType; confidence: number } | null> {
  const selector: FieldSelector = {
    id: element.id,
    name: element.name,
    type: element.type,
    ariaLabel: element.ariaLabel,
    placeholder: element.placeholder,
    labelPattern: getAllLabelText(element),
  };
  
  const result = await formMemory.findFieldType(window.location.href, selector);
  if (result) {
    return { fieldType: result.type, confidence: result.confidence };
  }
  return null;
}

/**
 * Detect field type from patterns (rule-based)
 */
function detectFromPatterns(element: DOMElement): { fieldType: FieldType; confidence: number } | null {
  // Combine all text sources for matching
  const textSources = [
    element.id,
    element.name,
    element.ariaLabel,
    element.placeholder,
    ...element.nearbyText,
    ...element.parentLabels,
    ...element.siblingLabels,
  ].join(' ').toLowerCase();
  
  // Check for file inputs (special case)
  if (element.type === 'file') {
    if (/resume|cv|curriculum/i.test(textSources)) {
      return { fieldType: 'resume', confidence: 0.95 };
    }
    if (/cover/i.test(textSources)) {
      return { fieldType: 'coverLetter', confidence: 0.9 };
    }
  }
  
  // Check each field type's patterns
  let bestMatch: { fieldType: FieldType; confidence: number } | null = null;
  
  for (const [fieldType, config] of Object.entries(UNIVERSAL_FIELD_PATTERNS)) {
    for (const pattern of config.patterns) {
      if (pattern.test(textSources)) {
        const confidence = config.weight;
        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = { fieldType: fieldType as FieldType, confidence };
        }
        break; // Move to next field type after first match
      }
    }
  }
  
  // Check for textarea (likely open-ended)
  if (!bestMatch && element.tagName === 'textarea') {
    const label = getAllLabelText(element);
    if (label.length > 20) {
      return { fieldType: 'openEnded', confidence: 0.7 };
    }
  }
  
  // Check for email input type
  if (!bestMatch && element.type === 'email') {
    return { fieldType: 'email', confidence: 0.95 };
  }
  
  // Check for tel input type
  if (!bestMatch && element.type === 'tel') {
    return { fieldType: 'phone', confidence: 0.9 };
  }
  
  // Check for url input type
  if (!bestMatch && element.type === 'url') {
    // Try to determine which URL field
    if (/linkedin/i.test(textSources)) return { fieldType: 'linkedin', confidence: 0.9 };
    if (/github/i.test(textSources)) return { fieldType: 'github', confidence: 0.9 };
    return { fieldType: 'portfolio', confidence: 0.7 };
  }
  
  return bestMatch;
}

/**
 * Use AI to analyze a field when patterns fail
 */
async function detectWithAI(element: DOMElement, context: FormContext): Promise<AIFieldAnalysis | null> {
  try {
    const settings = await storage.getSettings();
    const apiKey = await storage.getApiKey();
    
    // Skip AI if no key or AI disabled
    if (!apiKey || (settings as any).noAiMode) {
      return null;
    }
    
    const prompt = buildAIPrompt(element, context);
    const response = await callAIForAnalysis(apiKey, prompt, settings.aiProvider);
    
    return parseAIResponse(response);
  } catch (error) {
    console.log('[UniversalDetector] AI analysis failed:', error);
    return null;
  }
}

/**
 * Build prompt for AI field analysis
 */
function buildAIPrompt(element: DOMElement, context: FormContext): string {
  const labelText = getAllLabelText(element);
  const sectionContext = element.ancestorContext.join(' > ');
  
  return `You are analyzing a job application form field to determine what type of information it expects.

FIELD INFORMATION:
- Tag: ${element.tagName}
- Type: ${element.type || 'text'}
- ID: ${element.id || 'none'}
- Name: ${element.name || 'none'}
- Label/Text: "${labelText}"
- Placeholder: "${element.placeholder || 'none'}"
- Aria-label: "${element.ariaLabel || 'none'}"
- Section: "${sectionContext || 'unknown'}"
- Required: ${element.isRequired}

PAGE CONTEXT:
- Title: ${context.pageTitle}
- URL: ${context.pageUrl}
- Total form fields: ${context.allFields.length}

POSSIBLE FIELD TYPES (choose one):
- firstName, lastName, fullName
- email, phone
- address, city, state, zipCode, country
- linkedin, github, portfolio
- university, degree, major, gpa, graduationDate
- workAuthorization, yearsOfExperience
- resume, coverLetter
- openEnded (for essay/long-answer questions)
- unknown (only if truly cannot determine)

Respond in this exact JSON format:
{"fieldType": "TYPE", "confidence": 0.XX, "reasoning": "brief explanation"}`;
}

/**
 * Call AI API for field analysis
 */
async function callAIForAnalysis(apiKey: string, prompt: string, provider: string): Promise<string> {
  if (provider === 'anthropic') {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 100,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.content[0].text;
  } else {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
  }
}

/**
 * Parse AI response into structured format
 */
function parseAIResponse(response: string): AIFieldAnalysis | null {
  try {
    // Extract JSON from response (may be wrapped in markdown code blocks)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    // Validate field type
    const validTypes: FieldType[] = [
      'firstName', 'lastName', 'fullName', 'email', 'phone',
      'address', 'city', 'state', 'zipCode', 'country',
      'linkedin', 'github', 'portfolio',
      'university', 'degree', 'major', 'gpa', 'graduationDate',
      'workAuthorization', 'yearsOfExperience',
      'resume', 'coverLetter', 'openEnded', 'unknown'
    ];
    
    if (!validTypes.includes(parsed.fieldType)) {
      return null;
    }
    
    return {
      fieldType: parsed.fieldType,
      confidence: Math.min(0.95, Math.max(0.1, parsed.confidence || 0.6)),
      reasoning: parsed.reasoning || '',
    };
  } catch (error) {
    console.log('[UniversalDetector] Failed to parse AI response:', error);
    return null;
  }
}

/**
 * Analyze an entire page with AI vision (for complex/custom UIs)
 */
export async function analyzePageWithVision(): Promise<UniversalDetectionResult | null> {
  try {
    const settings = await storage.getSettings();
    const apiKey = await storage.getApiKey();
    
    if (!apiKey || (settings as any).noAiMode) {
      return null;
    }
    
    // Get DOM snapshot for context
    const snapshot = getDOMSnapshot();
    const context = analyzeDOMForForms();
    
    const prompt = `You are analyzing a job application form page. Here's the DOM structure:

${snapshot}

For each form field found, determine the field type and provide a mapping.

Respond with a JSON array:
[
  {"index": 0, "fieldType": "firstName", "confidence": 0.9},
  {"index": 1, "fieldType": "lastName", "confidence": 0.9},
  ...
]

Use these field types: firstName, lastName, fullName, email, phone, address, city, state, zipCode, country, linkedin, github, portfolio, university, degree, major, gpa, graduationDate, workAuthorization, yearsOfExperience, resume, coverLetter, openEnded, unknown`;
    
    const response = settings.aiProvider === 'anthropic'
      ? await callAnthropicVision(apiKey, prompt)
      : await callOpenAIVision(apiKey, prompt);
    
    // Parse response and map to fields
    const mappings = parseVisionResponse(response);
    
    const fields: DetectedField[] = context.allFields.map((domEl, index) => {
      const mapping = mappings.find(m => m.index === index);
      const actualInput = findActualInput(domEl.element) || domEl.element;
      
      return {
        element: actualInput as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
        fieldType: mapping?.fieldType || 'unknown',
        label: getAllLabelText(domEl),
        isRequired: domEl.isRequired,
        confidence: mapping?.confidence || 0,
      };
    });
    
    return {
      fields,
      context,
      isKnownSite: false,
      confidence: fields.reduce((sum, f) => sum + f.confidence, 0) / fields.length,
    };
  } catch (error) {
    console.log('[UniversalDetector] Vision analysis failed:', error);
    return null;
  }
}

/**
 * Call Anthropic Claude for vision analysis
 */
async function callAnthropicVision(apiKey: string, prompt: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  
  const data = await response.json();
  return data.content[0].text;
}

/**
 * Call OpenAI GPT for vision analysis
 */
async function callOpenAIVision(apiKey: string, prompt: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
    }),
  });
  
  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * Parse vision API response
 */
function parseVisionResponse(response: string): Array<{ index: number; fieldType: FieldType; confidence: number }> {
  try {
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    return parsed.map((item: any) => ({
      index: item.index,
      fieldType: item.fieldType || 'unknown',
      confidence: item.confidence || 0.5,
    }));
  } catch {
    return [];
  }
}

/**
 * Smart field detection - combines all strategies
 */
export async function smartDetectField(element: HTMLElement): Promise<{ type: FieldType; confidence: number; source: string }> {
  const domElement = (await import('./dom-analyzer')).analyzeElement(element);
  
  // 1. Memory-based detection
  const memoryResult = await detectFromMemory(domElement);
  if (memoryResult && memoryResult.confidence > 0.8) {
    return { type: memoryResult.fieldType, confidence: memoryResult.confidence, source: 'memory' };
  }
  
  // 2. Pattern-based detection
  const patternResult = detectFromPatterns(domElement);
  if (patternResult && patternResult.confidence > 0.7) {
    return { type: patternResult.fieldType, confidence: patternResult.confidence, source: 'pattern' };
  }
  
  // 3. AI-based detection
  const context = analyzeDOMForForms();
  const aiResult = await detectWithAI(domElement, context);
  if (aiResult && aiResult.confidence > 0.5) {
    return { type: aiResult.fieldType, confidence: aiResult.confidence, source: 'ai' };
  }
  
  // 4. Return best available result
  if (memoryResult) return { type: memoryResult.fieldType, confidence: memoryResult.confidence, source: 'memory' };
  if (patternResult) return { type: patternResult.fieldType, confidence: patternResult.confidence, source: 'pattern' };
  
  return { type: 'unknown', confidence: 0, source: 'none' };
}

/**
 * Learn from user corrections
 */
export async function learnFromCorrection(
  element: HTMLElement,
  correctFieldType: FieldType,
  labelText?: string
): Promise<void> {
  const selector = createSelectorFromElement(element, labelText);
  await formMemory.recordSuccess(window.location.href, selector, correctFieldType);
  
  console.log(`[UniversalDetector] Learned: "${labelText || element.id}" -> ${correctFieldType}`);
}

/**
 * Get detection statistics for the current site
 */
export async function getSiteStats(): Promise<{
  knownFields: number;
  successRate: number;
  applicationCount: number;
} | null> {
  const pattern = await formMemory.getPattern(window.location.href);
  
  if (!pattern) return null;
  
  return {
    knownFields: pattern.fieldMappings.length,
    successRate: pattern.successRate,
    applicationCount: pattern.applicationCount,
  };
}
