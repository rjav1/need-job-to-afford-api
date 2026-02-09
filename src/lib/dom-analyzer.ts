/**
 * DOM Analyzer - Deep DOM inspection for finding form elements in any framework
 * Handles React, Vue, Angular, custom components, shadow DOM, and weird form structures
 */

export interface DOMElement {
  element: HTMLElement;
  tagName: string;
  type: string;
  id: string;
  name: string;
  className: string;
  placeholder: string;
  ariaLabel: string;
  ariaDescribedBy: string;
  role: string;
  value: string;
  isVisible: boolean;
  isInteractive: boolean;
  isDisabled: boolean;
  isRequired: boolean;
  rect: DOMRect;
  computedStyle: Partial<CSSStyleDeclaration>;
  dataAttributes: Record<string, string>;
  nearbyText: string[];
  parentLabels: string[];
  siblingLabels: string[];
  ancestorContext: string[];
}

export interface FormContext {
  formElement: HTMLFormElement | null;
  allFields: DOMElement[];
  inputFields: DOMElement[];
  selectFields: DOMElement[];
  textareaFields: DOMElement[];
  buttonFields: DOMElement[];
  customInputs: DOMElement[];
  pageTitle: string;
  pageUrl: string;
  formLabels: Map<string, string>;
  formSections: FormSection[];
}

export interface FormSection {
  title: string;
  fields: DOMElement[];
  element: HTMLElement;
}

/**
 * Analyze the entire DOM to find form fields, including custom components
 */
export function analyzeDOMForForms(): FormContext {
  const context: FormContext = {
    formElement: null,
    allFields: [],
    inputFields: [],
    selectFields: [],
    textareaFields: [],
    buttonFields: [],
    customInputs: [],
    pageTitle: document.title,
    pageUrl: window.location.href,
    formLabels: new Map(),
    formSections: [],
  };

  // Find the main form (if any)
  context.formElement = findMainForm();

  // Collect all standard inputs
  const inputs = document.querySelectorAll<HTMLInputElement>(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="image"])'
  );
  const selects = document.querySelectorAll<HTMLSelectElement>('select');
  const textareas = document.querySelectorAll<HTMLTextAreaElement>('textarea');
  const buttons = document.querySelectorAll<HTMLButtonElement>('button, input[type="submit"], input[type="button"]');

  // Process standard inputs
  for (const input of inputs) {
    const analyzed = analyzeElement(input);
    if (analyzed.isVisible && analyzed.isInteractive) {
      context.inputFields.push(analyzed);
      context.allFields.push(analyzed);
    }
  }

  for (const select of selects) {
    const analyzed = analyzeElement(select);
    if (analyzed.isVisible && analyzed.isInteractive) {
      context.selectFields.push(analyzed);
      context.allFields.push(analyzed);
    }
  }

  for (const textarea of textareas) {
    const analyzed = analyzeElement(textarea);
    if (analyzed.isVisible && analyzed.isInteractive) {
      context.textareaFields.push(analyzed);
      context.allFields.push(analyzed);
    }
  }

  for (const button of buttons) {
    const analyzed = analyzeElement(button);
    if (analyzed.isVisible) {
      context.buttonFields.push(analyzed);
    }
  }

  // Find custom form components (React, Vue, Angular, etc.)
  const customInputs = findCustomFormComponents();
  for (const custom of customInputs) {
    const analyzed = analyzeElement(custom);
    if (analyzed.isVisible && analyzed.isInteractive) {
      // Don't add duplicates
      if (!context.allFields.some(f => f.element === custom)) {
        context.customInputs.push(analyzed);
        context.allFields.push(analyzed);
      }
    }
  }

  // Build label map
  context.formLabels = buildLabelMap(context.allFields);

  // Detect form sections
  context.formSections = detectFormSections(context.allFields);

  return context;
}

/**
 * Deep analysis of a single DOM element
 */
export function analyzeElement(element: HTMLElement): DOMElement {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);

  return {
    element,
    tagName: element.tagName.toLowerCase(),
    type: (element as HTMLInputElement).type || '',
    id: element.id || '',
    name: (element as HTMLInputElement).name || '',
    className: element.className || '',
    placeholder: (element as HTMLInputElement).placeholder || '',
    ariaLabel: element.getAttribute('aria-label') || '',
    ariaDescribedBy: element.getAttribute('aria-describedby') || '',
    role: element.getAttribute('role') || '',
    value: (element as HTMLInputElement).value || '',
    isVisible: isElementVisible(element, style, rect),
    isInteractive: isElementInteractive(element, style),
    isDisabled: isElementDisabled(element),
    isRequired: isElementRequired(element),
    rect,
    computedStyle: {
      display: style.display,
      visibility: style.visibility,
      opacity: style.opacity,
      pointerEvents: style.pointerEvents,
    },
    dataAttributes: extractDataAttributes(element),
    nearbyText: extractNearbyText(element),
    parentLabels: extractParentLabels(element),
    siblingLabels: extractSiblingLabels(element),
    ancestorContext: extractAncestorContext(element),
  };
}

/**
 * Find the main form element on the page
 */
function findMainForm(): HTMLFormElement | null {
  const forms = document.querySelectorAll<HTMLFormElement>('form');
  
  if (forms.length === 0) return null;
  if (forms.length === 1) return forms[0];

  // Multiple forms - find the most relevant one
  // Prioritize forms with job-related keywords or most inputs
  let bestForm: HTMLFormElement | null = null;
  let bestScore = 0;

  for (const form of forms) {
    let score = 0;
    
    // Check for job application keywords
    const formText = form.textContent?.toLowerCase() || '';
    const jobKeywords = ['apply', 'application', 'resume', 'cv', 'experience', 'education', 'skills'];
    for (const keyword of jobKeywords) {
      if (formText.includes(keyword)) score += 10;
    }
    
    // Count inputs
    const inputs = form.querySelectorAll('input, select, textarea');
    score += inputs.length * 2;
    
    // Visible form
    if (isElementVisible(form)) score += 20;
    
    if (score > bestScore) {
      bestScore = score;
      bestForm = form;
    }
  }

  return bestForm;
}

/**
 * Find custom form components (React, Vue, Angular, etc.)
 */
function findCustomFormComponents(): HTMLElement[] {
  const customInputs: HTMLElement[] = [];

  // Common custom input selectors
  const customSelectors = [
    // React/Material-UI
    '[class*="MuiInput"]',
    '[class*="MuiTextField"]',
    '[class*="MuiSelect"]',
    '[class*="MuiAutocomplete"]',
    
    // React-Select
    '[class*="react-select"]',
    '[class*="Select__control"]',
    
    // Ant Design
    '[class*="ant-input"]',
    '[class*="ant-select"]',
    '[class*="ant-picker"]',
    
    // Bootstrap
    '[class*="form-control"]',
    '[class*="form-select"]',
    
    // Tailwind/HeadlessUI
    '[data-headlessui-state]',
    '[class*="listbox"]',
    
    // Generic patterns
    '[role="textbox"]',
    '[role="combobox"]',
    '[role="listbox"]',
    '[role="spinbutton"]',
    '[contenteditable="true"]',
    
    // Vue specific
    '[data-v-]',
    
    // Angular specific
    '[ng-model]',
    '[formcontrolname]',
    '[(ngModel)]',
    
    // Data attributes commonly used
    '[data-input]',
    '[data-field]',
    '[data-form-field]',
    '[data-testid*="input"]',
    '[data-testid*="field"]',
    '[data-automation-id*="input"]',
    '[data-automation-id*="field"]',
    
    // Workday specific
    '[data-automation-id]',
    
    // Greenhouse/Lever
    '[data-qa]',
    
    // iCIMS
    '[class*="iCIMS"]',
  ];

  for (const selector of customSelectors) {
    try {
      const elements = document.querySelectorAll<HTMLElement>(selector);
      for (const el of elements) {
        // Check if this element contains an actual input or is itself interactive
        if (isCustomInteractive(el) && !customInputs.includes(el)) {
          customInputs.push(el);
        }
      }
    } catch (e) {
      // Invalid selector, skip
    }
  }

  return customInputs;
}

/**
 * Check if an element is a custom interactive component
 */
function isCustomInteractive(element: HTMLElement): boolean {
  // Has click handler or tabindex
  if (element.onclick || element.getAttribute('tabindex') !== null) return true;
  
  // Is contenteditable
  if (element.getAttribute('contenteditable') === 'true') return true;
  
  // Has role suggesting interactivity
  const role = element.getAttribute('role');
  if (role && ['textbox', 'combobox', 'listbox', 'spinbutton', 'slider'].includes(role)) return true;
  
  // Has data attributes suggesting it's a form field
  const dataAttrs = Array.from(element.attributes)
    .filter(attr => attr.name.startsWith('data-'))
    .map(attr => attr.name.toLowerCase());
  
  const fieldIndicators = ['input', 'field', 'control', 'value'];
  if (dataAttrs.some(attr => fieldIndicators.some(ind => attr.includes(ind)))) return true;
  
  return false;
}

/**
 * Check if element is visible
 */
function isElementVisible(
  element: HTMLElement,
  style?: CSSStyleDeclaration,
  rect?: DOMRect
): boolean {
  style = style || window.getComputedStyle(element);
  rect = rect || element.getBoundingClientRect();

  // Check CSS properties
  if (style.display === 'none') return false;
  if (style.visibility === 'hidden') return false;
  if (parseFloat(style.opacity) === 0) return false;

  // Check dimensions
  if (rect.width === 0 && rect.height === 0) return false;

  // Check if in viewport or document
  if (rect.bottom < 0 || rect.right < 0) return false;
  if (rect.top > window.innerHeight && rect.left > window.innerWidth) return false;

  // Check offsetParent (null means element is hidden)
  if (element.offsetParent === null && style.position !== 'fixed') return false;

  return true;
}

/**
 * Check if element is interactive (can receive input)
 */
function isElementInteractive(element: HTMLElement, style?: CSSStyleDeclaration): boolean {
  style = style || window.getComputedStyle(element);
  
  // Check if pointer events are disabled
  if (style.pointerEvents === 'none') return false;
  
  // Check if disabled
  if (isElementDisabled(element)) return false;
  
  // Check if readonly (inputs)
  if ((element as HTMLInputElement).readOnly === true) return false;
  
  return true;
}

/**
 * Check if element is disabled
 */
function isElementDisabled(element: HTMLElement): boolean {
  if ((element as HTMLInputElement).disabled) return true;
  if (element.getAttribute('aria-disabled') === 'true') return true;
  if (element.classList.contains('disabled')) return true;
  
  // Check parent for disabled state
  const parent = element.closest('[disabled], [aria-disabled="true"], .disabled');
  if (parent) return true;
  
  return false;
}

/**
 * Check if element is required
 */
function isElementRequired(element: HTMLElement): boolean {
  if ((element as HTMLInputElement).required) return true;
  if (element.getAttribute('aria-required') === 'true') return true;
  
  // Check for required indicator in nearby text
  const parent = element.closest('.form-group, .field, .input-group, [class*="field"]');
  if (parent) {
    const text = parent.textContent || '';
    if (text.includes('*') || text.toLowerCase().includes('required')) return true;
  }
  
  return false;
}

/**
 * Extract all data-* attributes
 */
function extractDataAttributes(element: HTMLElement): Record<string, string> {
  const data: Record<string, string> = {};
  
  for (const attr of element.attributes) {
    if (attr.name.startsWith('data-')) {
      data[attr.name] = attr.value;
    }
  }
  
  return data;
}

/**
 * Extract text near the element (labels, hints, etc.)
 */
function extractNearbyText(element: HTMLElement): string[] {
  const texts: string[] = [];
  
  // Get text from associated label
  const id = element.id;
  if (id) {
    const label = document.querySelector(`label[for="${id}"]`);
    if (label && label.textContent) {
      texts.push(label.textContent.trim());
    }
  }
  
  // Get aria-describedby content
  const describedBy = element.getAttribute('aria-describedby');
  if (describedBy) {
    const descElement = document.getElementById(describedBy);
    if (descElement && descElement.textContent) {
      texts.push(descElement.textContent.trim());
    }
  }
  
  // Get placeholder
  const placeholder = (element as HTMLInputElement).placeholder;
  if (placeholder) {
    texts.push(placeholder);
  }
  
  // Get title attribute
  const title = element.getAttribute('title');
  if (title) {
    texts.push(title);
  }
  
  // Previous sibling text
  let prev = element.previousElementSibling;
  while (prev) {
    if (prev.tagName === 'LABEL' || prev.classList.contains('label')) {
      if (prev.textContent) texts.push(prev.textContent.trim());
      break;
    }
    if (prev.tagName === 'SPAN' && prev.textContent && prev.textContent.length < 100) {
      texts.push(prev.textContent.trim());
      break;
    }
    prev = prev.previousElementSibling;
  }
  
  return texts.filter(t => t.length > 0);
}

/**
 * Extract labels from parent elements
 */
function extractParentLabels(element: HTMLElement): string[] {
  const labels: string[] = [];
  
  // Check parent label
  const parentLabel = element.closest('label');
  if (parentLabel && parentLabel.textContent) {
    // Remove the input's own text content
    const labelText = parentLabel.textContent
      .replace(element.textContent || '', '')
      .trim();
    if (labelText) labels.push(labelText);
  }
  
  // Check common parent containers
  const containers = [
    '.form-group',
    '.form-field',
    '.field',
    '.input-group',
    '.input-wrapper',
    '[class*="field"]',
    '[class*="FormField"]',
    '[class*="input-container"]',
  ];
  
  for (const selector of containers) {
    const container = element.closest(selector);
    if (container) {
      // Find label within container
      const label = container.querySelector('label, .label, [class*="label"]');
      if (label && label.textContent) {
        labels.push(label.textContent.trim());
      }
    }
  }
  
  return labels.filter(l => l.length > 0 && l.length < 200);
}

/**
 * Extract labels from sibling elements
 */
function extractSiblingLabels(element: HTMLElement): string[] {
  const labels: string[] = [];
  const parent = element.parentElement;
  
  if (!parent) return labels;
  
  // Check all siblings
  for (const sibling of parent.children) {
    if (sibling === element) continue;
    
    // Label elements
    if (sibling.tagName === 'LABEL') {
      if (sibling.textContent) labels.push(sibling.textContent.trim());
      continue;
    }
    
    // Span/div with label-like classes
    if (sibling.classList.contains('label') || 
        sibling.className.toLowerCase().includes('label')) {
      if (sibling.textContent) labels.push(sibling.textContent.trim());
      continue;
    }
    
    // Small text elements near input (likely labels)
    if (['SPAN', 'DIV', 'P'].includes(sibling.tagName)) {
      const text = sibling.textContent?.trim();
      if (text && text.length < 100 && text.length > 0) {
        labels.push(text);
      }
    }
  }
  
  return labels;
}

/**
 * Extract context from ancestor elements (section titles, headers, etc.)
 */
function extractAncestorContext(element: HTMLElement): string[] {
  const context: string[] = [];
  
  let current: HTMLElement | null = element.parentElement;
  let depth = 0;
  
  while (current && depth < 10) {
    // Check for section headers
    const headers = current.querySelectorAll('h1, h2, h3, h4, h5, h6, .section-title, [class*="header"], legend');
    for (const header of headers) {
      // Only include headers that come before our element
      if (header.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING) {
        if (header.textContent && header.textContent.length < 100) {
          context.push(header.textContent.trim());
        }
      }
    }
    
    // Check for fieldset legends
    if (current.tagName === 'FIELDSET') {
      const legend = current.querySelector('legend');
      if (legend && legend.textContent) {
        context.push(legend.textContent.trim());
      }
    }
    
    // Check for section/article titles
    if (['SECTION', 'ARTICLE', 'FIELDSET'].includes(current.tagName)) {
      const title = current.getAttribute('aria-label') || current.getAttribute('title');
      if (title) context.push(title);
    }
    
    current = current.parentElement;
    depth++;
  }
  
  return context.filter(c => c.length > 0);
}

/**
 * Build a map of element IDs/names to their label text
 */
function buildLabelMap(fields: DOMElement[]): Map<string, string> {
  const map = new Map<string, string>();
  
  for (const field of fields) {
    const key = field.id || field.name || `${field.tagName}-${fields.indexOf(field)}`;
    
    // Combine all label sources
    const labels = [
      field.ariaLabel,
      field.placeholder,
      ...field.nearbyText,
      ...field.parentLabels,
      ...field.siblingLabels,
    ].filter(l => l && l.length > 0);
    
    if (labels.length > 0) {
      // Use the first/most specific label
      map.set(key, labels[0]);
    }
  }
  
  return map;
}

/**
 * Detect form sections (groups of related fields)
 */
function detectFormSections(fields: DOMElement[]): FormSection[] {
  const sections: FormSection[] = [];
  const processed = new Set<DOMElement>();
  
  // Group fields by common ancestors
  const ancestorGroups = new Map<HTMLElement, DOMElement[]>();
  
  for (const field of fields) {
    // Find section-like ancestor
    const sectionAncestor = field.element.closest(
      'fieldset, section, .section, [class*="section"], [class*="group"], .form-section'
    ) as HTMLElement;
    
    if (sectionAncestor) {
      const group = ancestorGroups.get(sectionAncestor) || [];
      group.push(field);
      ancestorGroups.set(sectionAncestor, group);
      processed.add(field);
    }
  }
  
  // Create sections from groups
  for (const [ancestor, groupFields] of ancestorGroups) {
    // Find section title
    const titleEl = ancestor.querySelector('h1, h2, h3, h4, legend, .section-title, [class*="title"]');
    const title = titleEl?.textContent?.trim() || 
                  ancestor.getAttribute('aria-label') || 
                  'Section';
    
    sections.push({
      title,
      fields: groupFields,
      element: ancestor,
    });
  }
  
  // Add ungrouped fields as a default section
  const ungrouped = fields.filter(f => !processed.has(f));
  if (ungrouped.length > 0) {
    sections.push({
      title: 'General',
      fields: ungrouped,
      element: document.body,
    });
  }
  
  return sections;
}

/**
 * Get a simplified DOM snapshot for AI analysis
 */
export function getDOMSnapshot(): string {
  const context = analyzeDOMForForms();
  
  let snapshot = `Page: ${context.pageTitle}\nURL: ${context.pageUrl}\n\n`;
  snapshot += `Found ${context.allFields.length} form fields:\n\n`;
  
  for (let i = 0; i < context.allFields.length; i++) {
    const field = context.allFields[i];
    snapshot += `[${i}] ${field.tagName}`;
    if (field.type) snapshot += `[type="${field.type}"]`;
    if (field.id) snapshot += `#${field.id}`;
    if (field.name) snapshot += ` name="${field.name}"`;
    snapshot += `\n`;
    
    const labels = [
      field.ariaLabel && `aria-label: "${field.ariaLabel}"`,
      field.placeholder && `placeholder: "${field.placeholder}"`,
      field.nearbyText.length > 0 && `nearby: "${field.nearbyText[0]}"`,
      field.parentLabels.length > 0 && `parent: "${field.parentLabels[0]}"`,
    ].filter(Boolean);
    
    if (labels.length > 0) {
      snapshot += `   Labels: ${labels.join(', ')}\n`;
    }
    
    if (field.ancestorContext.length > 0) {
      snapshot += `   Section: ${field.ancestorContext[0]}\n`;
    }
    
    snapshot += `   Required: ${field.isRequired}\n`;
    snapshot += `\n`;
  }
  
  return snapshot;
}

/**
 * Find the actual input element within a custom component
 */
export function findActualInput(customComponent: HTMLElement): HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null {
  // Check for nested standard input
  const input = customComponent.querySelector('input:not([type="hidden"])');
  if (input) return input as HTMLInputElement;
  
  const select = customComponent.querySelector('select');
  if (select) return select as HTMLSelectElement;
  
  const textarea = customComponent.querySelector('textarea');
  if (textarea) return textarea as HTMLTextAreaElement;
  
  // Check for contenteditable
  const editable = customComponent.querySelector('[contenteditable="true"]');
  if (editable) return editable as any;
  
  // The component itself might be the input
  if (customComponent.tagName === 'INPUT') return customComponent as HTMLInputElement;
  if (customComponent.tagName === 'SELECT') return customComponent as HTMLSelectElement;
  if (customComponent.tagName === 'TEXTAREA') return customComponent as HTMLTextAreaElement;
  if (customComponent.getAttribute('contenteditable') === 'true') return customComponent as any;
  
  return null;
}
