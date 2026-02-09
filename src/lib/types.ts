// ====================
// Job Source Types
// ====================

export type JobSource = 'greenhouse' | 'workday' | 'github' | 'handshake' | 'manual';
export type JobType = 'full-time' | 'part-time' | 'internship' | 'contract' | 'unknown';
export type ExperienceLevel = 'entry' | 'mid' | 'senior' | 'lead' | 'unknown';

export interface Job {
  // Core identifiers
  id: string;
  source: JobSource;
  sourceId: string;  // Original ID from the source
  
  // Company info
  company: string;
  companyLogo?: string;
  companyUrl?: string;
  
  // Job details
  title: string;
  description: string;
  shortDescription?: string;
  
  // Location
  location: string;
  isRemote: boolean;
  
  // Classification
  jobType: JobType;
  experienceLevel: ExperienceLevel;
  department?: string;
  team?: string;
  
  // Requirements
  skills?: string[];
  requirements?: string[];
  qualifications?: string[];
  
  // Compensation
  salary?: {
    min?: number;
    max?: number;
    currency: string;
    period: 'hourly' | 'yearly';
  };
  
  // Application
  applicationUrl: string;
  applicationDeadline?: string;
  
  // Metadata
  postedAt?: string;
  updatedAt?: string;
  scrapedAt: string;
  
  // For tracking
  tags?: string[];
  sponsorsVisa?: boolean;
}

export interface JobSearchParams {
  keywords?: string[];
  location?: string;
  remote?: boolean;
  jobType?: JobType;
  experienceLevel?: ExperienceLevel;
  companies?: string[];
  limit?: number;
}

export interface JobSourceResult {
  jobs: Job[];
  source: JobSource;
  fetchedAt: string;
  hasMore: boolean;
  nextCursor?: string;
  error?: string;
}

// ====================
// User Profile Types
// ====================

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

// Resume variant types
export type ResumeFormat = 'docx' | 'latex' | 'pdf';

export interface ResumeVariantMetadata {
  id: string;
  name: string;
  tags: string[];
  format: ResumeFormat;
  fileName: string;
  fileSize: number;
  createdAt: string;
  updatedAt: string;
  isDefault: boolean;
  isOneOff: boolean;  // One-off slots can be overwritten
  oneOffSlot?: string;  // Slot name for one-off resumes (e.g., "quick-edit")
}

export interface ResumeVariant extends ResumeVariantMetadata {
  fileData: ArrayBuffer;
}

export interface ResumeCollection {
  variants: ResumeVariantMetadata[];
  defaultId: string | null;
  oneOffSlots: Record<string, string>;  // slotName -> resumeId
}

// Storage keys
export const STORAGE_KEYS = {
  USER_PROFILE: 'userProfile',
  APPLICATIONS: 'applications',
  API_KEY: 'apiKey',
  AI_PROVIDER: 'aiProvider',
  SETTINGS: 'settings',
  RESUME_COLLECTION: 'resumeCollection',
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
  webhookEnabled: boolean;  // Send Discord webhook on successful fill
  webhookUrl: string;  // Custom webhook URL (optional)
}

export const DEFAULT_WEBHOOK_URL = 'https://discord.com/api/webhooks/1470479336296419419/j4NJFVqVzBq9OScJC5YVdJn9k8GlmvzEWUOajYOSrQal3kga2afu_PiH9eyqv8oDD9iC';

export const DEFAULT_SETTINGS: Settings = {
  aiProvider: 'openai',
  autoFillEnabled: true,
  showPreviewBeforeFill: true,
  darkMode: false,
  noAiMode: false,
  preferTemplates: true,
  testMode: false,
  webhookEnabled: true,
  webhookUrl: DEFAULT_WEBHOOK_URL,
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
