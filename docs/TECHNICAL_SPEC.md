# Job Finder Technical Specification
## Version 1.1 - Final Spec

**Last Updated:** 2025-01-18  
**Status:** Approved for Implementation

---

## Table of Contents
1. [Overview](#1-overview)
2. [Data Models & TypeScript Interfaces](#2-data-models--typescript-interfaces)
3. [Storage Schema](#3-storage-schema)
4. [Job Source Integrations](#4-job-source-integrations)
5. [UI Components](#5-ui-components)
6. [Heartbeat/Pulse System](#6-heartbeatpulse-system)
7. [Matching Algorithm](#7-matching-algorithm)
8. [Apply Flow & Automation Modes](#8-apply-flow--automation-modes)
9. [Feedback & Learning System](#9-feedback--learning-system) *(NEW)*
10. [Application Logs & History](#10-application-logs--history) *(NEW)*
11. [Implementation Order](#11-implementation-order)

---

## 1. Overview

### 1.1 Product Summary
A job discovery platform that helps **interns and new grads** find relevant positions based on company "vibes" - matching users with companies similar to their target employers. The system uses a heartbeat pulse to catch new listings and provides multiple application modes from manual to fully automated.

### 1.2 Core Principles
- **Minimal User Interaction** - Automate everything possible; user only reviews when needed
- **Quality over Quantity** - Better matches beat more applications
- **Vibes-Based Matching** - Company culture/fit matters more than job source
- **No LinkedIn Scraping** - Respect platform ToS and bot protection
- **User Control** - Adjustable weights, configurable automation levels
- **Learn & Improve** - AI learns from user feedback and manual actions

### 1.3 Target Users
- **Primary:** Intern and new grad job seekers
- **Future:** Expandable to search by experience level

### 1.4 Key Features
- Company-based job discovery (pick companies → find similar)
- Adjustable matching weights via sliders
- Dream company watchlist with priority scraping
- On-demand search + background heartbeat pulse
- One-click apply with review page stop
- Optional full-auto and swarm modes

---

## 2. Data Models & TypeScript Interfaces

### 2.1 User & Profile

```typescript
// src/types/user.ts

export interface User {
  id: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
  profile: UserProfile;
  preferences: UserPreferences;
  onboarding: OnboardingState;
}

export interface UserProfile {
  // Personal
  firstName: string;
  lastName: string;
  phone: string;
  location: Location;
  
  // Professional
  resumeUrl: string;
  resumeText: string;  // Parsed text for matching
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  
  // Education
  education: Education[];
  
  // Experience
  experienceLevel: ExperienceLevel;
  yearsOfExperience: number;
  workAuthorization: WorkAuthorization;
  
  // Skills (extracted from resume + manual)
  skills: string[];
  
  // Industry preferences
  targetIndustries: Industry[];
}

export interface Location {
  city: string;
  state: string;
  country: string;
  zipCode?: string;
  remoteOk: boolean;
  willingToRelocate: boolean;
  preferredLocations?: string[];  // Cities/metros
}

export interface Education {
  institution: string;
  degree: DegreeType;
  major: string;
  minor?: string;
  gpa?: number;
  graduationDate: Date;
  current: boolean;
}

export type DegreeType = 
  | 'high_school'
  | 'associate'
  | 'bachelor'
  | 'master'
  | 'phd'
  | 'bootcamp'
  | 'certificate';

export type ExperienceLevel = 'intern' | 'new_grad' | 'entry' | 'mid' | 'senior' | 'lead' | 'executive';

export type WorkAuthorization = 
  | 'us_citizen'
  | 'permanent_resident'
  | 'opt'
  | 'cpt'
  | 'h1b'
  | 'h1b_transfer'
  | 'other_visa'
  | 'need_sponsorship';

export interface UserPreferences {
  // Matching weights (0-100, user adjustable)
  weights: MatchingWeights;
  
  // Search filters
  minSalary?: number;
  maxSalary?: number;
  jobTypes: JobType[];
  
  // Heartbeat config
  heartbeatFrequencyMinutes: number;  // Default: 60
  heartbeatEnabled: boolean;
  
  // Apply settings
  applyMode: ApplyMode;
  dailyApplicationLimit: number;  // For auto modes
  
  // UI
  resultsPerPage: number;  // Default: 25
  darkMode: boolean;
}

export interface MatchingWeights {
  companyFit: number;      // How similar to seed companies (0-100)
  industryMatch: number;   // Industry alignment (0-100)
  locationMatch: number;   // Location preference (0-100)
  salaryMatch: number;     // Salary range fit (0-100)
  skillsMatch: number;     // Skills overlap (0-100)
  roleRelevance: number;   // Job title/role fit (0-100)
  companySize: number;     // Preference for company size (0-100)
  companyGrowth: number;   // Growth stage preference (0-100)
}

export const DEFAULT_WEIGHTS: MatchingWeights = {
  companyFit: 80,
  industryMatch: 70,
  locationMatch: 60,
  salaryMatch: 50,
  skillsMatch: 75,
  roleRelevance: 85,
  companySize: 40,
  companyGrowth: 45,
};

export type JobType = 'full_time' | 'part_time' | 'contract' | 'internship';
export type ApplyMode = 'manual' | 'one_click' | 'full_auto' | 'swarm';

export interface OnboardingState {
  completed: boolean;
  step: number;
  resumeUploaded: boolean;
  industriesSelected: boolean;
  companiesSelected: boolean;
  weightsConfigured: boolean;
}
```

### 2.2 Company & Industry

```typescript
// src/types/company.ts

export interface Company {
  id: string;
  name: string;
  slug: string;  // URL-friendly name
  
  // Basic info
  description?: string;
  website: string;
  logo?: string;
  
  // Classification
  industry: Industry;
  subIndustry?: string;
  size: CompanySize;
  type: CompanyType;
  
  // Metadata for matching
  founded?: number;
  headquarters?: string;
  locations: string[];
  
  // Career page info
  careerPageUrl?: string;
  careerPageType: CareerPageType;
  
  // Vibes data (for similarity matching)
  vibes: CompanyVibes;
  
  // Tracking
  lastScraped?: Date;
  jobCount: number;
  isActive: boolean;
}

export interface CompanyVibes {
  // Embedding vector for similarity search
  embedding?: number[];
  
  // Categorical attributes
  culture: CultureTag[];
  techStack: string[];
  perks: string[];
  workStyle: WorkStyle[];
  
  // Derived scores
  glassdoorRating?: number;
  growthScore?: number;  // Funding, hiring velocity
  innovationScore?: number;
}

export type Industry = 
  | 'technology'
  | 'finance'
  | 'healthcare'
  | 'retail'
  | 'manufacturing'
  | 'consulting'
  | 'media'
  | 'education'
  | 'government'
  | 'nonprofit'
  | 'energy'
  | 'real_estate'
  | 'transportation'
  | 'hospitality'
  | 'other';

export type CompanySize = 
  | 'startup'      // 1-10
  | 'small'        // 11-50
  | 'medium'       // 51-200
  | 'large'        // 201-1000
  | 'enterprise';  // 1000+

export type CompanyType = 
  | 'public'
  | 'private'
  | 'startup'
  | 'nonprofit'
  | 'government';

export type CareerPageType = 
  | 'greenhouse'
  | 'workday'
  | 'oracle_taleo'
  | 'lever'
  | 'icims'
  | 'ashby'
  | 'custom'
  | 'unknown';

export type CultureTag = 
  | 'remote_first'
  | 'hybrid'
  | 'in_office'
  | 'startup_culture'
  | 'corporate'
  | 'flat_hierarchy'
  | 'work_life_balance'
  | 'fast_paced'
  | 'mission_driven'
  | 'data_driven'
  | 'engineering_focused'
  | 'sales_driven';

export type WorkStyle = 'remote' | 'hybrid' | 'onsite';

// User's relationship with companies
export interface UserCompany {
  userId: string;
  companyId: string;
  relationship: CompanyRelationship;
  addedAt: Date;
  notes?: string;
}

export type CompanyRelationship = 
  | 'seed'       // Used to seed the algorithm
  | 'dream'      // Dream company (priority scraping)
  | 'interested' // Saved/bookmarked
  | 'applied'    // Has applied to
  | 'blocked';   // Don't show jobs from
```

### 2.3 Jobs

```typescript
// src/types/job.ts

export interface Job {
  id: string;
  externalId: string;  // ID from source system
  
  // Basic info
  title: string;
  description: string;
  descriptionHtml?: string;
  
  // Company
  companyId: string;
  companyName: string;  // Denormalized for display
  
  // Location
  location: string;
  locationType: LocationType;
  remoteAllowed: boolean;
  
  // Classification
  department?: string;
  experienceLevel: ExperienceLevel;
  jobType: JobType;
  
  // Compensation
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  salaryPeriod?: 'hourly' | 'annual';
  
  // Requirements
  requiredSkills: string[];
  preferredSkills: string[];
  educationRequired?: DegreeType;
  yearsExperienceRequired?: number;
  
  // Application
  applyUrl: string;
  source: JobSource;
  
  // Tracking
  postedAt?: Date;
  discoveredAt: Date;
  expiresAt?: Date;
  lastSeenAt: Date;
  isActive: boolean;
  
  // Matching (computed per user)
  matchScore?: number;
  matchBreakdown?: MatchBreakdown;
}

export type LocationType = 'onsite' | 'hybrid' | 'remote';

export type JobSource = 
  | 'greenhouse'
  | 'workday'
  | 'oracle_taleo'
  | 'lever'
  | 'icims'
  | 'ashby'
  | 'handshake'
  | 'github_repo'      // Simplify, Pitt CSC, SpeedyApply repos
  | 'company_direct'
  | 'manual';

export interface MatchBreakdown {
  companyFit: number;
  industryMatch: number;
  locationMatch: number;
  salaryMatch: number;
  skillsMatch: number;
  roleRelevance: number;
  companySize: number;
  companyGrowth: number;
  totalScore: number;  // Weighted average
}

// User's interaction with jobs
export interface UserJob {
  userId: string;
  jobId: string;
  status: JobStatus;
  
  // Tracking
  firstSeenAt: Date;
  savedAt?: Date;
  appliedAt?: Date;
  hiddenAt?: Date;
  
  // Application
  applicationId?: string;
  
  // User feedback
  feedback?: JobFeedback;
  notes?: string;
}

export type JobStatus = 
  | 'new'
  | 'viewed'
  | 'saved'
  | 'applied'
  | 'hidden'
  | 'expired';

export type JobFeedback = 
  | 'great_match'
  | 'good_match'
  | 'okay_match'
  | 'bad_match'
  | 'not_interested';
```

### 2.4 Applications

```typescript
// src/types/application.ts

export interface Application {
  id: string;
  userId: string;
  jobId: string;
  
  // Denormalized for display
  companyName: string;
  jobTitle: string;
  
  // Status
  status: ApplicationStatus;
  statusHistory: StatusChange[];
  
  // Timing
  createdAt: Date;
  submittedAt?: Date;
  lastUpdatedAt: Date;
  
  // Form data
  formData: ApplicationFormData;
  
  // Automation
  applyMode: ApplyMode;
  automationSteps: AutomationStep[];
  
  // Resume version used
  resumeVersionId?: string;
  coverLetterId?: string;
}

export type ApplicationStatus = 
  | 'draft'           // Started but not submitted
  | 'pending_review'  // Ready to submit, waiting for user review
  | 'submitting'      // In progress
  | 'submitted'       // Successfully submitted
  | 'failed'          // Submission failed
  | 'withdrawn';      // User withdrew

export interface StatusChange {
  status: ApplicationStatus;
  timestamp: Date;
  reason?: string;
}

export interface ApplicationFormData {
  // Standard fields
  resume?: File | string;
  coverLetter?: string;
  
  // Common questions
  sponsorshipNeeded?: boolean;
  startDate?: string;
  salary?: number;
  
  // Custom questions (job-specific)
  customResponses: Record<string, string>;
}

export interface AutomationStep {
  step: number;
  action: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  timestamp?: Date;
  error?: string;
}
```

### 2.5 Heartbeat & Scraping

```typescript
// src/types/heartbeat.ts

export interface HeartbeatConfig {
  userId: string;
  enabled: boolean;
  frequencyMinutes: number;
  
  // What to scrape
  scrapeDreamCompanies: boolean;  // Priority
  scrapeSeedSimilar: boolean;     // Companies similar to seeds
  scrapeAllMatches: boolean;      // All matching companies
  
  // Limits
  maxCompaniesPerPulse: number;
  
  // Schedule
  activeHours?: {
    start: number;  // 0-23
    end: number;    // 0-23
    timezone: string;
  };
}

export interface HeartbeatRun {
  id: string;
  userId: string;
  startedAt: Date;
  completedAt?: Date;
  status: 'running' | 'completed' | 'failed';
  
  // Results
  companiesScraped: number;
  newJobsFound: number;
  errors: HeartbeatError[];
}

export interface HeartbeatError {
  companyId: string;
  error: string;
  timestamp: Date;
}

export interface ScrapeJob {
  id: string;
  companyId: string;
  careerPageUrl: string;
  careerPageType: CareerPageType;
  
  // Scheduling
  priority: 'high' | 'normal' | 'low';
  scheduledAt: Date;
  attemptCount: number;
  
  // Status
  status: 'pending' | 'running' | 'completed' | 'failed';
  lastAttemptAt?: Date;
  error?: string;
  
  // Results
  jobsFound?: number;
  newJobsFound?: number;
}
```

---

## 3. Storage Schema

### 3.1 Database Schema (PostgreSQL)

```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(50),
  
  -- Location
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100) DEFAULT 'United States',
  zip_code VARCHAR(20),
  remote_ok BOOLEAN DEFAULT true,
  willing_to_relocate BOOLEAN DEFAULT false,
  
  -- Professional
  resume_url TEXT,
  resume_text TEXT,
  linkedin_url VARCHAR(255),
  github_url VARCHAR(255),
  portfolio_url VARCHAR(255),
  
  -- Experience
  experience_level VARCHAR(50) DEFAULT 'new_grad',
  years_of_experience DECIMAL(4,1) DEFAULT 0,
  work_authorization VARCHAR(50),
  
  -- Arrays stored as JSONB
  skills JSONB DEFAULT '[]',
  target_industries JSONB DEFAULT '[]',
  preferred_locations JSONB DEFAULT '[]',
  
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_education (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  institution VARCHAR(255) NOT NULL,
  degree VARCHAR(50),
  major VARCHAR(100),
  minor VARCHAR(100),
  gpa DECIMAL(3,2),
  graduation_date DATE,
  is_current BOOLEAN DEFAULT false
);

CREATE TABLE user_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  
  -- Matching weights (stored as JSONB for flexibility)
  weights JSONB DEFAULT '{
    "companyFit": 80,
    "industryMatch": 70,
    "locationMatch": 60,
    "salaryMatch": 50,
    "skillsMatch": 75,
    "roleRelevance": 85,
    "companySize": 40,
    "companyGrowth": 45
  }',
  
  -- Filters
  min_salary INTEGER,
  max_salary INTEGER,
  job_types JSONB DEFAULT '["full_time", "internship"]',
  
  -- Heartbeat
  heartbeat_frequency_minutes INTEGER DEFAULT 60,
  heartbeat_enabled BOOLEAN DEFAULT true,
  
  -- Apply
  apply_mode VARCHAR(20) DEFAULT 'one_click',
  daily_application_limit INTEGER DEFAULT 20,
  
  -- UI
  results_per_page INTEGER DEFAULT 25,
  dark_mode BOOLEAN DEFAULT false,
  
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Companies
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  
  description TEXT,
  website VARCHAR(255),
  logo_url VARCHAR(255),
  
  industry VARCHAR(50),
  sub_industry VARCHAR(100),
  size VARCHAR(20),
  type VARCHAR(20),
  
  founded INTEGER,
  headquarters VARCHAR(100),
  locations JSONB DEFAULT '[]',
  
  career_page_url VARCHAR(255),
  career_page_type VARCHAR(50),
  
  -- Vibes data
  vibes JSONB DEFAULT '{}',
  embedding vector(1536),  -- For pgvector similarity search
  
  last_scraped TIMESTAMP,
  job_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_companies_industry ON companies(industry);
CREATE INDEX idx_companies_size ON companies(size);
CREATE INDEX idx_companies_embedding ON companies USING ivfflat (embedding vector_cosine_ops);

-- User-Company relationships
CREATE TABLE user_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  company_id UUID REFERENCES companies(id),
  relationship VARCHAR(20) NOT NULL,  -- seed, dream, interested, applied, blocked
  added_at TIMESTAMP DEFAULT NOW(),
  notes TEXT,
  UNIQUE(user_id, company_id)
);

CREATE INDEX idx_user_companies_user ON user_companies(user_id);
CREATE INDEX idx_user_companies_relationship ON user_companies(relationship);

-- Jobs
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id VARCHAR(255) NOT NULL,
  
  title VARCHAR(255) NOT NULL,
  description TEXT,
  description_html TEXT,
  
  company_id UUID REFERENCES companies(id),
  company_name VARCHAR(255),  -- Denormalized
  
  location VARCHAR(255),
  location_type VARCHAR(20),
  remote_allowed BOOLEAN DEFAULT false,
  
  department VARCHAR(100),
  experience_level VARCHAR(20),
  job_type VARCHAR(20),
  
  salary_min INTEGER,
  salary_max INTEGER,
  salary_currency VARCHAR(10) DEFAULT 'USD',
  salary_period VARCHAR(20) DEFAULT 'annual',
  
  required_skills JSONB DEFAULT '[]',
  preferred_skills JSONB DEFAULT '[]',
  education_required VARCHAR(50),
  years_experience_required INTEGER,
  
  apply_url TEXT NOT NULL,
  source VARCHAR(50) NOT NULL,
  
  posted_at TIMESTAMP,
  discovered_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  last_seen_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  
  -- Full-text search
  search_vector tsvector,
  
  UNIQUE(company_id, external_id)
);

CREATE INDEX idx_jobs_company ON jobs(company_id);
CREATE INDEX idx_jobs_experience ON jobs(experience_level);
CREATE INDEX idx_jobs_source ON jobs(source);
CREATE INDEX idx_jobs_active ON jobs(is_active) WHERE is_active = true;
CREATE INDEX idx_jobs_search ON jobs USING gin(search_vector);

-- User-Job interactions
CREATE TABLE user_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  job_id UUID REFERENCES jobs(id),
  status VARCHAR(20) DEFAULT 'new',
  
  first_seen_at TIMESTAMP DEFAULT NOW(),
  saved_at TIMESTAMP,
  applied_at TIMESTAMP,
  hidden_at TIMESTAMP,
  
  application_id UUID,
  feedback VARCHAR(20),
  notes TEXT,
  
  -- Computed match score (cached)
  match_score DECIMAL(5,2),
  match_breakdown JSONB,
  
  UNIQUE(user_id, job_id)
);

CREATE INDEX idx_user_jobs_user ON user_jobs(user_id);
CREATE INDEX idx_user_jobs_status ON user_jobs(status);
CREATE INDEX idx_user_jobs_score ON user_jobs(match_score DESC);

-- Applications
CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  job_id UUID REFERENCES jobs(id),
  
  company_name VARCHAR(255),
  job_title VARCHAR(255),
  
  status VARCHAR(20) DEFAULT 'draft',
  status_history JSONB DEFAULT '[]',
  
  created_at TIMESTAMP DEFAULT NOW(),
  submitted_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW(),
  
  form_data JSONB DEFAULT '{}',
  apply_mode VARCHAR(20),
  automation_steps JSONB DEFAULT '[]',
  
  resume_version_id UUID,
  cover_letter_id UUID
);

CREATE INDEX idx_applications_user ON applications(user_id);
CREATE INDEX idx_applications_status ON applications(status);

-- Heartbeat runs
CREATE TABLE heartbeat_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  status VARCHAR(20) DEFAULT 'running',
  
  companies_scraped INTEGER DEFAULT 0,
  new_jobs_found INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]'
);

-- Scrape queue
CREATE TABLE scrape_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  career_page_url VARCHAR(255) NOT NULL,
  career_page_type VARCHAR(50),
  
  priority VARCHAR(10) DEFAULT 'normal',
  scheduled_at TIMESTAMP DEFAULT NOW(),
  attempt_count INTEGER DEFAULT 0,
  
  status VARCHAR(20) DEFAULT 'pending',
  last_attempt_at TIMESTAMP,
  error TEXT,
  
  jobs_found INTEGER,
  new_jobs_found INTEGER
);

CREATE INDEX idx_scrape_queue_status ON scrape_queue(status, priority, scheduled_at);
```

### 3.2 Local Storage (Client-Side Cache)

```typescript
// src/storage/localStorage.ts

interface LocalStorageSchema {
  // Auth
  'auth:token': string;
  'auth:refreshToken': string;
  'auth:expiresAt': number;
  
  // User cache
  'user:profile': UserProfile;
  'user:preferences': UserPreferences;
  
  // UI state
  'ui:sidebarOpen': boolean;
  'ui:filters': FilterState;
  'ui:lastSearchQuery': string;
  
  // Job cache (limited, for offline)
  'cache:recentJobs': Job[];
  'cache:savedJobs': Job[];
  
  // Onboarding
  'onboarding:step': number;
  'onboarding:completed': boolean;
}
```

---

## 4. Job Source Integrations

### 4.1 Integration Architecture

```typescript
// src/scrapers/types.ts

export interface JobScraper {
  name: JobSource;
  canScrape(url: string): boolean;
  scrape(config: ScrapeConfig): Promise<ScrapeResult>;
  getJobDetails?(jobId: string): Promise<Job | null>;
}

export interface ScrapeConfig {
  companyId: string;
  careerPageUrl: string;
  filters?: {
    experienceLevel?: ExperienceLevel[];
    department?: string[];
  };
  maxJobs?: number;
}

export interface ScrapeResult {
  success: boolean;
  jobs: Partial<Job>[];
  nextPageUrl?: string;
  error?: string;
  metadata?: {
    totalJobs?: number;
    scrapedAt: Date;
  };
}
```

### 4.2 Greenhouse Integration (API-First)

```typescript
// src/scrapers/greenhouse.ts

export class GreenhouseScraper implements JobScraper {
  name: JobSource = 'greenhouse';
  
  canScrape(url: string): boolean {
    return url.includes('boards.greenhouse.io') || 
           url.includes('job-boards.greenhouse.io');
  }
  
  async scrape(config: ScrapeConfig): Promise<ScrapeResult> {
    // Greenhouse has a public JSON API!
    // https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs
    
    const boardToken = this.extractBoardToken(config.careerPageUrl);
    const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs`;
    
    const response = await fetch(apiUrl);
    const data = await response.json();
    
    return {
      success: true,
      jobs: data.jobs.map(this.transformJob),
      metadata: {
        totalJobs: data.jobs.length,
        scrapedAt: new Date(),
      },
    };
  }
  
  private transformJob(ghJob: any): Partial<Job> {
    return {
      externalId: ghJob.id.toString(),
      title: ghJob.title,
      location: ghJob.location?.name || 'Remote',
      applyUrl: ghJob.absolute_url,
      department: ghJob.departments?.[0]?.name,
      source: 'greenhouse',
      postedAt: new Date(ghJob.updated_at),
    };
  }
  
  async getJobDetails(jobId: string): Promise<Job | null> {
    // Greenhouse also provides individual job details
    // https://boards-api.greenhouse.io/v1/boards/{board}/jobs/{job_id}
    // Includes full description HTML
  }
}
```

### 4.3 Workday Scraper (HTML Parsing)

```typescript
// src/scrapers/workday.ts

export class WorkdayScraper implements JobScraper {
  name: JobSource = 'workday';
  
  canScrape(url: string): boolean {
    return url.includes('myworkdayjobs.com') ||
           url.includes('.wd1.myworkdayjobs.com') ||
           url.includes('.wd5.myworkdayjobs.com');
  }
  
  async scrape(config: ScrapeConfig): Promise<ScrapeResult> {
    // Workday uses a REST API under the hood
    // Need to extract tenant ID and use their search endpoint
    
    const tenantInfo = this.extractTenantInfo(config.careerPageUrl);
    const searchUrl = this.buildSearchUrl(tenantInfo);
    
    // Workday returns paginated JSON
    const response = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        appliedFacets: {},
        limit: 20,
        offset: 0,
        searchText: '',
      }),
    });
    
    const data = await response.json();
    
    return {
      success: true,
      jobs: data.jobPostings.map(this.transformJob),
      metadata: {
        totalJobs: data.total,
        scrapedAt: new Date(),
      },
    };
  }
  
  private transformJob(wdJob: any): Partial<Job> {
    return {
      externalId: wdJob.bulletFields?.[0] || wdJob.title,
      title: wdJob.title,
      location: wdJob.locationsText,
      applyUrl: wdJob.externalPath,
      postedAt: new Date(wdJob.postedOn),
      source: 'workday',
    };
  }
}
```

### 4.4 Oracle/Taleo Scraper

```typescript
// src/scrapers/oracle-taleo.ts

export class OracleTaleoScraper implements JobScraper {
  name: JobSource = 'oracle_taleo';
  
  canScrape(url: string): boolean {
    return url.includes('taleo.net') ||
           url.includes('oracle.com/careers') ||
           url.includes('careers.oracle.com');
  }
  
  async scrape(config: ScrapeConfig): Promise<ScrapeResult> {
    // Taleo uses OData-style REST APIs
    // Pattern: /careersection/{section}/jobsearch.ftl
    
    // Need browser automation for some Taleo implementations
    // as they heavily rely on JavaScript rendering
  }
}
```

### 4.5 Handshake Integration

```typescript
// src/scrapers/handshake.ts

export class HandshakeScraper implements JobScraper {
  name: JobSource = 'handshake';
  
  // Handshake requires authentication
  // User must connect their Handshake account
  // Uses OAuth flow
  
  canScrape(url: string): boolean {
    return url.includes('joinhandshake.com');
  }
  
  async scrape(config: ScrapeConfig): Promise<ScrapeResult> {
    // Use Handshake's internal GraphQL API after auth
    // Much richer data available (school-specific opportunities)
  }
}
```

### 4.6 Lever Integration

```typescript
// src/scrapers/lever.ts

export class LeverScraper implements JobScraper {
  name: JobSource = 'lever';
  
  canScrape(url: string): boolean {
    return url.includes('jobs.lever.co');
  }
  
  async scrape(config: ScrapeConfig): Promise<ScrapeResult> {
    // Lever has a clean JSON API too!
    // https://api.lever.co/v0/postings/{company}
    
    const company = this.extractCompany(config.careerPageUrl);
    const apiUrl = `https://api.lever.co/v0/postings/${company}`;
    
    const response = await fetch(apiUrl);
    const jobs = await response.json();
    
    return {
      success: true,
      jobs: jobs.map(this.transformJob),
      metadata: {
        totalJobs: jobs.length,
        scrapedAt: new Date(),
      },
    };
  }
}
```

### 4.7 GitHub Internship Repos (PRIMARY SOURCE)

These curated GitHub repos are **primary job sources** - they aggregate verified internships and are regularly updated by the community.

```typescript
// src/scrapers/github-repos.ts

export interface GitHubRepoSource {
  name: string;
  owner: string;
  repo: string;
  branch: string;
  readmePath: string;
  parseFormat: 'markdown_table' | 'json' | 'yaml';
  seasons: ('summer' | 'fall' | 'winter' | 'spring' | 'off_cycle')[];
}

// Known internship aggregation repos
export const GITHUB_INTERNSHIP_REPOS: GitHubRepoSource[] = [
  {
    name: 'Simplify Summer Internships',
    owner: 'SimplifyJobs',
    repo: 'Summer2025-Internships',
    branch: 'dev',
    readmePath: 'README.md',
    parseFormat: 'markdown_table',
    seasons: ['summer'],
  },
  {
    name: 'Simplify New Grad',
    owner: 'SimplifyJobs',
    repo: 'New-Grad-Positions',
    branch: 'dev',
    readmePath: 'README.md',
    parseFormat: 'markdown_table',
    seasons: ['summer', 'fall', 'winter', 'spring'],
  },
  {
    name: 'Pitt CSC Internships',
    owner: 'pittcsc',
    repo: 'Summer2025-Internships',
    branch: 'dev',
    readmePath: 'README.md',
    parseFormat: 'markdown_table',
    seasons: ['summer'],
  },
  {
    name: 'SpeedyApply Internships',
    owner: 'speedyapply',
    repo: 'internships',
    branch: 'main',
    readmePath: 'README.md',
    parseFormat: 'markdown_table',
    seasons: ['summer', 'fall', 'winter', 'spring'],
  },
  {
    name: 'Coderquad Internships',
    owner: 'coderQuad',
    repo: 'New-Grad-Positions',
    branch: 'master',
    readmePath: 'README.md',
    parseFormat: 'markdown_table',
    seasons: ['summer', 'fall'],
  },
];

export class GitHubRepoScraper implements JobScraper {
  name: JobSource = 'github_repo';
  
  private repos: GitHubRepoSource[];
  
  constructor(repos: GitHubRepoSource[] = GITHUB_INTERNSHIP_REPOS) {
    this.repos = repos;
  }
  
  canScrape(url: string): boolean {
    return url.includes('github.com') && 
           this.repos.some(r => url.includes(`${r.owner}/${r.repo}`));
  }
  
  async scrapeAll(): Promise<ScrapeResult> {
    const allJobs: Partial<Job>[] = [];
    const errors: string[] = [];
    
    for (const repo of this.repos) {
      try {
        const jobs = await this.scrapeRepo(repo);
        allJobs.push(...jobs);
      } catch (error) {
        errors.push(`${repo.name}: ${error.message}`);
      }
    }
    
    return {
      success: errors.length < this.repos.length,
      jobs: allJobs,
      error: errors.length > 0 ? errors.join('; ') : undefined,
      metadata: {
        totalJobs: allJobs.length,
        scrapedAt: new Date(),
      },
    };
  }
  
  async scrapeRepo(repo: GitHubRepoSource): Promise<Partial<Job>[]> {
    // Fetch raw README from GitHub
    const rawUrl = `https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/${repo.branch}/${repo.readmePath}`;
    
    const response = await fetch(rawUrl);
    const content = await response.text();
    
    // Parse based on format
    if (repo.parseFormat === 'markdown_table') {
      return this.parseMarkdownTable(content, repo);
    }
    
    return [];
  }
  
  private parseMarkdownTable(content: string, repo: GitHubRepoSource): Partial<Job>[] {
    const jobs: Partial<Job>[] = [];
    
    // Find markdown tables (lines starting with |)
    const lines = content.split('\n');
    let inTable = false;
    let headers: string[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Table row
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        const cells = trimmed
          .slice(1, -1)
          .split('|')
          .map(c => c.trim());
        
        // Header row
        if (!inTable) {
          headers = cells.map(h => h.toLowerCase());
          inTable = true;
          continue;
        }
        
        // Separator row (|---|---|)
        if (cells.every(c => c.match(/^[-:]+$/))) {
          continue;
        }
        
        // Data row - parse it
        const job = this.parseTableRow(headers, cells, repo);
        if (job) {
          jobs.push(job);
        }
      } else {
        inTable = false;
        headers = [];
      }
    }
    
    return jobs;
  }
  
  private parseTableRow(
    headers: string[], 
    cells: string[], 
    repo: GitHubRepoSource
  ): Partial<Job> | null {
    // Common header patterns in these repos:
    // | Company | Role | Location | Application/Link | Date Posted |
    // | Name | Location | Notes |
    
    const getCell = (possibleHeaders: string[]): string => {
      for (const h of possibleHeaders) {
        const idx = headers.findIndex(header => 
          header.includes(h) || h.includes(header)
        );
        if (idx !== -1 && cells[idx]) {
          return cells[idx];
        }
      }
      return '';
    };
    
    const companyName = getCell(['company', 'name', 'employer']);
    const role = getCell(['role', 'position', 'title', 'job']);
    const location = getCell(['location', 'loc']);
    const linkCell = getCell(['application', 'link', 'apply', 'url']);
    const notes = getCell(['notes', 'info', 'details']);
    
    // Extract URL from markdown link: [text](url)
    const urlMatch = linkCell.match(/\[.*?\]\((https?:\/\/[^\)]+)\)/);
    const applyUrl = urlMatch ? urlMatch[1] : linkCell;
    
    // Skip if closed/filled
    if (notes.toLowerCase().includes('closed') || 
        linkCell.toLowerCase().includes('closed')) {
      return null;
    }
    
    if (!companyName || !applyUrl || applyUrl === '🔒') {
      return null;
    }
    
    return {
      externalId: `${repo.repo}-${companyName}-${role}`.replace(/\s+/g, '-').toLowerCase(),
      title: role || 'Internship',
      companyName: companyName.replace(/\*\*/g, '').trim(),
      location: location || 'Various',
      applyUrl: applyUrl,
      source: 'github_repo',
      experienceLevel: 'intern',
      jobType: 'internship',
      description: notes,
      discoveredAt: new Date(),
    };
  }
}

// Scheduled task to sync GitHub repos
export async function syncGitHubRepos() {
  const scraper = new GitHubRepoScraper();
  const result = await scraper.scrapeAll();
  
  console.log(`GitHub repos: Found ${result.jobs.length} jobs`);
  
  for (const jobData of result.jobs) {
    // Find or create company
    const company = await findOrCreateCompanyByName(jobData.companyName!);
    
    // Upsert job
    await upsertJob({
      ...jobData,
      companyId: company.id,
    });
  }
  
  return result;
}
```

### 4.8 Scraper Registry & Factory

```typescript
// src/scrapers/registry.ts

import { GreenhouseScraper } from './greenhouse';
import { WorkdayScraper } from './workday';
import { LeverScraper } from './lever';
import { OracleTaleoScraper } from './oracle-taleo';
import { HandshakeScraper } from './handshake';
import { GitHubRepoScraper } from './github-repos';

const scrapers: JobScraper[] = [
  new GreenhouseScraper(),
  new WorkdayScraper(),
  new LeverScraper(),
  new OracleTaleoScraper(),
  new HandshakeScraper(),
  new GitHubRepoScraper(),  // PRIMARY SOURCE for internships
];

export function getScraperForUrl(url: string): JobScraper | null {
  return scrapers.find(s => s.canScrape(url)) || null;
}

export function detectCareerPageType(url: string): CareerPageType {
  const scraper = getScraperForUrl(url);
  return scraper?.name || 'unknown';
}
```

---

## 5. UI Components

### 5.1 Component Hierarchy

```
App
├── Layout
│   ├── Sidebar
│   │   ├── Navigation
│   │   ├── QuickFilters
│   │   └── HeartbeatStatus
│   └── MainContent
│       ├── Header
│       │   ├── SearchBar
│       │   └── UserMenu
│       └── PageContent (Router)
│
├── Pages
│   ├── Dashboard
│   │   ├── StatsCards
│   │   ├── RecentJobs
│   │   └── RecommendedCompanies
│   │
│   ├── JobList (Main Page)
│   │   ├── FilterBar
│   │   │   ├── IndustryFilter
│   │   │   ├── LocationFilter
│   │   │   ├── JobTypeFilter
│   │   │   └── SalaryFilter
│   │   ├── SortControls
│   │   ├── JobListView
│   │   │   └── JobCard (x25 per page)
│   │   │       ├── CompanyLogo
│   │   │       ├── JobInfo
│   │   │       ├── MatchScore
│   │   │       └── QuickActions
│   │   └── Pagination
│   │
│   ├── JobDetail
│   │   ├── CompanyHeader
│   │   ├── JobDescription
│   │   ├── RequirementsList
│   │   ├── MatchBreakdown
│   │   └── ApplyButton
│   │
│   ├── Companies
│   │   ├── SeedCompanyPicker
│   │   ├── DreamCompanyList
│   │   └── CompanyCard
│   │
│   ├── Settings
│   │   ├── ProfileSettings
│   │   ├── WeightSliders
│   │   ├── HeartbeatConfig
│   │   └── ApplyModeSettings
│   │
│   └── Applications
│       ├── ApplicationList
│       ├── ApplicationDetail
│       └── SubmissionReview
│
└── Shared Components
    ├── WeightSlider
    ├── CompanyAutocomplete
    ├── MatchScoreBadge
    ├── JobSourceIcon
    └── Modal
```

### 5.2 Key Component Specifications

#### JobCard Component

```typescript
// src/components/JobCard/JobCard.tsx

interface JobCardProps {
  job: Job;
  matchScore?: number;
  matchBreakdown?: MatchBreakdown;
  status: JobStatus;
  onSave: () => void;
  onHide: () => void;
  onApply: () => void;
  onClick: () => void;
}

export function JobCard({
  job,
  matchScore,
  matchBreakdown,
  status,
  onSave,
  onHide,
  onApply,
  onClick,
}: JobCardProps) {
  return (
    <div 
      className="job-card" 
      onClick={onClick}
      data-status={status}
    >
      {/* Company Logo */}
      <div className="job-card__logo">
        <img src={job.companyLogo || '/default-logo.svg'} alt="" />
      </div>
      
      {/* Main Content */}
      <div className="job-card__content">
        <h3 className="job-card__title">{job.title}</h3>
        <p className="job-card__company">{job.companyName}</p>
        <div className="job-card__meta">
          <span className="job-card__location">
            <LocationIcon /> {job.location}
          </span>
          {job.salaryMin && (
            <span className="job-card__salary">
              ${formatSalary(job.salaryMin)} - ${formatSalary(job.salaryMax)}
            </span>
          )}
          <span className="job-card__posted">
            {formatRelativeTime(job.postedAt)}
          </span>
        </div>
        <div className="job-card__tags">
          {job.requiredSkills.slice(0, 3).map(skill => (
            <span key={skill} className="tag">{skill}</span>
          ))}
        </div>
      </div>
      
      {/* Match Score */}
      <div className="job-card__score">
        <MatchScoreBadge 
          score={matchScore} 
          breakdown={matchBreakdown}
        />
      </div>
      
      {/* Actions */}
      <div className="job-card__actions" onClick={e => e.stopPropagation()}>
        <IconButton 
          icon={status === 'saved' ? <BookmarkFilled /> : <Bookmark />}
          onClick={onSave}
          title={status === 'saved' ? 'Unsave' : 'Save'}
        />
        <IconButton 
          icon={<EyeOff />}
          onClick={onHide}
          title="Hide"
        />
        <Button 
          variant="primary"
          size="small"
          onClick={onApply}
        >
          Quick Apply
        </Button>
      </div>
    </div>
  );
}
```

#### WeightSliders Component

```typescript
// src/components/Settings/WeightSliders.tsx

interface WeightSlidersProps {
  weights: MatchingWeights;
  onChange: (weights: MatchingWeights) => void;
}

const WEIGHT_CONFIG = [
  {
    key: 'companyFit',
    label: 'Company Fit',
    description: 'How similar to your seed companies',
    icon: <BuildingIcon />,
  },
  {
    key: 'roleRelevance',
    label: 'Role Relevance',
    description: 'Job title and responsibilities match',
    icon: <BriefcaseIcon />,
  },
  {
    key: 'skillsMatch',
    label: 'Skills Match',
    description: 'Required skills you have',
    icon: <CodeIcon />,
  },
  {
    key: 'industryMatch',
    label: 'Industry Match',
    description: 'Target industry alignment',
    icon: <IndustryIcon />,
  },
  {
    key: 'locationMatch',
    label: 'Location Match',
    description: 'Location preferences',
    icon: <MapPinIcon />,
  },
  {
    key: 'salaryMatch',
    label: 'Salary Match',
    description: 'Compensation range fit',
    icon: <DollarIcon />,
  },
  {
    key: 'companySize',
    label: 'Company Size',
    description: 'Startup vs enterprise preference',
    icon: <UsersIcon />,
  },
  {
    key: 'companyGrowth',
    label: 'Company Growth',
    description: 'Growth stage and trajectory',
    icon: <TrendingUpIcon />,
  },
];

export function WeightSliders({ weights, onChange }: WeightSlidersProps) {
  const handleSliderChange = (key: keyof MatchingWeights, value: number) => {
    onChange({ ...weights, [key]: value });
  };
  
  return (
    <div className="weight-sliders">
      <div className="weight-sliders__header">
        <h3>Matching Preferences</h3>
        <p>Adjust sliders to prioritize what matters most to you</p>
        <Button 
          variant="ghost" 
          size="small"
          onClick={() => onChange(DEFAULT_WEIGHTS)}
        >
          Reset to Defaults
        </Button>
      </div>
      
      <div className="weight-sliders__list">
        {WEIGHT_CONFIG.map(({ key, label, description, icon }) => (
          <div key={key} className="weight-slider">
            <div className="weight-slider__header">
              <span className="weight-slider__icon">{icon}</span>
              <div className="weight-slider__info">
                <span className="weight-slider__label">{label}</span>
                <span className="weight-slider__desc">{description}</span>
              </div>
              <span className="weight-slider__value">
                {weights[key as keyof MatchingWeights]}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={weights[key as keyof MatchingWeights]}
              onChange={(e) => handleSliderChange(
                key as keyof MatchingWeights, 
                parseInt(e.target.value)
              )}
              className="weight-slider__input"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
```

#### CompanyPicker (Seed Selection)

```typescript
// src/components/Onboarding/CompanyPicker.tsx

interface CompanyPickerProps {
  selectedCompanies: Company[];
  onSelect: (company: Company) => void;
  onRemove: (companyId: string) => void;
  minSelection?: number;
  maxSelection?: number;
}

export function CompanyPicker({
  selectedCompanies,
  onSelect,
  onRemove,
  minSelection = 3,
  maxSelection = 10,
}: CompanyPickerProps) {
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState<Company[]>([]);
  
  // Debounced company search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (search.length >= 2) {
        const results = await searchCompanies(search);
        setSuggestions(results);
      } else {
        setSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  
  return (
    <div className="company-picker">
      <div className="company-picker__header">
        <h3>Select Companies You'd Love to Work At</h3>
        <p>
          Pick {minSelection}-{maxSelection} companies to help us understand 
          your preferences. We'll find similar opportunities.
        </p>
      </div>
      
      {/* Search Input */}
      <div className="company-picker__search">
        <SearchIcon />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search companies (e.g., Stripe, Figma, Notion)"
          autoFocus
        />
        
        {/* Suggestions Dropdown */}
        {suggestions.length > 0 && (
          <div className="company-picker__suggestions">
            {suggestions.map(company => (
              <button
                key={company.id}
                className="company-picker__suggestion"
                onClick={() => {
                  onSelect(company);
                  setSearch('');
                  setSuggestions([]);
                }}
                disabled={selectedCompanies.length >= maxSelection}
              >
                <img src={company.logo} alt="" />
                <div>
                  <span className="name">{company.name}</span>
                  <span className="industry">{company.industry}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      
      {/* Selected Companies */}
      <div className="company-picker__selected">
        <h4>Selected ({selectedCompanies.length}/{maxSelection})</h4>
        <div className="company-picker__chips">
          {selectedCompanies.map(company => (
            <div key={company.id} className="company-chip">
              <img src={company.logo} alt="" />
              <span>{company.name}</span>
              <button onClick={() => onRemove(company.id)}>
                <XIcon />
              </button>
            </div>
          ))}
        </div>
      </div>
      
      {/* Popular Suggestions */}
      <div className="company-picker__popular">
        <h4>Popular Choices</h4>
        <div className="company-picker__grid">
          {POPULAR_COMPANIES.map(company => (
            <button
              key={company.id}
              className="company-card-mini"
              onClick={() => onSelect(company)}
              disabled={
                selectedCompanies.some(c => c.id === company.id) ||
                selectedCompanies.length >= maxSelection
              }
            >
              <img src={company.logo} alt="" />
              <span>{company.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

---

## 6. Heartbeat/Pulse System

### 6.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Heartbeat Service                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Scheduler  │───▶│    Queue     │───▶│   Workers    │  │
│  │   (Cron)     │    │   (Redis)    │    │  (Scrapers)  │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                   │                   │          │
│         │                   │                   │          │
│         ▼                   ▼                   ▼          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    Database                          │   │
│  │  - Scrape Queue                                      │   │
│  │  - Heartbeat Runs                                    │   │
│  │  - Jobs (new discoveries)                            │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                 │
│                           ▼                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  Notification Service                │   │
│  │  - WebSocket push to connected clients               │   │
│  │  - Email digest (optional)                           │   │
│  │  - Push notifications (mobile, future)               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Scheduler Service

```typescript
// src/services/heartbeat/scheduler.ts

import { CronJob } from 'cron';
import { db } from '../db';
import { scrapeQueue } from './queue';

export class HeartbeatScheduler {
  private jobs: Map<string, CronJob> = new Map();
  
  async start() {
    // Load all users with heartbeat enabled
    const users = await db.query(`
      SELECT 
        u.id,
        up.heartbeat_frequency_minutes,
        up.heartbeat_enabled
      FROM users u
      JOIN user_preferences up ON u.id = up.user_id
      WHERE up.heartbeat_enabled = true
    `);
    
    for (const user of users) {
      this.scheduleForUser(user);
    }
    
    // Also run global scrape job every 15 mins
    this.scheduleGlobalScrape();
  }
  
  scheduleForUser(user: { id: string; heartbeat_frequency_minutes: number }) {
    const cronPattern = this.frequencyToCron(user.heartbeat_frequency_minutes);
    
    const job = new CronJob(cronPattern, async () => {
      await this.runHeartbeatForUser(user.id);
    });
    
    this.jobs.set(user.id, job);
    job.start();
  }
  
  async runHeartbeatForUser(userId: string) {
    // Create heartbeat run record
    const run = await db.query(`
      INSERT INTO heartbeat_runs (user_id)
      VALUES ($1)
      RETURNING id
    `, [userId]);
    
    try {
      // Get companies to scrape for this user
      const companies = await this.getCompaniesToScrape(userId);
      
      // Add to scrape queue with appropriate priority
      for (const company of companies) {
        await scrapeQueue.add({
          companyId: company.id,
          careerPageUrl: company.career_page_url,
          careerPageType: company.career_page_type,
          priority: company.is_dream ? 'high' : 'normal',
          userId,
          heartbeatRunId: run.id,
        });
      }
      
      // Update run with queued count
      await db.query(`
        UPDATE heartbeat_runs
        SET companies_scraped = $1
        WHERE id = $2
      `, [companies.length, run.id]);
      
    } catch (error) {
      await db.query(`
        UPDATE heartbeat_runs
        SET status = 'failed', errors = $1
        WHERE id = $2
      `, [JSON.stringify([{ error: error.message }]), run.id]);
    }
  }
  
  async getCompaniesToScrape(userId: string) {
    // Priority order:
    // 1. Dream companies (always scrape)
    // 2. Companies user has applied to recently (stay updated)
    // 3. Similar companies to seeds
    
    return db.query(`
      -- Dream companies (highest priority)
      SELECT c.*, true as is_dream
      FROM companies c
      JOIN user_companies uc ON c.id = uc.company_id
      WHERE uc.user_id = $1 AND uc.relationship = 'dream'
      
      UNION ALL
      
      -- Companies similar to seed companies
      SELECT c.*, false as is_dream
      FROM companies c
      WHERE c.id IN (
        SELECT similar.id
        FROM companies seed
        JOIN user_companies uc ON seed.id = uc.company_id
        CROSS JOIN LATERAL (
          SELECT c2.id
          FROM companies c2
          WHERE c2.id != seed.id
          ORDER BY c2.embedding <=> seed.embedding
          LIMIT 20
        ) similar
        WHERE uc.user_id = $1 AND uc.relationship = 'seed'
      )
      AND c.career_page_url IS NOT NULL
      
      LIMIT 50
    `, [userId]);
  }
  
  private frequencyToCron(minutes: number): string {
    if (minutes < 60) {
      return `*/${minutes} * * * *`;
    }
    const hours = Math.floor(minutes / 60);
    return `0 */${hours} * * *`;
  }
  
  private scheduleGlobalScrape() {
    // Every 15 mins, scrape popular companies that many users care about
    new CronJob('*/15 * * * *', async () => {
      const popularCompanies = await db.query(`
        SELECT c.*, COUNT(uc.user_id) as user_count
        FROM companies c
        JOIN user_companies uc ON c.id = uc.company_id
        WHERE uc.relationship IN ('seed', 'dream', 'interested')
        GROUP BY c.id
        ORDER BY user_count DESC
        LIMIT 100
      `);
      
      for (const company of popularCompanies) {
        await scrapeQueue.add({
          companyId: company.id,
          careerPageUrl: company.career_page_url,
          careerPageType: company.career_page_type,
          priority: 'low',
          global: true,
        });
      }
    }).start();
  }
}
```

### 6.3 Scrape Queue & Workers

```typescript
// src/services/heartbeat/queue.ts

import Bull from 'bull';
import { getScraperForUrl } from '../scrapers/registry';
import { db } from '../db';
import { notifyUsersOfNewJobs } from './notifications';

export const scrapeQueue = new Bull('scrape-jobs', {
  redis: process.env.REDIS_URL,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

// Priority-based processing
scrapeQueue.process('high', 5, processScrapeJob);
scrapeQueue.process('normal', 10, processScrapeJob);
scrapeQueue.process('low', 3, processScrapeJob);

async function processScrapeJob(job: Bull.Job) {
  const { companyId, careerPageUrl, careerPageType, userId, heartbeatRunId } = job.data;
  
  const scraper = getScraperForUrl(careerPageUrl);
  if (!scraper) {
    throw new Error(`No scraper available for ${careerPageUrl}`);
  }
  
  // Run the scrape
  const result = await scraper.scrape({
    companyId,
    careerPageUrl,
  });
  
  if (!result.success) {
    throw new Error(result.error);
  }
  
  // Process discovered jobs
  let newJobCount = 0;
  
  for (const jobData of result.jobs) {
    // Check if job already exists
    const existing = await db.query(`
      SELECT id FROM jobs
      WHERE company_id = $1 AND external_id = $2
    `, [companyId, jobData.externalId]);
    
    if (existing.rows.length === 0) {
      // New job! Insert it
      await db.query(`
        INSERT INTO jobs (
          external_id, title, description, company_id, company_name,
          location, location_type, department, apply_url, source,
          posted_at, required_skills, preferred_skills
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        jobData.externalId,
        jobData.title,
        jobData.description,
        companyId,
        jobData.companyName,
        jobData.location,
        jobData.locationType,
        jobData.department,
        jobData.applyUrl,
        careerPageType,
        jobData.postedAt,
        JSON.stringify(jobData.requiredSkills || []),
        JSON.stringify(jobData.preferredSkills || []),
      ]);
      
      newJobCount++;
    } else {
      // Update last_seen_at for existing job
      await db.query(`
        UPDATE jobs SET last_seen_at = NOW()
        WHERE id = $1
      `, [existing.rows[0].id]);
    }
  }
  
  // Update company last_scraped
  await db.query(`
    UPDATE companies
    SET last_scraped = NOW(), job_count = $1
    WHERE id = $2
  `, [result.metadata?.totalJobs || result.jobs.length, companyId]);
  
  // If this was for a specific user's heartbeat, notify them
  if (userId && newJobCount > 0) {
    await notifyUsersOfNewJobs(companyId, newJobCount);
  }
  
  // Update heartbeat run stats if applicable
  if (heartbeatRunId) {
    await db.query(`
      UPDATE heartbeat_runs
      SET 
        new_jobs_found = new_jobs_found + $1,
        completed_at = CASE 
          WHEN companies_scraped = (
            SELECT COUNT(*) FROM scrape_queue WHERE heartbeat_run_id = $2
          ) THEN NOW()
          ELSE completed_at
        END
      WHERE id = $2
    `, [newJobCount, heartbeatRunId]);
  }
  
  return { jobsFound: result.jobs.length, newJobCount };
}
```

### 6.4 Real-time Notifications

```typescript
// src/services/heartbeat/notifications.ts

import { Server as SocketServer } from 'socket.io';
import { db } from '../db';

let io: SocketServer;

export function initNotifications(server: any) {
  io = new SocketServer(server, {
    cors: { origin: '*' },
  });
  
  io.on('connection', (socket) => {
    const userId = socket.handshake.auth.userId;
    if (userId) {
      socket.join(`user:${userId}`);
    }
  });
}

export async function notifyUsersOfNewJobs(companyId: string, newJobCount: number) {
  // Find all users who care about this company
  const users = await db.query(`
    SELECT user_id
    FROM user_companies
    WHERE company_id = $1
    AND relationship IN ('seed', 'dream', 'interested')
  `, [companyId]);
  
  const company = await db.query(`
    SELECT name FROM companies WHERE id = $1
  `, [companyId]);
  
  for (const { user_id } of users.rows) {
    io.to(`user:${user_id}`).emit('new-jobs', {
      companyId,
      companyName: company.rows[0].name,
      count: newJobCount,
      message: `${newJobCount} new job${newJobCount > 1 ? 's' : ''} at ${company.rows[0].name}!`,
    });
  }
}
```

---

## 7. Matching Algorithm

### 7.1 Algorithm Overview

The matching algorithm computes a weighted score for each job based on user preferences. It uses both hard filters (must-have) and soft scores (nice-to-have).

```typescript
// src/services/matching/algorithm.ts

export interface MatchingContext {
  user: UserProfile;
  preferences: UserPreferences;
  seedCompanies: Company[];
  seedEmbedding: number[];  // Averaged embedding of seed companies
}

export async function computeMatchScore(
  job: Job,
  company: Company,
  context: MatchingContext
): Promise<MatchBreakdown> {
  const { user, preferences, seedEmbedding } = context;
  const weights = preferences.weights;
  
  // Compute individual dimension scores (0-100)
  const scores = {
    companyFit: computeCompanyFitScore(company, seedEmbedding),
    industryMatch: computeIndustryScore(company.industry, user.targetIndustries),
    locationMatch: computeLocationScore(job, user.location),
    salaryMatch: computeSalaryScore(job, preferences),
    skillsMatch: computeSkillsScore(job.requiredSkills, user.skills),
    roleRelevance: computeRoleScore(job.title, job.experienceLevel, user),
    companySize: computeSizeScore(company.size, preferences),
    companyGrowth: computeGrowthScore(company.vibes?.growthScore),
  };
  
  // Compute weighted total
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const totalScore = Object.entries(scores).reduce((sum, [key, score]) => {
    return sum + (score * weights[key as keyof MatchingWeights]);
  }, 0) / totalWeight;
  
  return {
    ...scores,
    totalScore: Math.round(totalScore),
  };
}
```

### 7.2 Individual Score Functions

```typescript
// src/services/matching/scores.ts

/**
 * Company Fit: How similar is this company to user's seed companies?
 * Uses cosine similarity of company embeddings
 */
export function computeCompanyFitScore(
  company: Company,
  seedEmbedding: number[]
): number {
  if (!company.vibes?.embedding || !seedEmbedding) {
    return 50; // Neutral if no embedding
  }
  
  const similarity = cosineSimilarity(company.vibes.embedding, seedEmbedding);
  // Convert from [-1, 1] to [0, 100]
  return Math.round((similarity + 1) * 50);
}

/**
 * Industry Match: Does the company's industry match user preferences?
 */
export function computeIndustryScore(
  companyIndustry: Industry,
  targetIndustries: Industry[]
): number {
  if (targetIndustries.length === 0) return 75; // No preference = neutral-positive
  
  if (targetIndustries.includes(companyIndustry)) {
    return 100;
  }
  
  // Check for related industries
  const relatedScore = getIndustryRelationScore(companyIndustry, targetIndustries);
  return relatedScore;
}

/**
 * Location Match: How well does job location match user preferences?
 */
export function computeLocationScore(
  job: Job,
  userLocation: Location
): number {
  // Remote jobs are universally accessible
  if (job.remoteAllowed && userLocation.remoteOk) {
    return 100;
  }
  
  // Parse job location
  const jobCity = extractCity(job.location);
  const jobState = extractState(job.location);
  
  // Exact city match
  if (jobCity.toLowerCase() === userLocation.city.toLowerCase()) {
    return 100;
  }
  
  // Same state/metro area
  if (jobState.toLowerCase() === userLocation.state.toLowerCase()) {
    return 80;
  }
  
  // In preferred locations list
  if (userLocation.preferredLocations?.some(loc => 
    job.location.toLowerCase().includes(loc.toLowerCase())
  )) {
    return 90;
  }
  
  // Willing to relocate gives partial credit
  if (userLocation.willingToRelocate) {
    return 50;
  }
  
  return 20;
}

/**
 * Salary Match: Does salary range meet user expectations?
 */
export function computeSalaryScore(
  job: Job,
  preferences: UserPreferences
): number {
  if (!job.salaryMin && !job.salaryMax) {
    return 50; // Unknown salary = neutral
  }
  
  const { minSalary, maxSalary } = preferences;
  
  if (!minSalary && !maxSalary) {
    return 75; // No preference = neutral-positive
  }
  
  const jobMid = job.salaryMin && job.salaryMax 
    ? (job.salaryMin + job.salaryMax) / 2
    : job.salaryMin || job.salaryMax;
  
  // Above max preference - great!
  if (maxSalary && jobMid >= maxSalary) {
    return 100;
  }
  
  // Below minimum - not good
  if (minSalary && job.salaryMax && job.salaryMax < minSalary) {
    return 20;
  }
  
  // In range
  if (minSalary && jobMid >= minSalary) {
    return 80 + Math.min(20, ((jobMid - minSalary) / minSalary) * 20);
  }
  
  return 60;
}

/**
 * Skills Match: What % of required skills does user have?
 */
export function computeSkillsScore(
  requiredSkills: string[],
  userSkills: string[]
): number {
  if (requiredSkills.length === 0) {
    return 75; // No requirements = good for everyone
  }
  
  const normalizedRequired = requiredSkills.map(s => s.toLowerCase().trim());
  const normalizedUser = userSkills.map(s => s.toLowerCase().trim());
  
  // Direct matches
  let matchCount = 0;
  for (const skill of normalizedRequired) {
    if (normalizedUser.some(us => 
      us === skill || 
      us.includes(skill) || 
      skill.includes(us) ||
      areSkillsSimilar(us, skill)
    )) {
      matchCount++;
    }
  }
  
  const matchRate = matchCount / requiredSkills.length;
  
  // Scale: 100% match = 100, 50% match = 70, 0% match = 30
  return Math.round(30 + matchRate * 70);
}

/**
 * Role Relevance: Does job title/level match user's target?
 */
export function computeRoleScore(
  jobTitle: string,
  experienceLevel: ExperienceLevel,
  user: UserProfile
): number {
  // Experience level match (critical for intern/new grad)
  const levelMatch = computeLevelMatch(experienceLevel, user.experienceLevel);
  
  if (levelMatch < 50) {
    return levelMatch; // Experience mismatch is a dealbreaker
  }
  
  // Title relevance (could use NLP/embeddings in future)
  // For now, simple keyword matching
  const titleScore = computeTitleRelevance(jobTitle, user);
  
  return Math.round((levelMatch * 0.6) + (titleScore * 0.4));
}

function computeLevelMatch(jobLevel: ExperienceLevel, userLevel: ExperienceLevel): number {
  const levelOrder = ['intern', 'new_grad', 'entry', 'mid', 'senior', 'lead', 'executive'];
  const jobIdx = levelOrder.indexOf(jobLevel);
  const userIdx = levelOrder.indexOf(userLevel);
  
  // Exact match
  if (jobIdx === userIdx) return 100;
  
  // One level off
  if (Math.abs(jobIdx - userIdx) === 1) return 70;
  
  // Intern can apply to new grad and vice versa
  if ((jobLevel === 'intern' && userLevel === 'new_grad') ||
      (jobLevel === 'new_grad' && userLevel === 'intern')) {
    return 85;
  }
  
  // Too far off
  if (Math.abs(jobIdx - userIdx) >= 3) return 20;
  
  return 50;
}

/**
 * Company Size: User's preference for startup vs enterprise
 */
export function computeSizeScore(
  companySize: CompanySize,
  preferences: UserPreferences
): number {
  // This would ideally be based on explicit user preference
  // For now, return neutral
  return 75;
}

/**
 * Company Growth: Preference for high-growth companies
 */
export function computeGrowthScore(growthScore?: number): number {
  if (!growthScore) return 50;
  return Math.min(100, growthScore);
}
```

### 7.3 Similarity & Embedding Functions

```typescript
// src/services/matching/embeddings.ts

import OpenAI from 'openai';

const openai = new OpenAI();

/**
 * Generate embedding for a company based on its description and metadata
 */
export async function generateCompanyEmbedding(company: Company): Promise<number[]> {
  const text = [
    company.name,
    company.description,
    company.industry,
    company.subIndustry,
    company.vibes?.culture?.join(', '),
    company.vibes?.techStack?.join(', '),
  ].filter(Boolean).join('\n');
  
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  
  return response.data[0].embedding;
}

/**
 * Compute average embedding of user's seed companies
 */
export function computeSeedEmbedding(companies: Company[]): number[] {
  if (companies.length === 0) return [];
  
  const dimension = companies[0].vibes?.embedding?.length || 0;
  if (dimension === 0) return [];
  
  const avg = new Array(dimension).fill(0);
  
  for (const company of companies) {
    const embedding = company.vibes?.embedding;
    if (embedding) {
      for (let i = 0; i < dimension; i++) {
        avg[i] += embedding[i];
      }
    }
  }
  
  return avg.map(v => v / companies.length);
}

/**
 * Cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Skill similarity using a predefined map
const SKILL_SYNONYMS: Record<string, string[]> = {
  'javascript': ['js', 'typescript', 'ts', 'node', 'nodejs'],
  'python': ['py', 'django', 'flask', 'fastapi'],
  'react': ['reactjs', 'react.js', 'next', 'nextjs'],
  'machine learning': ['ml', 'deep learning', 'ai', 'artificial intelligence'],
  // ... more mappings
};

export function areSkillsSimilar(skill1: string, skill2: string): boolean {
  for (const [base, synonyms] of Object.entries(SKILL_SYNONYMS)) {
    const allVariants = [base, ...synonyms];
    if (allVariants.includes(skill1) && allVariants.includes(skill2)) {
      return true;
    }
  }
  return false;
}
```

---

## 8. Apply Flow & Automation Modes

### 8.1 Mode Definitions

```typescript
// src/types/apply.ts

export type ApplyMode = 'manual' | 'one_click' | 'full_auto' | 'swarm';

/**
 * MANUAL: User clicks apply → redirected to company site
 * - No automation
 * - Tracks that user clicked apply
 * 
 * ONE_CLICK: User clicks apply → form pre-filled → stops at review page
 * - Opens apply page in new tab
 * - Auto-fills standard fields from profile
 * - Generates cover letter if needed
 * - STOPS before submit - user reviews and clicks submit
 * 
 * FULL_AUTO: User clicks apply → form auto-submitted
 * - Same as one-click, but also clicks submit
 * - Requires explicit user opt-in
 * - Daily limit enforced
 * 
 * SWARM: Batch apply to multiple jobs
 * - User selects multiple jobs
 * - Applies full_auto to all
 * - Stops on any job requiring custom input
 * - Quality controls: max N per day, cooldown between
 */
```

### 8.2 One-Click Apply Flow

```typescript
// src/services/apply/one-click.ts

export async function executeOneClickApply(
  job: Job,
  application: Application,
  userProfile: UserProfile
): Promise<ApplyResult> {
  const steps: AutomationStep[] = [];
  
  try {
    // Step 1: Open apply URL
    steps.push({ step: 1, action: 'open_page', status: 'in_progress' });
    const page = await openApplyPage(job.applyUrl);
    steps[0].status = 'completed';
    
    // Step 2: Detect form fields
    steps.push({ step: 2, action: 'detect_fields', status: 'in_progress' });
    const fields = await detectFormFields(page);
    steps[1].status = 'completed';
    
    // Step 3: Fill standard fields
    steps.push({ step: 3, action: 'fill_fields', status: 'in_progress' });
    await fillStandardFields(page, fields, userProfile);
    steps[2].status = 'completed';
    
    // Step 4: Upload resume
    steps.push({ step: 4, action: 'upload_resume', status: 'in_progress' });
    await uploadResume(page, userProfile.resumeUrl);
    steps[3].status = 'completed';
    
    // Step 5: Handle custom questions
    steps.push({ step: 5, action: 'custom_questions', status: 'in_progress' });
    const customQuestions = await detectCustomQuestions(page);
    if (customQuestions.length > 0) {
      // Use AI to generate answers
      const answers = await generateAnswers(customQuestions, job, userProfile);
      await fillCustomQuestions(page, customQuestions, answers);
    }
    steps[4].status = 'completed';
    
    // Step 6: STOP at review - update status to pending_review
    steps.push({ step: 6, action: 'await_review', status: 'in_progress' });
    
    // Update application
    await updateApplication(application.id, {
      status: 'pending_review',
      automationSteps: steps,
      formData: {
        customResponses: Object.fromEntries(
          customQuestions.map((q, i) => [q.id, answers[i]])
        ),
      },
    });
    
    // Notify user that application is ready for review
    await notifyPendingReview(application);
    
    return {
      success: true,
      status: 'pending_review',
      steps,
    };
    
  } catch (error) {
    // Mark failed step
    const failedStep = steps.find(s => s.status === 'in_progress');
    if (failedStep) {
      failedStep.status = 'failed';
      failedStep.error = error.message;
    }
    
    return {
      success: false,
      status: 'failed',
      steps,
      error: error.message,
    };
  }
}
```

### 8.3 Full Auto Mode

```typescript
// src/services/apply/full-auto.ts

export async function executeFullAutoApply(
  job: Job,
  application: Application,
  userProfile: UserProfile,
  preferences: UserPreferences
): Promise<ApplyResult> {
  // Check daily limit
  const todayCount = await getTodayApplicationCount(userProfile.id);
  if (todayCount >= preferences.dailyApplicationLimit) {
    return {
      success: false,
      status: 'rate_limited',
      error: `Daily limit of ${preferences.dailyApplicationLimit} applications reached`,
    };
  }
  
  // Run one-click flow first
  const oneClickResult = await executeOneClickApply(job, application, userProfile);
  
  if (!oneClickResult.success) {
    return oneClickResult;
  }
  
  // Continue to submit
  const steps = [...oneClickResult.steps];
  
  try {
    steps.push({ step: 7, action: 'submit', status: 'in_progress' });
    
    // Find and click submit button
    const page = await getActivePage(application.id);
    await clickSubmitButton(page);
    
    // Wait for confirmation
    await waitForSubmissionConfirmation(page);
    
    steps[6].status = 'completed';
    
    // Update application
    await updateApplication(application.id, {
      status: 'submitted',
      submittedAt: new Date(),
      automationSteps: steps,
    });
    
    return {
      success: true,
      status: 'submitted',
      steps,
    };
    
  } catch (error) {
    // If submit fails, revert to pending_review
    await updateApplication(application.id, {
      status: 'pending_review',
      automationSteps: steps,
    });
    
    return {
      success: false,
      status: 'submit_failed',
      steps,
      error: error.message,
    };
  }
}
```

### 8.4 Swarm Mode

```typescript
// src/services/apply/swarm.ts

export interface SwarmConfig {
  jobIds: string[];
  maxConcurrent: number;        // Default: 1 (sequential)
  cooldownMs: number;           // Time between applications
  stopOnError: boolean;         // Stop swarm on any error
  requireConfirmation: boolean; // Require user confirm before each
}

export async function executeSwarm(
  config: SwarmConfig,
  userProfile: UserProfile,
  preferences: UserPreferences
): Promise<SwarmResult> {
  const results: Map<string, ApplyResult> = new Map();
  const queue = [...config.jobIds];
  let active = 0;
  
  // Check daily limit
  const todayCount = await getTodayApplicationCount(userProfile.id);
  const remaining = preferences.dailyApplicationLimit - todayCount;
  
  if (remaining <= 0) {
    return {
      success: false,
      error: 'Daily limit reached',
      completed: 0,
      failed: 0,
      skipped: config.jobIds.length,
    };
  }
  
  // Limit swarm to remaining quota
  const toProcess = queue.slice(0, remaining);
  const skipped = queue.slice(remaining);
  
  for (const jobId of skipped) {
    results.set(jobId, { success: false, status: 'skipped' });
  }
  
  // Process queue
  for (const jobId of toProcess) {
    // Wait for cooldown
    if (results.size > 0) {
      await sleep(config.cooldownMs);
    }
    
    try {
      const job = await getJob(jobId);
      const application = await createApplication(job, userProfile);
      
      // Check if job requires custom input we can't auto-fill
      if (await requiresManualInput(job)) {
        results.set(jobId, { 
          success: false, 
          status: 'requires_manual',
          error: 'Job requires custom input' 
        });
        continue;
      }
      
      const result = await executeFullAutoApply(job, application, userProfile, preferences);
      results.set(jobId, result);
      
      if (!result.success && config.stopOnError) {
        break;
      }
      
    } catch (error) {
      results.set(jobId, { 
        success: false, 
        status: 'error',
        error: error.message 
      });
      
      if (config.stopOnError) {
        break;
      }
    }
  }
  
  // Aggregate results
  const completed = [...results.values()].filter(r => r.status === 'submitted').length;
  const failed = [...results.values()].filter(r => r.success === false).length;
  
  return {
    success: completed > 0,
    completed,
    failed,
    skipped: skipped.length,
    results,
  };
}

async function requiresManualInput(job: Job): Promise<boolean> {
  // Check job source - some are more automatable than others
  const hardToAutomate = ['oracle_taleo', 'custom'];
  if (hardToAutomate.includes(job.source)) {
    return true;
  }
  
  // Could also check job description for red flags:
  // - "Portfolio required"
  // - "Code samples required"
  // - "Writing samples required"
  
  return false;
}
```

### 8.5 Submission Review Page

```typescript
// src/components/Apply/SubmissionReview.tsx

interface SubmissionReviewProps {
  application: Application;
  job: Job;
  onSubmit: () => void;
  onCancel: () => void;
  onEdit: (field: string) => void;
}

export function SubmissionReview({
  application,
  job,
  onSubmit,
  onCancel,
  onEdit,
}: SubmissionReviewProps) {
  return (
    <div className="submission-review">
      <div className="submission-review__header">
        <h2>Review Your Application</h2>
        <p>
          Please review the information below before submitting to{' '}
          <strong>{job.companyName}</strong>
        </p>
      </div>
      
      {/* Job Summary */}
      <div className="submission-review__job">
        <JobCard job={job} compact />
      </div>
      
      {/* Form Data Review */}
      <div className="submission-review__sections">
        {/* Standard Info */}
        <ReviewSection title="Personal Information">
          <ReviewField label="Name" value={`${app.formData.firstName} ${app.formData.lastName}`} />
          <ReviewField label="Email" value={app.formData.email} />
          <ReviewField label="Phone" value={app.formData.phone} />
          <ReviewField label="Location" value={app.formData.location} />
        </ReviewSection>
        
        {/* Resume */}
        <ReviewSection title="Resume">
          <div className="resume-preview">
            <FileIcon />
            <span>{application.formData.resumeFileName}</span>
            <Button variant="ghost" size="small" onClick={() => onEdit('resume')}>
              Change
            </Button>
          </div>
        </ReviewSection>
        
        {/* Custom Questions */}
        {Object.entries(application.formData.customResponses || {}).length > 0 && (
          <ReviewSection title="Application Questions">
            {Object.entries(application.formData.customResponses).map(([question, answer]) => (
              <ReviewField 
                key={question}
                label={question}
                value={answer}
                onEdit={() => onEdit(`custom:${question}`)}
                editable
              />
            ))}
          </ReviewSection>
        )}
      </div>
      
      {/* Warnings */}
      <div className="submission-review__warnings">
        <WarningIcon />
        <p>
          Once submitted, this application cannot be modified.
          Make sure all information is accurate.
        </p>
      </div>
      
      {/* Actions */}
      <div className="submission-review__actions">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" onClick={onSubmit}>
          Submit Application
        </Button>
      </div>
    </div>
  );
}
```

---

## 9. Feedback & Learning System

The system continuously learns from user feedback and manual actions to improve auto-fill accuracy over time.

### 9.1 Data Models for Learning

```typescript
// src/types/learning.ts

/**
 * Records every field that was auto-filled and whether user modified it
 */
export interface FieldFillRecord {
  id: string;
  applicationId: string;
  userId: string;
  
  // Field identification
  fieldType: FieldType;
  fieldLabel: string;
  fieldSelector: string;  // CSS selector for the field
  pageUrl: string;
  jobSource: JobSource;
  
  // What we filled
  autoFilledValue: string;
  
  // What user changed it to (null = accepted our value)
  userModifiedValue: string | null;
  wasModified: boolean;
  
  // Timing
  filledAt: Date;
  modifiedAt: Date | null;
  
  // Context for learning
  questionContext: string;  // Surrounding text/label
  companyName: string;
  jobTitle: string;
}

/**
 * User feedback on application quality
 */
export interface ApplicationFeedback {
  id: string;
  applicationId: string;
  userId: string;
  
  // Overall rating
  overallRating: 1 | 2 | 3 | 4 | 5;
  
  // Specific feedback
  fieldFeedback: FieldFeedback[];
  
  // Free-form
  comments?: string;
  
  // What would they change?
  suggestedImprovements?: string;
  
  createdAt: Date;
}

export interface FieldFeedback {
  fieldType: FieldType;
  rating: 'good' | 'okay' | 'bad';
  suggestion?: string;
}

/**
 * Learned patterns from user behavior
 */
export interface LearnedPattern {
  id: string;
  userId: string;
  
  // Pattern identification
  patternType: PatternType;
  
  // The pattern itself
  triggerCondition: PatternTrigger;
  learnedResponse: string;
  
  // Confidence
  occurrences: number;
  successRate: number;  // How often user accepted this
  
  // Validity
  createdAt: Date;
  lastUsedAt: Date;
  isActive: boolean;
}

export type PatternType = 
  | 'question_answer'      // Specific question → specific answer
  | 'field_value'          // Field type → preferred value
  | 'company_response'     // Company-specific responses
  | 'industry_response';   // Industry-specific responses

export interface PatternTrigger {
  // Match conditions (any combination)
  questionContains?: string[];
  questionRegex?: string;
  fieldType?: FieldType;
  companyName?: string;
  industry?: Industry;
  jobSource?: JobSource;
}
```

### 9.2 Learning Service

```typescript
// src/services/learning/learner.ts

export class LearningService {
  
  /**
   * Record what we auto-filled for a field
   */
  async recordAutoFill(
    applicationId: string,
    field: DetectedField,
    filledValue: string,
    context: FillContext
  ): Promise<string> {
    const record = await db.query(`
      INSERT INTO field_fill_records (
        application_id, user_id, field_type, field_label,
        field_selector, page_url, job_source, auto_filled_value,
        question_context, company_name, job_title
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id
    `, [
      applicationId,
      context.userId,
      field.fieldType,
      field.label,
      field.selector,
      context.pageUrl,
      context.jobSource,
      filledValue,
      field.surroundingText,
      context.companyName,
      context.jobTitle,
    ]);
    
    return record.rows[0].id;
  }
  
  /**
   * Record when user modifies an auto-filled value
   */
  async recordUserModification(
    recordId: string,
    newValue: string
  ): Promise<void> {
    await db.query(`
      UPDATE field_fill_records
      SET 
        user_modified_value = $1,
        was_modified = true,
        modified_at = NOW()
      WHERE id = $2
    `, [newValue, recordId]);
    
    // Trigger learning from this modification
    const record = await this.getRecord(recordId);
    await this.learnFromModification(record);
  }
  
  /**
   * Learn from a user modification
   */
  private async learnFromModification(record: FieldFillRecord): Promise<void> {
    // Check if we already have a pattern for this
    const existingPattern = await this.findMatchingPattern(record);
    
    if (existingPattern) {
      // Update existing pattern
      if (record.userModifiedValue === existingPattern.learnedResponse) {
        // User gave same answer we learned - increase confidence
        await db.query(`
          UPDATE learned_patterns
          SET 
            occurrences = occurrences + 1,
            success_rate = (success_rate * occurrences + 1) / (occurrences + 1),
            last_used_at = NOW()
          WHERE id = $1
        `, [existingPattern.id]);
      } else {
        // User gave different answer - might need to create new pattern
        await this.createOrUpdatePattern(record);
      }
    } else {
      // Create new pattern from this modification
      await this.createOrUpdatePattern(record);
    }
  }
  
  /**
   * Create or update a learned pattern
   */
  private async createOrUpdatePattern(record: FieldFillRecord): Promise<void> {
    // Determine pattern type based on context
    const patternType = this.inferPatternType(record);
    
    // Build trigger condition
    const trigger: PatternTrigger = {};
    
    if (record.questionContext) {
      // Extract key phrases from the question
      trigger.questionContains = this.extractKeyPhrases(record.questionContext);
    }
    
    trigger.fieldType = record.fieldType;
    
    // For company-specific patterns
    if (this.isLikelyCompanySpecific(record)) {
      trigger.companyName = record.companyName;
    }
    
    // Upsert pattern
    await db.query(`
      INSERT INTO learned_patterns (
        user_id, pattern_type, trigger_condition, learned_response,
        occurrences, success_rate
      ) VALUES ($1, $2, $3, $4, 1, 1.0)
      ON CONFLICT (user_id, pattern_type, trigger_condition)
      DO UPDATE SET
        learned_response = $4,
        occurrences = learned_patterns.occurrences + 1,
        last_used_at = NOW()
    `, [
      record.userId,
      patternType,
      JSON.stringify(trigger),
      record.userModifiedValue,
    ]);
  }
  
  /**
   * Get the best answer for a field based on learned patterns
   */
  async getLearnedAnswer(
    userId: string,
    field: DetectedField,
    context: FillContext
  ): Promise<string | null> {
    // Find matching patterns, ordered by confidence
    const patterns = await db.query(`
      SELECT * FROM learned_patterns
      WHERE user_id = $1
        AND is_active = true
        AND success_rate >= 0.7
        AND occurrences >= 2
      ORDER BY 
        success_rate DESC,
        occurrences DESC,
        last_used_at DESC
      LIMIT 10
    `, [userId]);
    
    // Find best matching pattern
    for (const pattern of patterns.rows) {
      if (this.patternMatches(pattern, field, context)) {
        return pattern.learned_response;
      }
    }
    
    return null;
  }
  
  /**
   * Check if a pattern matches current context
   */
  private patternMatches(
    pattern: LearnedPattern,
    field: DetectedField,
    context: FillContext
  ): boolean {
    const trigger = pattern.triggerCondition;
    
    // Check field type
    if (trigger.fieldType && trigger.fieldType !== field.fieldType) {
      return false;
    }
    
    // Check question content
    if (trigger.questionContains) {
      const questionLower = (field.label + ' ' + field.surroundingText).toLowerCase();
      if (!trigger.questionContains.some(phrase => 
        questionLower.includes(phrase.toLowerCase())
      )) {
        return false;
      }
    }
    
    // Check company
    if (trigger.companyName && trigger.companyName !== context.companyName) {
      return false;
    }
    
    // Check regex if present
    if (trigger.questionRegex) {
      const regex = new RegExp(trigger.questionRegex, 'i');
      if (!regex.test(field.label)) {
        return false;
      }
    }
    
    return true;
  }
  
  private extractKeyPhrases(text: string): string[] {
    // Extract meaningful phrases from question text
    // Remove common words, keep important keywords
    const stopWords = ['the', 'a', 'an', 'is', 'are', 'your', 'you', 'please', 'enter'];
    const words = text.toLowerCase().split(/\s+/);
    return words.filter(w => w.length > 2 && !stopWords.includes(w));
  }
  
  private inferPatternType(record: FieldFillRecord): PatternType {
    // If it's an open-ended question, it's question_answer
    if (record.fieldType === 'openEnded' || record.fieldType === 'coverLetter') {
      return 'question_answer';
    }
    
    // If modification seems company-specific
    if (this.isLikelyCompanySpecific(record)) {
      return 'company_response';
    }
    
    // Default to field_value
    return 'field_value';
  }
  
  private isLikelyCompanySpecific(record: FieldFillRecord): boolean {
    // Questions about "why [company]" are company-specific
    const companyQuestions = [
      'why do you want to work',
      'why are you interested in',
      'what attracts you to',
      'why ' + record.companyName.toLowerCase(),
    ];
    
    const questionLower = record.questionContext.toLowerCase();
    return companyQuestions.some(q => questionLower.includes(q));
  }
}
```

### 9.3 Feedback Collection UI

```typescript
// src/components/Feedback/ApplicationFeedback.tsx

interface ApplicationFeedbackProps {
  application: Application;
  onSubmit: (feedback: ApplicationFeedback) => void;
  onSkip: () => void;
}

export function ApplicationFeedbackModal({
  application,
  onSubmit,
  onSkip,
}: ApplicationFeedbackProps) {
  const [rating, setRating] = useState<number>(0);
  const [fieldFeedback, setFieldFeedback] = useState<FieldFeedback[]>([]);
  const [comments, setComments] = useState('');
  
  // Get the fields that were auto-filled
  const filledFields = useFilledFields(application.id);
  
  return (
    <Modal title="How did we do?" onClose={onSkip}>
      <div className="feedback-modal">
        {/* Overall Rating */}
        <div className="feedback-section">
          <h3>Overall, how accurate was the auto-fill?</h3>
          <StarRating value={rating} onChange={setRating} />
        </div>
        
        {/* Field-by-field feedback */}
        <div className="feedback-section">
          <h3>Any fields we got wrong?</h3>
          <p className="hint">Click on fields that need improvement</p>
          
          <div className="field-feedback-list">
            {filledFields.map(field => (
              <FieldFeedbackItem
                key={field.id}
                field={field}
                onFeedback={(fb) => {
                  setFieldFeedback(prev => [...prev, fb]);
                }}
              />
            ))}
          </div>
        </div>
        
        {/* Comments */}
        <div className="feedback-section">
          <h3>Anything else? (optional)</h3>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="Tell us how we can improve..."
          />
        </div>
        
        {/* Actions */}
        <div className="feedback-actions">
          <Button variant="ghost" onClick={onSkip}>
            Skip
          </Button>
          <Button 
            variant="primary" 
            onClick={() => onSubmit({ rating, fieldFeedback, comments })}
            disabled={rating === 0}
          >
            Submit Feedback
          </Button>
        </div>
      </div>
    </Modal>
  );
}
```

### 9.4 Enhanced Auto-Fill with Learning

```typescript
// src/services/apply/smart-fill.ts

export async function smartFillField(
  field: DetectedField,
  userProfile: UserProfile,
  context: FillContext,
  learningService: LearningService
): Promise<string> {
  // 1. First, check if we have a learned pattern for this
  const learnedAnswer = await learningService.getLearnedAnswer(
    context.userId,
    field,
    context
  );
  
  if (learnedAnswer) {
    console.log(`Using learned answer for ${field.label}`);
    return learnedAnswer;
  }
  
  // 2. Check for template/common answers
  const templateAnswer = getTemplateAnswer(field.fieldType, userProfile);
  if (templateAnswer) {
    return templateAnswer;
  }
  
  // 3. Fall back to AI generation for open-ended questions
  if (field.fieldType === 'openEnded') {
    return await generateAIAnswer(field, userProfile, context);
  }
  
  // 4. Return empty for unknown fields
  return '';
}
```

---

## 10. Application Logs & History

Complete logging of every application for user visibility and debugging.

### 10.1 Log Data Models

```typescript
// src/types/logs.ts

export interface ApplicationLog {
  id: string;
  applicationId: string;
  userId: string;
  
  // Summary
  companyName: string;
  jobTitle: string;
  jobUrl: string;
  applyUrl: string;
  
  // Status
  status: ApplicationStatus;
  statusHistory: StatusChange[];
  
  // Timing
  startedAt: Date;
  completedAt: Date | null;
  totalDurationMs: number | null;
  
  // What we did
  automationSteps: AutomationStepLog[];
  fieldsAutoFilled: FieldFillLog[];
  
  // Errors
  errors: ApplicationError[];
  
  // User modifications
  userModifications: UserModificationLog[];
  
  // Final state
  finalFormData: Record<string, any>;
  screenshotUrl?: string;  // Screenshot before submit
}

export interface AutomationStepLog {
  step: number;
  action: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  startedAt: Date;
  completedAt: Date | null;
  durationMs: number | null;
  error?: string;
  details?: Record<string, any>;
}

export interface FieldFillLog {
  fieldLabel: string;
  fieldType: FieldType;
  selector: string;
  
  // What we filled
  filledValue: string;
  fillMethod: 'learned' | 'template' | 'ai' | 'profile' | 'manual';
  
  // AI details if applicable
  aiPrompt?: string;
  aiResponse?: string;
  
  // Was it modified?
  wasModified: boolean;
  finalValue: string;
  
  filledAt: Date;
}

export interface UserModificationLog {
  fieldLabel: string;
  originalValue: string;
  newValue: string;
  modifiedAt: Date;
}

export interface ApplicationError {
  step: string;
  errorType: string;
  errorMessage: string;
  stackTrace?: string;
  timestamp: Date;
  recovered: boolean;
}
```

### 10.2 Database Schema for Logs

```sql
-- Application logs table
CREATE TABLE application_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES applications(id),
  user_id UUID REFERENCES users(id),
  
  -- Summary (denormalized for quick queries)
  company_name VARCHAR(255),
  job_title VARCHAR(255),
  job_url TEXT,
  apply_url TEXT,
  
  -- Status
  status VARCHAR(50),
  status_history JSONB DEFAULT '[]',
  
  -- Timing
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  total_duration_ms INTEGER,
  
  -- Details (stored as JSONB for flexibility)
  automation_steps JSONB DEFAULT '[]',
  fields_auto_filled JSONB DEFAULT '[]',
  errors JSONB DEFAULT '[]',
  user_modifications JSONB DEFAULT '[]',
  final_form_data JSONB DEFAULT '{}',
  
  -- Screenshot
  screenshot_url TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_application_logs_user ON application_logs(user_id);
CREATE INDEX idx_application_logs_status ON application_logs(status);
CREATE INDEX idx_application_logs_date ON application_logs(started_at DESC);
CREATE INDEX idx_application_logs_company ON application_logs(company_name);
```

### 10.3 Logging Service

```typescript
// src/services/logging/application-logger.ts

export class ApplicationLogger {
  private logId: string;
  private steps: AutomationStepLog[] = [];
  private fields: FieldFillLog[] = [];
  private errors: ApplicationError[] = [];
  private modifications: UserModificationLog[] = [];
  
  constructor(
    private applicationId: string,
    private userId: string,
    private context: { companyName: string; jobTitle: string; jobUrl: string; applyUrl: string }
  ) {
    this.logId = crypto.randomUUID();
  }
  
  async initialize(): Promise<void> {
    await db.query(`
      INSERT INTO application_logs (
        id, application_id, user_id, company_name, job_title,
        job_url, apply_url, status, started_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'in_progress', NOW())
    `, [
      this.logId,
      this.applicationId,
      this.userId,
      this.context.companyName,
      this.context.jobTitle,
      this.context.jobUrl,
      this.context.applyUrl,
    ]);
  }
  
  logStep(step: Omit<AutomationStepLog, 'startedAt' | 'completedAt' | 'durationMs'>): void {
    this.steps.push({
      ...step,
      startedAt: new Date(),
      completedAt: null,
      durationMs: null,
    });
    this.persist();
  }
  
  completeStep(stepNumber: number, status: 'completed' | 'failed', error?: string): void {
    const step = this.steps.find(s => s.step === stepNumber);
    if (step) {
      step.status = status;
      step.completedAt = new Date();
      step.durationMs = step.completedAt.getTime() - step.startedAt.getTime();
      if (error) step.error = error;
    }
    this.persist();
  }
  
  logFieldFill(field: FieldFillLog): void {
    this.fields.push(field);
    this.persist();
  }
  
  logError(error: Omit<ApplicationError, 'timestamp'>): void {
    this.errors.push({
      ...error,
      timestamp: new Date(),
    });
    this.persist();
  }
  
  logUserModification(mod: Omit<UserModificationLog, 'modifiedAt'>): void {
    this.modifications.push({
      ...mod,
      modifiedAt: new Date(),
    });
    
    // Also update the field fill log
    const field = this.fields.find(f => f.fieldLabel === mod.fieldLabel);
    if (field) {
      field.wasModified = true;
      field.finalValue = mod.newValue;
    }
    
    this.persist();
  }
  
  async complete(
    status: ApplicationStatus,
    finalFormData: Record<string, any>,
    screenshotUrl?: string
  ): Promise<void> {
    const completedAt = new Date();
    const startedAt = await this.getStartTime();
    const durationMs = completedAt.getTime() - startedAt.getTime();
    
    await db.query(`
      UPDATE application_logs
      SET
        status = $1,
        completed_at = $2,
        total_duration_ms = $3,
        automation_steps = $4,
        fields_auto_filled = $5,
        errors = $6,
        user_modifications = $7,
        final_form_data = $8,
        screenshot_url = $9
      WHERE id = $10
    `, [
      status,
      completedAt,
      durationMs,
      JSON.stringify(this.steps),
      JSON.stringify(this.fields),
      JSON.stringify(this.errors),
      JSON.stringify(this.modifications),
      JSON.stringify(finalFormData),
      screenshotUrl,
      this.logId,
    ]);
  }
  
  private async persist(): Promise<void> {
    await db.query(`
      UPDATE application_logs
      SET
        automation_steps = $1,
        fields_auto_filled = $2,
        errors = $3,
        user_modifications = $4
      WHERE id = $5
    `, [
      JSON.stringify(this.steps),
      JSON.stringify(this.fields),
      JSON.stringify(this.errors),
      JSON.stringify(this.modifications),
      this.logId,
    ]);
  }
}
```

### 10.4 Application History UI

```typescript
// src/components/History/ApplicationHistory.tsx

export function ApplicationHistory() {
  const { data: logs, isLoading } = useApplicationLogs();
  const [selectedLog, setSelectedLog] = useState<ApplicationLog | null>(null);
  
  return (
    <div className="application-history">
      <div className="history-header">
        <h1>Application History</h1>
        <p>View all your past applications and what was submitted</p>
        
        <div className="history-stats">
          <StatCard label="Total Applications" value={logs?.length || 0} />
          <StatCard 
            label="Submitted" 
            value={logs?.filter(l => l.status === 'submitted').length || 0} 
          />
          <StatCard 
            label="This Week" 
            value={logs?.filter(l => isThisWeek(l.startedAt)).length || 0} 
          />
        </div>
      </div>
      
      {/* Filter/Search */}
      <div className="history-filters">
        <SearchInput placeholder="Search by company or job title..." />
        <Select 
          options={['All', 'Submitted', 'Failed', 'In Progress']}
          placeholder="Status"
        />
        <DateRangePicker />
      </div>
      
      {/* Log List */}
      <div className="history-list">
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          logs?.map(log => (
            <ApplicationLogCard
              key={log.id}
              log={log}
              onClick={() => setSelectedLog(log)}
            />
          ))
        )}
      </div>
      
      {/* Detail Modal */}
      {selectedLog && (
        <ApplicationLogDetail
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
        />
      )}
    </div>
  );
}

function ApplicationLogCard({ log, onClick }: { log: ApplicationLog; onClick: () => void }) {
  return (
    <div className="log-card" onClick={onClick}>
      <div className="log-card__main">
        <div className="log-card__company">
          <CompanyLogo name={log.companyName} />
          <div>
            <h3>{log.jobTitle}</h3>
            <p>{log.companyName}</p>
          </div>
        </div>
        
        <StatusBadge status={log.status} />
      </div>
      
      <div className="log-card__meta">
        <span>{formatDate(log.startedAt)}</span>
        <span>{log.fieldsAutoFilled.length} fields auto-filled</span>
        {log.userModifications.length > 0 && (
          <span className="modifications">
            {log.userModifications.length} manual edits
          </span>
        )}
        {log.errors.length > 0 && (
          <span className="errors">
            {log.errors.length} errors
          </span>
        )}
      </div>
    </div>
  );
}

function ApplicationLogDetail({ log, onClose }: { log: ApplicationLog; onClose: () => void }) {
  return (
    <Modal title="Application Details" onClose={onClose} size="large">
      <div className="log-detail">
        {/* Header */}
        <div className="log-detail__header">
          <h2>{log.jobTitle}</h2>
          <p>{log.companyName}</p>
          <StatusBadge status={log.status} large />
          <a href={log.jobUrl} target="_blank" rel="noopener">View Job</a>
        </div>
        
        {/* Timeline of steps */}
        <section className="log-detail__section">
          <h3>Automation Steps</h3>
          <Timeline steps={log.automationSteps} />
        </section>
        
        {/* Fields filled */}
        <section className="log-detail__section">
          <h3>Fields Auto-Filled ({log.fieldsAutoFilled.length})</h3>
          <table className="fields-table">
            <thead>
              <tr>
                <th>Field</th>
                <th>Value</th>
                <th>Method</th>
                <th>Modified?</th>
              </tr>
            </thead>
            <tbody>
              {log.fieldsAutoFilled.map(field => (
                <tr key={field.fieldLabel} className={field.wasModified ? 'modified' : ''}>
                  <td>{field.fieldLabel}</td>
                  <td className="value">{truncate(field.finalValue, 100)}</td>
                  <td><Badge>{field.fillMethod}</Badge></td>
                  <td>
                    {field.wasModified ? (
                      <span className="modified-indicator">✏️ Modified</span>
                    ) : (
                      <span className="accepted-indicator">✓ Accepted</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        
        {/* User modifications */}
        {log.userModifications.length > 0 && (
          <section className="log-detail__section">
            <h3>Your Modifications</h3>
            <div className="modifications-list">
              {log.userModifications.map((mod, i) => (
                <div key={i} className="modification">
                  <strong>{mod.fieldLabel}</strong>
                  <div className="diff">
                    <del>{mod.originalValue}</del>
                    <ins>{mod.newValue}</ins>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
        
        {/* Errors */}
        {log.errors.length > 0 && (
          <section className="log-detail__section error-section">
            <h3>Errors ({log.errors.length})</h3>
            {log.errors.map((error, i) => (
              <div key={i} className="error-item">
                <strong>{error.step}</strong>
                <p>{error.errorMessage}</p>
                {error.recovered && <Badge variant="success">Recovered</Badge>}
              </div>
            ))}
          </section>
        )}
        
        {/* Screenshot */}
        {log.screenshotUrl && (
          <section className="log-detail__section">
            <h3>Submission Screenshot</h3>
            <img src={log.screenshotUrl} alt="Application screenshot" />
          </section>
        )}
      </div>
    </Modal>
  );
}
```

### 10.5 API Endpoints for Logs

```typescript
// Additional API routes for logs

// Applications/Logs
GET    /api/applications/logs                    // List all logs with pagination
GET    /api/applications/logs/:id                // Get detailed log
GET    /api/applications/logs/stats              // Get statistics
GET    /api/applications/logs/export             // Export as CSV/JSON
DELETE /api/applications/logs/:id                // Delete a log entry

// Learning
GET    /api/learning/patterns                    // View learned patterns
DELETE /api/learning/patterns/:id               // Delete a pattern
POST   /api/learning/patterns/:id/deactivate    // Disable a pattern
GET    /api/learning/stats                       // Learning statistics
```

---

## 11. Implementation Order

### Phase 1: Foundation (Week 1-2)
**Goal:** Basic data layer and user onboarding

1. **Database Setup**
   - Set up PostgreSQL with pgvector extension
   - Create all tables from schema
   - Seed company data (top 500 tech companies)
   
2. **Authentication**
   - User registration/login
   - JWT token management
   - Password reset flow

3. **User Profile & Onboarding**
   - Profile creation wizard
   - Resume upload & parsing
   - Industry selection
   - Seed company picker

4. **Company Management**
   - Company search/autocomplete
   - Company detail pages
   - User-company relationships (seed, dream, etc.)

### Phase 2: Job Discovery (Week 3-4)
**Goal:** Core job search and display

1. **Scraper Infrastructure**
   - Scraper interface and registry
   - Greenhouse scraper (API-based)
   - Lever scraper (API-based)
   - Basic error handling and retry

2. **GitHub Repo Scrapers (PRIMARY)**
   - Simplify repo parser (Summer2025-Internships)
   - Pitt CSC repo parser
   - SpeedyApply repo parser
   - Markdown table parsing logic
   - Scheduled sync (every 30 mins)

3. **Job Storage**
   - Job deduplication logic
   - Full-text search indexing
   - Job expiration handling

4. **Job List UI**
   - Basic list view (25 per page)
   - Pagination
   - Basic filters (location, job type)
   - Sort controls

5. **Job Detail View**
   - Full job description
   - Company info sidebar
   - Apply button (external redirect for now)

### Phase 3: Matching (Week 5-6)
**Goal:** Smart job ranking

1. **Embedding Generation**
   - Company embedding pipeline
   - Seed embedding aggregation
   - Batch processing for existing companies

2. **Matching Algorithm**
   - Implement all score functions
   - Weight-based aggregation
   - Cache computed scores

3. **Weight Sliders UI**
   - Settings page with sliders
   - Real-time score recalculation
   - Default presets

4. **Match-Sorted Results**
   - Sort by match score
   - Match breakdown display
   - "Why this match" explainer

### Phase 4: Heartbeat System (Week 7-8)
**Goal:** Automated job discovery

1. **Queue Infrastructure**
   - Redis + Bull setup
   - Priority queue implementation
   - Worker pool

2. **Scheduler Service**
   - Per-user heartbeat scheduling
   - Configurable frequency
   - Global company scraping

3. **Additional Scrapers**
   - Workday scraper
   - Oracle/Taleo scraper
   - Handshake integration (OAuth)

4. **Notifications**
   - WebSocket real-time updates
   - New job alerts
   - "N new jobs" badge

### Phase 5: One-Click Apply (Week 9-10)
**Goal:** Streamlined application flow

1. **Browser Extension**
   - Chrome extension scaffold
   - Communication with main app
   - Page detection and injection

2. **Form Detection**
   - Field type detection
   - Label parsing
   - Custom question identification

3. **Auto-Fill Logic**
   - Standard field mapping
   - Resume upload automation
   - AI-powered custom question answers

4. **Review Flow**
   - Submission review page
   - Edit capabilities
   - Final submit action

### Phase 6: Advanced Apply (Week 11-12)
**Goal:** Full automation options

1. **Full Auto Mode**
   - Auto-submit implementation
   - Daily limit enforcement
   - Confirmation flow

2. **Swarm Mode**
   - Multi-job selection UI
   - Batch processing
   - Progress tracking

3. **Application Logging**
   - Comprehensive log storage
   - Field-by-field tracking
   - Screenshot capture before submit
   - Application history UI

4. **Quality Controls**
   - Rate limiting
   - Error detection
   - Fallback to manual

### Phase 7: Learning System (Week 13-14)
**Goal:** AI that learns from user behavior

1. **Feedback Collection**
   - Post-application feedback modal
   - Field-by-field rating
   - Comments collection

2. **Learning Service**
   - Track all auto-filled values
   - Detect user modifications
   - Pattern extraction from modifications

3. **Pattern Storage**
   - Question → answer patterns
   - Field type preferences
   - Company-specific responses

4. **Smart Fill Integration**
   - Check learned patterns first
   - Fall back to templates/AI
   - Confidence scoring

### Phase 8: Polish & Launch (Week 15-16)
**Goal:** Production readiness

1. **Performance**
   - Query optimization
   - Caching layer
   - CDN setup

2. **Mobile Responsive**
   - Responsive layouts
   - Touch-friendly interactions
   - PWA setup

3. **Error Handling**
   - Global error boundaries
   - User-friendly error messages
   - Recovery flows

4. **Analytics & Monitoring**
   - Usage tracking
   - Error monitoring (Sentry)
   - Performance metrics
   - Learning system effectiveness tracking

---

## Appendix A: API Routes

```typescript
// Main API structure

// Auth
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/forgot-password
POST   /api/auth/reset-password

// Users
GET    /api/users/me
PATCH  /api/users/me
GET    /api/users/me/profile
PATCH  /api/users/me/profile
GET    /api/users/me/preferences
PATCH  /api/users/me/preferences

// Companies
GET    /api/companies
GET    /api/companies/:id
GET    /api/companies/search?q=
POST   /api/companies/:id/relationship
DELETE /api/companies/:id/relationship
GET    /api/users/me/companies?relationship=seed|dream|interested

// Jobs
GET    /api/jobs
GET    /api/jobs/:id
POST   /api/jobs/:id/save
DELETE /api/jobs/:id/save
POST   /api/jobs/:id/hide
POST   /api/jobs/:id/feedback

// Applications
GET    /api/applications
GET    /api/applications/:id
POST   /api/applications
PATCH  /api/applications/:id
POST   /api/applications/:id/submit

// Application Logs
GET    /api/applications/logs
GET    /api/applications/logs/:id
GET    /api/applications/logs/stats
GET    /api/applications/logs/export
DELETE /api/applications/logs/:id

// Feedback & Learning
POST   /api/applications/:id/feedback
GET    /api/learning/patterns
DELETE /api/learning/patterns/:id
POST   /api/learning/patterns/:id/toggle
GET    /api/learning/stats

// Field tracking (called by extension during fill)
POST   /api/fields/record-fill
POST   /api/fields/record-modification

// Heartbeat
GET    /api/heartbeat/config
PATCH  /api/heartbeat/config
GET    /api/heartbeat/runs
POST   /api/heartbeat/trigger

// GitHub Repos
GET    /api/sources/github-repos
POST   /api/sources/github-repos/sync
GET    /api/sources/github-repos/status
```

---

## Appendix B: Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/jobfinder
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# AI/Embeddings
OPENAI_API_KEY=sk-...

# Scraping
SCRAPE_USER_AGENT=JobFinder/1.0 (+https://jobfinder.app)
SCRAPE_RATE_LIMIT_PER_MINUTE=30

# Handshake OAuth
HANDSHAKE_CLIENT_ID=
HANDSHAKE_CLIENT_SECRET=
HANDSHAKE_REDIRECT_URI=

# Notifications
SENDGRID_API_KEY=
EMAIL_FROM=notifications@jobfinder.app
```

---

*End of Technical Specification*
