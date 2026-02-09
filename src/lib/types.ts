// User profile data
export interface UserProfile {
  // Personal Info
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  
  // Address
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  
  // Links
  linkedinUrl: string;
  githubUrl: string;
  portfolioUrl: string;
  
  // Education
  university: string;
  degree: string;
  major: string;
  gpa: string;
  graduationDate: string;
  
  // Work
  workAuthorization: 'us_citizen' | 'permanent_resident' | 'visa' | 'other';
  yearsOfExperience: string;
  
  // Resume
  resumeText: string;
  resumeFileName: string;
  
  // Skills
  skills: string[];
  
  // Projects (for AI to reference)
  projects: ProjectDescription[];
}

export interface ProjectDescription {
  name: string;
  description: string;
  technologies: string[];
  highlights: string[];
}

// Form field detection
export interface DetectedField {
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  fieldType: FieldType;
  label: string;
  isRequired: boolean;
  confidence: number;
}

export type FieldType = 
  | 'firstName'
  | 'lastName'
  | 'fullName'
  | 'email'
  | 'phone'
  | 'address'
  | 'city'
  | 'state'
  | 'zipCode'
  | 'country'
  | 'linkedin'
  | 'github'
  | 'portfolio'
  | 'university'
  | 'degree'
  | 'major'
  | 'gpa'
  | 'graduationDate'
  | 'workAuthorization'
  | 'yearsOfExperience'
  | 'resume'
  | 'coverLetter'
  | 'openEnded'
  | 'unknown';

// AI Response request
export interface AIResponseRequest {
  question: string;
  companyName: string;
  jobTitle: string;
  userProfile: UserProfile;
  maxLength?: number;
}

// Application tracking
export interface ApplicationRecord {
  id: string;
  companyName: string;
  jobTitle: string;
  jobUrl: string;
  appliedAt: string;
  status: 'applied' | 'in_progress' | 'saved';
  aiResponsesUsed: string[];
}

// Storage keys
export const STORAGE_KEYS = {
  USER_PROFILE: 'userProfile',
  APPLICATIONS: 'applications',
  API_KEY: 'apiKey',
  AI_PROVIDER: 'aiProvider',
  SETTINGS: 'settings',
} as const;

// Settings
export interface Settings {
  aiProvider: 'openai' | 'anthropic' | 'discord';
  autoFillEnabled: boolean;
  showPreviewBeforeFill: boolean;
  darkMode: boolean;
  noAiMode: boolean;  // Use only templates, no API calls
  preferTemplates: boolean;  // Try templates before AI to save costs
  testMode: boolean;  // Discord-based testing mode (Ronald responds)
}

export const DEFAULT_SETTINGS: Settings = {
  aiProvider: 'openai',
  autoFillEnabled: true,
  showPreviewBeforeFill: true,
  darkMode: false,
  noAiMode: false,
  preferTemplates: true,
  testMode: false,
};

export const DEFAULT_PROFILE: UserProfile = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  zipCode: '',
  country: 'United States',
  linkedinUrl: '',
  githubUrl: '',
  portfolioUrl: '',
  university: '',
  degree: '',
  major: '',
  gpa: '',
  graduationDate: '',
  workAuthorization: 'us_citizen',
  yearsOfExperience: '',
  resumeText: '',
  resumeFileName: '',
  skills: [],
  projects: [],
};
