/**
 * Account Handler - Automatic account creation for job application sites
 * 
 * Detects when account creation is required, auto-fills signup forms,
 * generates secure passwords, and handles email verification detection.
 */

import { storage } from './storage';
import { UserProfile } from './types';
import { 
  credentialStore, 
  generateSecurePassword, 
  createCredential, 
  detectPlatform,
  StoredCredential,
  CredentialMatch,
} from './credential-store';
import { analyzeDOMForForms, FormContext, DOMElement } from './dom-analyzer';

// Account page detection result
export interface AccountPageDetection {
  pageType: 'login' | 'signup' | 'verification' | 'password-reset' | 'unknown';
  confidence: number;
  hasExistingAccount: boolean;
  existingCredential: CredentialMatch | null;
  suggestedAction: AccountAction;
  formElements: AccountFormElements;
  platform: string;
}

export type AccountAction = 
  | 'login-with-stored'      // Use stored credential to login
  | 'create-account'          // Create new account
  | 'await-verification'      // Email verification pending
  | 'continue-as-guest'       // Skip account creation if possible
  | 'manual-required'         // User intervention needed
  | 'none';                   // Not an account-related page

export interface AccountFormElements {
  emailField: HTMLInputElement | null;
  passwordField: HTMLInputElement | null;
  confirmPasswordField: HTMLInputElement | null;
  firstNameField: HTMLInputElement | null;
  lastNameField: HTMLInputElement | null;
  fullNameField: HTMLInputElement | null;
  phoneField: HTMLInputElement | null;
  submitButton: HTMLButtonElement | HTMLInputElement | null;
  loginLink: HTMLAnchorElement | null;
  signupLink: HTMLAnchorElement | null;
  guestLink: HTMLAnchorElement | null;
}

export interface AccountCreationResult {
  success: boolean;
  action: AccountAction;
  credential?: StoredCredential;
  generatedPassword?: string;
  errors: string[];
  requiresVerification: boolean;
  nextStep?: string;
}

// Page type detection patterns
const PAGE_TYPE_PATTERNS = {
  login: {
    urlPatterns: [
      /\/login/i, /\/signin/i, /\/sign-in/i, /\/auth/i, 
      /\/account\/login/i, /\/sso/i, /authenticate/i,
    ],
    textPatterns: [
      /sign\s*in/i, /log\s*in/i, /welcome\s*back/i,
      /enter\s*your\s*(email|password)/i, /don't\s*have\s*an?\s*account/i,
    ],
    formPatterns: [
      /password.*email|email.*password/i,
    ],
  },
  signup: {
    urlPatterns: [
      /\/register/i, /\/signup/i, /\/sign-up/i, /\/create/i,
      /\/account\/new/i, /\/join/i, /\/apply.*account/i,
    ],
    textPatterns: [
      /create\s*(an?\s*)?account/i, /sign\s*up/i, /register/i,
      /get\s*started/i, /join\s*(us|now)/i, /already\s*have\s*an?\s*account/i,
      /confirm\s*password/i, /retype\s*password/i,
    ],
    formPatterns: [
      /confirm.*password|password.*confirm/i,
      /first.*name.*last.*name/i,
    ],
  },
  verification: {
    urlPatterns: [
      /\/verify/i, /\/confirm/i, /\/activation/i,
      /\/validate/i, /\/email-sent/i,
    ],
    textPatterns: [
      /check\s*your\s*(email|inbox)/i, /verification\s*(email|link)/i,
      /we('ve)?\s*sent/i, /confirm\s*your\s*email/i,
      /verify\s*your\s*(email|account)/i, /activation\s*link/i,
      /didn't\s*receive/i, /resend/i, /check\s*spam/i,
    ],
    formPatterns: [],
  },
  passwordReset: {
    urlPatterns: [
      /\/forgot/i, /\/reset/i, /\/recover/i, /\/password-reset/i,
    ],
    textPatterns: [
      /forgot\s*(your\s*)?password/i, /reset\s*password/i,
      /recover\s*account/i, /we'll\s*send/i,
    ],
    formPatterns: [],
  },
};

// Platform-specific selectors
const PLATFORM_SELECTORS: Record<string, {
  email: string[];
  password: string[];
  confirmPassword: string[];
  submit: string[];
  createAccountLink: string[];
}> = {
  workday: {
    email: ['input[data-automation-id="email"]', 'input[id*="email"]', 'input[name*="email"]'],
    password: ['input[data-automation-id="password"]', 'input[type="password"]'],
    confirmPassword: ['input[data-automation-id="verifyPassword"]', 'input[name*="confirm"]'],
    submit: ['button[data-automation-id="createAccountSubmitButton"]', 'button[type="submit"]'],
    createAccountLink: ['a[data-automation-id="createAccountLink"]', 'a:contains("Create Account")'],
  },
  greenhouse: {
    email: ['input#email', 'input[name="job_application[email]"]', 'input[type="email"]'],
    password: ['input#password', 'input[type="password"]'],
    confirmPassword: ['input#password_confirmation'],
    submit: ['button[type="submit"]', 'input[type="submit"]'],
    createAccountLink: ['a[href*="sign_up"]', 'a[href*="register"]'],
  },
  lever: {
    email: ['input[name="email"]', 'input[type="email"]'],
    password: ['input[name="password"]', 'input[type="password"]'],
    confirmPassword: ['input[name="confirmPassword"]'],
    submit: ['button[type="submit"]'],
    createAccountLink: ['a[href*="signup"]'],
  },
  default: {
    email: ['input[type="email"]', 'input[name*="email"]', 'input[id*="email"]', 'input[autocomplete="email"]'],
    password: ['input[type="password"]:not([name*="confirm"]):not([id*="confirm"])'],
    confirmPassword: ['input[type="password"][name*="confirm"]', 'input[type="password"][id*="confirm"]', 'input[name*="verify"]'],
    submit: ['button[type="submit"]', 'input[type="submit"]', 'button:contains("Create")', 'button:contains("Sign up")', 'button:contains("Register")'],
    createAccountLink: ['a:contains("Create account")', 'a:contains("Sign up")', 'a:contains("Register")', 'a[href*="register"]', 'a[href*="signup"]'],
  },
};

/**
 * Detect if current page is an account-related page
 */
export async function detectAccountPage(): Promise<AccountPageDetection> {
  const url = window.location.href;
  const pageText = document.body?.innerText?.toLowerCase() || '';
  const platform = detectPlatform(url);
  
  // Find form elements
  const formElements = findAccountFormElements(platform);
  
  // Determine page type
  const pageType = determinePageType(url, pageText, formElements);
  
  // Check for existing credential
  const existingCredential = await credentialStore.findForUrl(url);
  
  // Determine suggested action
  const suggestedAction = determineSuggestedAction(pageType, existingCredential, formElements);
  
  // Calculate confidence
  const confidence = calculateDetectionConfidence(pageType, url, pageText, formElements);
  
  return {
    pageType,
    confidence,
    hasExistingAccount: existingCredential !== null,
    existingCredential,
    suggestedAction,
    formElements,
    platform,
  };
}

/**
 * Find account-related form elements on the page
 */
function findAccountFormElements(platform: string): AccountFormElements {
  const selectors = PLATFORM_SELECTORS[platform] || PLATFORM_SELECTORS.default;
  
  const findFirst = <T extends Element>(selectorList: string[]): T | null => {
    for (const selector of selectorList) {
      try {
        // Handle :contains pseudo-selector
        if (selector.includes(':contains(')) {
          const match = selector.match(/(.+?):contains\("(.+?)"\)/);
          if (match) {
            const [, tag, text] = match;
            const elements = document.querySelectorAll<T>(tag);
            for (const el of elements) {
              if (el.textContent?.toLowerCase().includes(text.toLowerCase())) {
                return el;
              }
            }
          }
          continue;
        }
        
        const el = document.querySelector<T>(selector);
        if (el && isVisible(el as HTMLElement)) return el;
      } catch {
        // Invalid selector, skip
      }
    }
    return null;
  };
  
  // Find password fields more carefully
  const passwordFields = document.querySelectorAll<HTMLInputElement>('input[type="password"]');
  let passwordField: HTMLInputElement | null = null;
  let confirmPasswordField: HTMLInputElement | null = null;
  
  const visiblePasswordFields = Array.from(passwordFields).filter(f => isVisible(f));
  
  if (visiblePasswordFields.length === 1) {
    passwordField = visiblePasswordFields[0];
  } else if (visiblePasswordFields.length >= 2) {
    // Likely signup form with confirm password
    passwordField = visiblePasswordFields[0];
    confirmPasswordField = visiblePasswordFields[1];
  }
  
  // Override with platform-specific selectors if found
  const platformConfirmPassword = findFirst<HTMLInputElement>(selectors.confirmPassword);
  if (platformConfirmPassword) {
    confirmPasswordField = platformConfirmPassword;
    // Make sure password field isn't the same as confirm
    if (passwordField === confirmPasswordField && visiblePasswordFields.length >= 2) {
      passwordField = visiblePasswordFields[0];
    }
  }
  
  return {
    emailField: findFirst<HTMLInputElement>(selectors.email),
    passwordField,
    confirmPasswordField,
    firstNameField: findFirst<HTMLInputElement>([
      'input[name*="first"][name*="name"]', 'input[id*="first"][id*="name"]',
      'input[autocomplete="given-name"]', 'input[name="firstName"]',
    ]),
    lastNameField: findFirst<HTMLInputElement>([
      'input[name*="last"][name*="name"]', 'input[id*="last"][id*="name"]',
      'input[autocomplete="family-name"]', 'input[name="lastName"]',
    ]),
    fullNameField: findFirst<HTMLInputElement>([
      'input[name="name"]', 'input[id="name"]', 'input[autocomplete="name"]',
      'input[name="fullName"]',
    ]),
    phoneField: findFirst<HTMLInputElement>([
      'input[type="tel"]', 'input[name*="phone"]', 'input[id*="phone"]',
      'input[autocomplete="tel"]',
    ]),
    submitButton: findFirst<HTMLButtonElement | HTMLInputElement>(selectors.submit),
    loginLink: findFirst<HTMLAnchorElement>([
      'a[href*="login"]', 'a[href*="signin"]', 'a:contains("Sign in")', 'a:contains("Log in")',
    ]),
    signupLink: findFirst<HTMLAnchorElement>(selectors.createAccountLink),
    guestLink: findFirst<HTMLAnchorElement>([
      'a:contains("guest")', 'a:contains("continue without")', 'a:contains("skip")',
      'button:contains("Continue as guest")',
    ]),
  };
}

/**
 * Determine page type based on URL, content, and form elements
 */
function determinePageType(
  url: string, 
  pageText: string, 
  formElements: AccountFormElements
): AccountPageDetection['pageType'] {
  const urlLower = url.toLowerCase();
  
  // Check verification first (usually distinct pages)
  for (const pattern of PAGE_TYPE_PATTERNS.verification.urlPatterns) {
    if (pattern.test(urlLower)) return 'verification';
  }
  for (const pattern of PAGE_TYPE_PATTERNS.verification.textPatterns) {
    if (pattern.test(pageText)) return 'verification';
  }
  
  // Check for password reset
  for (const pattern of PAGE_TYPE_PATTERNS.passwordReset.urlPatterns) {
    if (pattern.test(urlLower)) return 'password-reset';
  }
  for (const pattern of PAGE_TYPE_PATTERNS.passwordReset.textPatterns) {
    if (pattern.test(pageText) && !formElements.confirmPasswordField) return 'password-reset';
  }
  
  // Distinguish between login and signup based on form structure
  const hasConfirmPassword = formElements.confirmPasswordField !== null;
  const hasNameFields = formElements.firstNameField !== null || 
                        formElements.lastNameField !== null || 
                        formElements.fullNameField !== null;
  
  // If there's a confirm password field, likely signup
  if (hasConfirmPassword) return 'signup';
  
  // Check URL patterns
  for (const pattern of PAGE_TYPE_PATTERNS.signup.urlPatterns) {
    if (pattern.test(urlLower)) return 'signup';
  }
  for (const pattern of PAGE_TYPE_PATTERNS.login.urlPatterns) {
    if (pattern.test(urlLower)) return 'login';
  }
  
  // Check text patterns
  let signupScore = 0;
  let loginScore = 0;
  
  for (const pattern of PAGE_TYPE_PATTERNS.signup.textPatterns) {
    if (pattern.test(pageText)) signupScore++;
  }
  for (const pattern of PAGE_TYPE_PATTERNS.login.textPatterns) {
    if (pattern.test(pageText)) loginScore++;
  }
  
  // Name fields suggest signup
  if (hasNameFields) signupScore += 2;
  
  if (signupScore > loginScore) return 'signup';
  if (loginScore > signupScore) return 'login';
  
  // Has email and password but can't determine type
  if (formElements.emailField && formElements.passwordField) {
    return 'login';  // Default to login for ambiguous cases
  }
  
  return 'unknown';
}

/**
 * Determine what action to take based on page type and existing credentials
 */
function determineSuggestedAction(
  pageType: AccountPageDetection['pageType'],
  existingCredential: CredentialMatch | null,
  formElements: AccountFormElements
): AccountAction {
  switch (pageType) {
    case 'login':
      if (existingCredential && existingCredential.confidence >= 0.5) {
        return 'login-with-stored';
      }
      // Check if there's a signup link we should use
      if (formElements.signupLink) {
        return 'create-account';
      }
      return 'manual-required';
      
    case 'signup':
      return 'create-account';
      
    case 'verification':
      return 'await-verification';
      
    case 'password-reset':
      return 'manual-required';
      
    default:
      if (formElements.guestLink) {
        return 'continue-as-guest';
      }
      return 'none';
  }
}

/**
 * Calculate confidence score for detection
 */
function calculateDetectionConfidence(
  pageType: AccountPageDetection['pageType'],
  url: string,
  pageText: string,
  formElements: AccountFormElements
): number {
  if (pageType === 'unknown') return 0;
  
  let confidence = 0.3;  // Base confidence
  
  const patterns = PAGE_TYPE_PATTERNS[pageType === 'password-reset' ? 'passwordReset' : pageType];
  
  // URL match
  for (const pattern of patterns.urlPatterns) {
    if (pattern.test(url)) {
      confidence += 0.25;
      break;
    }
  }
  
  // Text match count
  let textMatches = 0;
  for (const pattern of patterns.textPatterns) {
    if (pattern.test(pageText)) textMatches++;
  }
  confidence += Math.min(0.3, textMatches * 0.1);
  
  // Form elements present
  if (formElements.emailField) confidence += 0.1;
  if (formElements.passwordField) confidence += 0.1;
  if (pageType === 'signup' && formElements.confirmPasswordField) confidence += 0.15;
  
  return Math.min(1, confidence);
}

/**
 * Auto-fill a signup form and create account
 */
export async function handleAccountCreation(
  detection: AccountPageDetection,
  profile?: UserProfile
): Promise<AccountCreationResult> {
  const result: AccountCreationResult = {
    success: false,
    action: detection.suggestedAction,
    errors: [],
    requiresVerification: false,
  };
  
  try {
    // Load profile if not provided
    if (!profile) {
      profile = await storage.getProfile();
    }
    
    if (!profile.email) {
      result.errors.push('No email address in profile');
      return result;
    }
    
    const { formElements, platform } = detection;
    
    switch (detection.suggestedAction) {
      case 'login-with-stored':
        return await handleLogin(detection, formElements);
        
      case 'create-account':
        return await handleSignup(detection, formElements, profile);
        
      case 'await-verification':
        result.requiresVerification = true;
        result.nextStep = 'Check your email for verification link';
        return result;
        
      case 'continue-as-guest':
        if (formElements.guestLink) {
          formElements.guestLink.click();
          result.success = true;
          result.nextStep = 'Continuing as guest...';
        }
        return result;
        
      default:
        result.errors.push('No automatic action available for this page');
        return result;
    }
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    return result;
  }
}

/**
 * Handle login with stored credentials
 */
async function handleLogin(
  detection: AccountPageDetection,
  formElements: AccountFormElements
): Promise<AccountCreationResult> {
  const result: AccountCreationResult = {
    success: false,
    action: 'login-with-stored',
    errors: [],
    requiresVerification: false,
  };
  
  if (!detection.existingCredential) {
    result.errors.push('No stored credential found');
    return result;
  }
  
  const { credential } = detection.existingCredential;
  
  // Fill email
  if (formElements.emailField) {
    await fillField(formElements.emailField, credential.email);
  } else {
    result.errors.push('Email field not found');
    return result;
  }
  
  // Fill password
  if (formElements.passwordField) {
    await fillField(formElements.passwordField, credential.password);
  } else {
    result.errors.push('Password field not found');
    return result;
  }
  
  // Update last used
  await credentialStore.updateLastUsed(credential.id);
  
  result.success = true;
  result.credential = credential;
  result.nextStep = 'Login form filled. Click submit to continue.';
  
  return result;
}

/**
 * Handle signup / account creation
 */
async function handleSignup(
  detection: AccountPageDetection,
  formElements: AccountFormElements,
  profile: UserProfile
): Promise<AccountCreationResult> {
  const result: AccountCreationResult = {
    success: false,
    action: 'create-account',
    errors: [],
    requiresVerification: false,
  };
  
  // Generate secure password
  const password = generateSecurePassword({
    length: 16,
    includeSymbols: true,
  });
  
  // Fill email
  if (formElements.emailField) {
    await fillField(formElements.emailField, profile.email);
  } else {
    result.errors.push('Email field not found');
    return result;
  }
  
  // Fill password
  if (formElements.passwordField) {
    await fillField(formElements.passwordField, password);
  } else {
    result.errors.push('Password field not found');
    return result;
  }
  
  // Fill confirm password if present
  if (formElements.confirmPasswordField) {
    await fillField(formElements.confirmPasswordField, password);
  }
  
  // Fill name fields if present
  if (formElements.firstNameField && profile.firstName) {
    await fillField(formElements.firstNameField, profile.firstName);
  }
  if (formElements.lastNameField && profile.lastName) {
    await fillField(formElements.lastNameField, profile.lastName);
  }
  if (formElements.fullNameField) {
    const fullName = `${profile.firstName} ${profile.lastName}`.trim();
    if (fullName) {
      await fillField(formElements.fullNameField, fullName);
    }
  }
  
  // Fill phone if present
  if (formElements.phoneField && profile.phone) {
    await fillField(formElements.phoneField, profile.phone);
  }
  
  // Store the credential
  const { credential } = await createCredential(
    window.location.href,
    profile.email,
    extractCompanyName(),
    { length: 16, includeSymbols: true }
  );
  
  // Update with actual password used
  credential.password = password;
  
  result.success = true;
  result.credential = credential;
  result.generatedPassword = password;
  result.nextStep = 'Signup form filled. Click submit to create account.';
  
  // Likely will need email verification
  if (detection.platform === 'workday' || detection.pageType === 'signup') {
    result.requiresVerification = true;
    result.nextStep += ' Email verification may be required.';
  }
  
  return result;
}

/**
 * Fill a form field with proper event dispatching
 */
async function fillField(element: HTMLInputElement, value: string): Promise<void> {
  // Focus the element
  element.focus();
  await sleep(50);
  
  // Clear existing value
  element.value = '';
  element.dispatchEvent(new Event('input', { bubbles: true }));
  
  // Set new value
  element.value = value;
  
  // Dispatch events to trigger validation/frameworks
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
  
  // Blur to trigger validation
  element.blur();
  await sleep(50);
}

/**
 * Check if we're on an email verification page
 */
export function isEmailVerificationPage(): boolean {
  const pageText = document.body?.innerText?.toLowerCase() || '';
  
  const verificationPatterns = [
    /check\s*your\s*(email|inbox)/i,
    /verification\s*(email|link)\s*sent/i,
    /we('ve)?\s*sent\s*(you\s*)?(a|an|the)?\s*(verification|confirmation)/i,
    /confirm\s*your\s*email/i,
    /verify\s*your\s*(email|account)/i,
    /click\s*(the|on)\s*(link|button)\s*in\s*(the|your)\s*email/i,
    /didn't\s*receive.*email/i,
    /resend\s*(verification|confirmation)/i,
  ];
  
  return verificationPatterns.some(pattern => pattern.test(pageText));
}

/**
 * Get verification page information
 */
export function getVerificationInfo(): {
  resendButton: HTMLButtonElement | HTMLAnchorElement | null;
  email: string | null;
  platform: string;
} {
  const platform = detectPlatform(window.location.href);
  
  // Try to find resend button
  const resendSelectors = [
    'button:contains("resend")',
    'a:contains("resend")',
    'button:contains("send again")',
    'a:contains("send again")',
    'button[data-automation-id*="resend"]',
  ];
  
  let resendButton: HTMLButtonElement | HTMLAnchorElement | null = null;
  for (const selector of resendSelectors) {
    try {
      if (selector.includes(':contains(')) {
        const match = selector.match(/(.+?):contains\("(.+?)"\)/);
        if (match) {
          const [, tag, text] = match;
          const elements = document.querySelectorAll<HTMLButtonElement | HTMLAnchorElement>(tag);
          for (const el of elements) {
            if (el.textContent?.toLowerCase().includes(text.toLowerCase())) {
              resendButton = el;
              break;
            }
          }
        }
      } else {
        const el = document.querySelector<HTMLButtonElement | HTMLAnchorElement>(selector);
        if (el) {
          resendButton = el;
          break;
        }
      }
    } catch {
      // Skip invalid selectors
    }
    if (resendButton) break;
  }
  
  // Try to extract email from page text
  const pageText = document.body?.innerText || '';
  const emailMatch = pageText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  
  return {
    resendButton,
    email: emailMatch ? emailMatch[0] : null,
    platform,
  };
}

/**
 * Navigate to signup page if on login page
 */
export async function navigateToSignup(formElements: AccountFormElements): Promise<boolean> {
  if (formElements.signupLink) {
    formElements.signupLink.click();
    return true;
  }
  
  // Try common signup link patterns
  const signupLinks = document.querySelectorAll<HTMLAnchorElement>('a');
  for (const link of signupLinks) {
    const text = link.textContent?.toLowerCase() || '';
    const href = link.href?.toLowerCase() || '';
    
    if (
      text.includes('create account') ||
      text.includes('sign up') ||
      text.includes('register') ||
      text.includes('new user') ||
      href.includes('signup') ||
      href.includes('register') ||
      href.includes('create')
    ) {
      link.click();
      return true;
    }
  }
  
  return false;
}

/**
 * Check if account already exists (error message detection)
 */
export function detectAccountExistsError(): boolean {
  const pageText = document.body?.innerText?.toLowerCase() || '';
  
  const existsPatterns = [
    /account.*already\s*exists/i,
    /email.*already\s*(registered|in use|taken)/i,
    /user.*already\s*exists/i,
    /already\s*have\s*an?\s*account/i,
    /email\s*is\s*already\s*associated/i,
    /this\s*email\s*address\s*is\s*already/i,
  ];
  
  return existsPatterns.some(pattern => pattern.test(pageText));
}

/**
 * Handle "account already exists" scenario
 */
export async function handleAccountExistsError(email: string): Promise<{
  hasStoredCredential: boolean;
  credential: StoredCredential | null;
  suggestion: string;
}> {
  const credentials = await credentialStore.findByEmail(email);
  
  if (credentials.length > 0) {
    // Find credential for this domain
    const domain = window.location.hostname;
    const matchingCred = credentials.find(c => c.domain.includes(domain));
    
    if (matchingCred) {
      return {
        hasStoredCredential: true,
        credential: matchingCred,
        suggestion: 'Found stored credential. Navigate to login page to use it.',
      };
    }
  }
  
  return {
    hasStoredCredential: false,
    credential: null,
    suggestion: 'Account exists but no stored credential found. Try password reset or manual login.',
  };
}

/**
 * Extract company name from page context
 */
function extractCompanyName(): string | undefined {
  // Try meta tags
  const ogSiteName = document.querySelector<HTMLMetaElement>('meta[property="og:site_name"]');
  if (ogSiteName?.content) return ogSiteName.content;
  
  // Try title
  const title = document.title;
  const companyPatterns = [
    /(.+?)\s*[-|–]\s*(?:careers|jobs|apply|hiring)/i,
    /(?:careers|jobs)\s*(?:at|@)\s*(.+)/i,
    /(.+?)\s*careers/i,
  ];
  
  for (const pattern of companyPatterns) {
    const match = title.match(pattern);
    if (match) return match[1].trim();
  }
  
  // Try common elements
  const logoAlt = document.querySelector<HTMLImageElement>('img[alt*="logo"]');
  if (logoAlt?.alt) {
    return logoAlt.alt.replace(/\s*logo\s*/i, '').trim();
  }
  
  return undefined;
}

/**
 * Check element visibility
 */
function isVisible(el: HTMLElement): boolean {
  if (!el) return false;
  const style = window.getComputedStyle(el);
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0' &&
    el.offsetParent !== null
  );
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Show notification about account action
 */
export function showAccountNotification(result: AccountCreationResult): void {
  const notification = document.createElement('div');
  notification.id = 'ai-account-notification';
  
  let content = '';
  let bgColor = '#667eea';
  
  if (result.success) {
    if (result.action === 'create-account') {
      bgColor = '#10b981';
      content = `
        <h3>🔐 Account Created</h3>
        <p>Password: <code style="background: rgba(255,255,255,0.2); padding: 2px 6px; border-radius: 4px; font-family: monospace;">${result.generatedPassword}</code></p>
        <p class="hint">Password saved. ${result.requiresVerification ? 'Check email for verification.' : 'Ready to apply!'}</p>
      `;
    } else if (result.action === 'login-with-stored') {
      bgColor = '#3b82f6';
      content = `
        <h3>🔑 Login Ready</h3>
        <p>Using stored credentials for ${result.credential?.email}</p>
        <p class="hint">Click submit to log in.</p>
      `;
    }
  } else {
    bgColor = '#ef4444';
    content = `
      <h3>⚠️ Account Issue</h3>
      <p>${result.errors.join(', ')}</p>
    `;
  }
  
  notification.innerHTML = `
    <div class="account-notification-content">
      ${content}
      <button id="account-notif-close" class="close-btn">×</button>
    </div>
    <style>
      #ai-account-notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${bgColor};
        color: white;
        padding: 16px 20px;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        z-index: 9999999;
        max-width: 380px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        animation: slideIn 0.3s ease;
      }
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      .account-notification-content { position: relative; }
      .account-notification-content h3 {
        margin: 0 0 8px;
        font-size: 15px;
        padding-right: 24px;
      }
      .account-notification-content p {
        margin: 4px 0;
        font-size: 13px;
        opacity: 0.95;
      }
      .account-notification-content .hint {
        margin-top: 8px;
        font-style: italic;
        opacity: 0.85;
      }
      .close-btn {
        position: absolute;
        top: -4px;
        right: -8px;
        background: none;
        border: none;
        color: white;
        font-size: 20px;
        cursor: pointer;
        opacity: 0.7;
        padding: 4px 8px;
      }
      .close-btn:hover { opacity: 1; }
    </style>
  `;
  
  document.body.appendChild(notification);
  
  notification.querySelector('#account-notif-close')?.addEventListener('click', () => {
    notification.remove();
  });
  
  // Auto-dismiss after 15 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 15000);
}

/**
 * Main entry point - detect and handle account pages automatically
 */
export async function autoHandleAccountPage(): Promise<AccountCreationResult | null> {
  const detection = await detectAccountPage();
  
  console.log('[AccountHandler] Detection:', detection);
  
  if (detection.confidence < 0.4 || detection.suggestedAction === 'none') {
    return null;
  }
  
  const result = await handleAccountCreation(detection);
  
  if (result.success || result.errors.length > 0) {
    showAccountNotification(result);
  }
  
  return result;
}

// Export detection function for use in content script
export { detectPlatform } from './credential-store';
