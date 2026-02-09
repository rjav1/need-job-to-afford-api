# Resume Tailoring Feature - Technical Specification

## Overview

Intelligent resume management system that helps users maintain multiple resume variants, suggests tailoring based on job descriptions, and provides confidence scoring for job-resume fit.

---

## 1. Data Models / TypeScript Interfaces

### Core Resume Types

```typescript
// src/lib/resume-types.ts

/**
 * Resume variant - a specific version of a resume
 * Can be a permanent variant or a "one-off" slot
 */
export interface ResumeVariant {
  id: string;                    // Unique identifier (uuid)
  name: string;                  // User-friendly name "Backend Engineer Resume"
  tags: string[];                // Free-form tags ["backend", "python", "fintech"]
  isDefault: boolean;            // Is this the fallback resume?
  isOneOff: boolean;             // Is this a temporary "one-off" slot?
  oneOffSlot?: number;           // Slot number (1-3) if one-off
  
  // File references (stored in File System Access API)
  docxPath: string;              // Path/handle ID for editable DOCX
  lastPdfPath?: string;          // Path to last generated PDF
  
  // Parsed content (for matching without opening file)
  parsedContent: ParsedResumeContent;
  
  // Metadata
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
  lastUsedAt?: string;           // Last time submitted to a job
  usageCount: number;            // How many times used
}

/**
 * Parsed resume content - extracted for matching & display
 */
export interface ParsedResumeContent {
  // Header info
  fullName: string;
  email: string;
  phone?: string;
  location?: string;
  linkedIn?: string;
  github?: string;
  portfolio?: string;
  
  // Summary/Objective
  summary?: string;
  
  // Core sections
  experiences: ExperienceEntry[];
  education: EducationEntry[];
  skills: SkillCategory[];
  projects: ProjectEntry[];
  certifications?: CertificationEntry[];
  
  // Raw text for AI fallback
  rawText: string;
  
  // Parsing metadata
  parseMethod: 'docx' | 'sheets' | 'ai';
  parsedAt: string;
  tokenCount?: number;           // Estimated tokens for AI context
}

export interface ExperienceEntry {
  company: string;
  title: string;
  location?: string;
  startDate: string;
  endDate?: string;              // null = "Present"
  isCurrent: boolean;
  bullets: string[];
  technologies?: string[];       // Extracted tech mentions
}

export interface EducationEntry {
  institution: string;
  degree: string;
  field: string;
  gpa?: string;
  startDate?: string;
  endDate?: string;
  honors?: string[];
  relevantCourses?: string[];
}

export interface SkillCategory {
  category: string;              // "Languages", "Frameworks", "Tools"
  skills: string[];
}

export interface ProjectEntry {
  name: string;
  description: string;
  technologies: string[];
  highlights: string[];
  url?: string;
  startDate?: string;
  endDate?: string;
}

export interface CertificationEntry {
  name: string;
  issuer: string;
  date?: string;
  expiryDate?: string;
  credentialId?: string;
}

/**
 * Job description - parsed from job posting
 */
export interface JobDescription {
  id: string;
  title: string;
  company: string;
  location?: string;
  jobType?: 'full-time' | 'part-time' | 'contract' | 'internship';
  
  // Parsed requirements
  requiredSkills: string[];
  preferredSkills: string[];
  yearsExperience?: number;
  educationRequirement?: string;
  
  // Keywords
  keywords: string[];
  industryTerms: string[];
  
  // Raw content
  rawDescription: string;
  
  // Source
  sourceUrl: string;
  scrapedAt: string;
}

/**
 * Match result - how well a resume fits a job
 */
export interface MatchResult {
  resumeId: string;
  jobId: string;
  
  // Overall scores (0-100)
  overallScore: number;
  confidenceScore: number;       // How confident are we in this match
  
  // Component scores
  skillsMatch: SkillsMatchScore;
  experienceMatch: ExperienceMatchScore;
  industryMatch: IndustryMatchScore;
  vibesScore: VibesScore;        // The "je ne sais quoi" factor
  
  // Suggestions
  suggestions: TailoringSuggestion[];
  
  // Decision
  recommendation: MatchRecommendation;
  
  // Timestamp
  analyzedAt: string;
}

export interface SkillsMatchScore {
  score: number;                 // 0-100
  matchedRequired: string[];     // Required skills found
  missingRequired: string[];     // Required skills NOT found
  matchedPreferred: string[];    // Nice-to-haves found
  missingPreferred: string[];    // Nice-to-haves missing
}

export interface ExperienceMatchScore {
  score: number;
  yearsRelevant: number;
  yearsRequired: number;
  relevantRoles: string[];       // Roles that match
  gaps: string[];                // Experience gaps
}

export interface IndustryMatchScore {
  score: number;
  matchedIndustries: string[];
  relevantProjects: string[];
  domainExperience: 'strong' | 'moderate' | 'weak' | 'none';
}

export interface VibesScore {
  score: number;                 // 0-100
  reasoning: string;             // Why this vibe score
  cultureFit?: 'likely' | 'possible' | 'unlikely';
  tonalAlignment?: number;       // How well writing style matches
}

export type SuggestionPriority = 'critical' | 'high' | 'medium' | 'low';
export type SuggestionType = 
  | 'add_skill'
  | 'reword_bullet'
  | 'add_experience'
  | 'reorder_section'
  | 'add_keyword'
  | 'adjust_summary'
  | 'quantify_achievement'
  | 'remove_irrelevant';

export interface TailoringSuggestion {
  id: string;
  type: SuggestionType;
  priority: SuggestionPriority;
  
  // What to change
  section: 'summary' | 'experience' | 'skills' | 'projects' | 'education';
  targetIndex?: number;          // Which item in the section
  
  // The suggestion
  summaryLine: string;           // Short description (shown in UI)
  detailedExplanation: string;   // Full explanation
  
  // Specific changes (for easy editing)
  currentText?: string;          // What's there now
  suggestedText?: string;        // What it should be
  
  // Why
  reason: string;
  impactEstimate: 'high' | 'medium' | 'low';
  
  // Status
  applied: boolean;
  dismissed: boolean;
}

export interface MatchRecommendation {
  action: 'use_as_is' | 'make_tweaks' | 'create_variant' | 'skip';
  confidence: number;
  
  // If create_variant
  suggestedVariantName?: string;
  requiredChanges?: string[];    // Highlighted must-have changes
}

/**
 * File handle storage - for File System Access API
 */
export interface StoredFileHandle {
  id: string;
  name: string;
  type: 'docx' | 'pdf';
  resumeId: string;
  // Actual handle stored separately (can't serialize)
}
```

### Storage Keys Extension

```typescript
// Extend existing STORAGE_KEYS in types.ts

export const STORAGE_KEYS = {
  // ... existing keys
  USER_PROFILE: 'userProfile',
  APPLICATIONS: 'applications',
  API_KEY: 'apiKey',
  AI_PROVIDER: 'aiProvider',
  SETTINGS: 'settings',
  
  // Resume management
  RESUME_VARIANTS: 'resumeVariants',
  DEFAULT_RESUME_ID: 'defaultResumeId',
  ONE_OFF_SLOTS: 'oneOffSlots',
  FILE_HANDLES: 'fileHandles',
  MATCH_HISTORY: 'matchHistory',
  JOB_CACHE: 'jobCache',
} as const;

// One-off slot config
export const ONE_OFF_SLOT_COUNT = 3;
```

---

## 2. Storage Schema

### Chrome Storage Structure

```typescript
// src/lib/resume-storage.ts

interface ResumeStorageSchema {
  // Array of all resume variants (metadata only)
  resumeVariants: ResumeVariant[];
  
  // ID of the default resume
  defaultResumeId: string | null;
  
  // One-off slot assignments: slot number → resume ID
  oneOffSlots: {
    1: string | null;
    2: string | null;
    3: string | null;
  };
  
  // File handle references (actual handles in IndexedDB)
  fileHandles: StoredFileHandle[];
  
  // Recent match results (capped at 50)
  matchHistory: MatchResult[];
  
  // Cached job descriptions (capped at 20)
  jobCache: JobDescription[];
}

// Storage size estimates:
// - Each ResumeVariant: ~5-10KB (parsed content)
// - Each MatchResult: ~2-3KB
// - Chrome storage limit: 5MB sync, 10MB local
// - Strategy: Use local storage, sync only IDs/settings
```

### File System Structure

```
User's chosen directory/
├── resumes/
│   ├── FIRST_LAST_RESUME.pdf           # Default/submitted version
│   ├── backend_engineer_v1.docx        # Editable source
│   ├── backend_engineer_v1.pdf         # Generated PDF
│   ├── frontend_react.docx
│   ├── frontend_react.pdf
│   └── _oneoff/                        # One-off slot directory
│       ├── slot_1.docx
│       ├── slot_1.pdf
│       ├── slot_2.docx
│       └── slot_3.docx
└── exports/                            # PDF exports for submission
    └── FIRST_LAST_RESUME.pdf           # Canonical submission name
```

### IndexedDB Schema (for File Handles)

```typescript
// File handles can't be serialized to chrome.storage
// Store them in IndexedDB

interface FileHandleDB {
  dbName: 'resumeFileHandles';
  version: 1;
  stores: {
    handles: {
      keyPath: 'id';
      indexes: ['resumeId', 'type'];
      value: {
        id: string;
        resumeId: string;
        type: 'docx' | 'pdf';
        handle: FileSystemFileHandle;  // Actual handle
        grantedAt: string;
      };
    };
    directoryHandle: {
      keyPath: 'id';
      value: {
        id: 'root';
        handle: FileSystemDirectoryHandle;
        grantedAt: string;
      };
    };
  };
}
```

---

## 3. UI Components

### Component Hierarchy

```
src/
├── options/
│   ├── App.tsx                         # Main app (add Resume tab)
│   └── components/
│       └── resume/
│           ├── ResumeManager.tsx       # Main resume management view
│           ├── ResumeList.tsx          # List of all variants
│           ├── ResumeCard.tsx          # Individual resume card
│           ├── ResumeEditor.tsx        # DOCX editing interface
│           ├── ResumeUploader.tsx      # Upload/import component
│           ├── TagManager.tsx          # Free-form tag editing
│           └── OneOffSlots.tsx         # One-off slot management
│
├── popup/
│   └── components/
│       └── resume/
│           ├── QuickResumePicker.tsx   # Fast resume selection
│           ├── MatchScore.tsx          # Confidence display
│           └── SuggestionsList.tsx     # Quick suggestions view
│
└── content/
    └── components/
        └── resume/
            ├── ResumeMatchOverlay.tsx  # Shows match on job pages
            ├── ConfidenceBadge.tsx     # Score visualization
            └── TailoringPanel.tsx      # Side panel for suggestions
```

### Key Component Specs

#### ResumeManager.tsx
```typescript
interface ResumeManagerProps {
  // None - fetches from storage
}

interface ResumeManagerState {
  variants: ResumeVariant[];
  selectedId: string | null;
  isEditing: boolean;
  filter: {
    tags: string[];
    searchQuery: string;
  };
}

// Features:
// - Grid/list view of all resumes
// - Filter by tags
// - Set default resume (star icon)
// - One-off slots section
// - Import new resume button
// - "Save as new copy" action
```

#### ResumeEditor.tsx
```typescript
interface ResumeEditorProps {
  resumeId: string;
  onSave: (updated: ResumeVariant) => void;
  onSaveAsCopy: (newVariant: ResumeVariant) => void;
  onCancel: () => void;
}

// Features:
// - Rich text editing of DOCX sections
// - Section-by-section editing (not full WYSIWYG)
// - AI suggestion integration (human-in-the-loop)
// - Preview pane
// - "Apply suggestion" buttons inline
// - Export to PDF button
```

#### MatchScore.tsx
```typescript
interface MatchScoreProps {
  result: MatchResult;
  compact?: boolean;  // For popup vs full view
}

// Visual:
// - Circular progress indicator (overall score)
// - Color coding: green (80+), yellow (60-79), red (<60)
// - Breakdown bars for skills/experience/industry/vibes
// - Recommendation badge
```

#### TailoringPanel.tsx
```typescript
interface TailoringPanelProps {
  matchResult: MatchResult;
  resume: ResumeVariant;
  onApplySuggestion: (suggestionId: string, newText: string) => void;
  onDismissSuggestion: (suggestionId: string) => void;
  onCreateVariant: () => void;
}

// Features:
// - Grouped by priority (critical first)
// - Expandable cards with summary → detail
// - "Apply" button opens inline editor
// - "Dismiss" button with optional feedback
// - "Create New Variant" floating action
```

---

## 4. AI Integration Points

### Integration Architecture

```typescript
// src/lib/resume-ai.ts

/**
 * AI integration points for resume tailoring
 */

// 1. Resume Parsing (fallback when DOCX parsing fails)
export async function parseResumeWithAI(
  fileContent: string,
  fileName: string
): Promise<ParsedResumeContent>;

// 2. Job Description Analysis
export async function analyzeJobDescription(
  rawJD: string,
  sourceUrl: string
): Promise<JobDescription>;

// 3. Match Scoring
export async function scoreResumeMatch(
  resume: ParsedResumeContent,
  job: JobDescription
): Promise<MatchResult>;

// 4. Generate Tailoring Suggestions
export async function generateSuggestions(
  resume: ParsedResumeContent,
  job: JobDescription,
  matchResult: MatchResult
): Promise<TailoringSuggestion[]>;

// 5. Apply Suggestion (rewrite text)
export async function applySuggestion(
  originalText: string,
  suggestion: TailoringSuggestion,
  context: { resume: ParsedResumeContent; job: JobDescription }
): Promise<string>;

// 6. Vibes Analysis (the fun one)
export async function analyzeVibes(
  resume: ParsedResumeContent,
  job: JobDescription
): Promise<VibesScore>;
```

### AI Prompts

```typescript
// src/lib/resume-prompts.ts

export const PROMPTS = {
  PARSE_RESUME: `
Parse this resume into structured JSON. Extract:
- Contact info (name, email, phone, links)
- Summary/objective
- Work experience (company, title, dates, bullets)
- Education (school, degree, field, dates)
- Skills (categorized)
- Projects (name, description, tech)

Resume text:
{{resumeText}}

Return valid JSON matching the ParsedResumeContent schema.
`,

  ANALYZE_JOB: `
Analyze this job description and extract:
- Required skills (must have)
- Preferred skills (nice to have)  
- Years of experience needed
- Education requirements
- Key industry terms
- Important keywords for ATS

Job description:
{{jobDescription}}

Return valid JSON matching the JobDescription schema.
`,

  SCORE_MATCH: `
Score how well this resume matches this job. Consider:
1. Skills match (required vs actual)
2. Experience relevance and years
3. Industry/domain alignment
4. Education fit
5. Overall "vibes" - would this person thrive here?

Resume:
{{resumeJson}}

Job:
{{jobJson}}

Return scores 0-100 for each category with reasoning.
`,

  GENERATE_SUGGESTIONS: `
Generate specific, actionable suggestions to tailor this resume for this job.

Rules:
- Be concise - suggestions should be easy to implement
- Prioritize: critical (missing required skills) > high > medium > low
- Provide exact rewording when suggesting text changes
- Focus on substance, not fluff
- Don't suggest lying or exaggerating

Current match score: {{overallScore}}
Key gaps: {{gaps}}

Resume:
{{resumeJson}}

Job:
{{jobJson}}

Return 5-10 suggestions with specific before/after text.
`,

  VIBES_ANALYSIS: `
Assess the "vibes" fit between this candidate and role.

Consider:
- Writing style/tone alignment
- Cultural signals in the resume
- Career trajectory match
- Red flags or green flags
- Gut feeling (be honest but professional)

This is subjective - that's the point. Give a score 0-100 and explain your reasoning in 2-3 sentences.

Resume highlights:
{{resumeHighlights}}

Job culture signals:
{{jobCultureSignals}}
`,
};
```

### Token Optimization Strategy

```typescript
// src/lib/resume-ai.ts

/**
 * Token-saving strategies
 */

// 1. Parse DOCX locally first, only use AI as fallback
export async function smartParse(file: File): Promise<ParsedResumeContent> {
  try {
    // Try DOCX parsing first (free)
    return await parseDocxLocally(file);
  } catch {
    // Fall back to AI (costs tokens)
    const text = await file.text();
    return await parseResumeWithAI(text, file.name);
  }
}

// 2. Cache job descriptions
const JOB_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export async function getJobAnalysis(url: string): Promise<JobDescription> {
  const cached = await getCachedJob(url);
  if (cached && Date.now() - new Date(cached.scrapedAt).getTime() < JOB_CACHE_TTL) {
    return cached;
  }
  // Fetch and analyze
  const fresh = await analyzeJobDescription(await fetchJobPage(url), url);
  await cacheJob(fresh);
  return fresh;
}

// 3. Use smaller context for vibes (just highlights)
export function extractHighlightsForVibes(resume: ParsedResumeContent): string {
  return [
    resume.summary || '',
    ...resume.experiences.slice(0, 2).flatMap(e => e.bullets.slice(0, 2)),
    resume.skills.map(s => s.skills.join(', ')).join('; '),
  ].join('\n');
}
```

---

## 5. File Conversion Flow

### DOCX → Edit → PDF Pipeline

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│ Import DOCX │────▶│ Parse & Store│────▶│ Display in  │
│ (user picks)│     │ (mammoth.js) │     │   Editor    │
└─────────────┘     └──────────────┘     └─────────────┘
                                                │
                          ┌─────────────────────┘
                          ▼
                    ┌───────────┐
                    │ User Edits│
                    │ (in-app)  │
                    └───────────┘
                          │
           ┌──────────────┼──────────────┐
           ▼              ▼              ▼
     ┌─────────┐    ┌──────────┐   ┌──────────┐
     │  Save   │    │ Save as  │   │ Export   │
     │ (DOCX)  │    │ New Copy │   │  (PDF)   │
     └─────────┘    └──────────┘   └──────────┘
           │              │              │
           ▼              ▼              ▼
     ┌─────────┐    ┌──────────┐   ┌──────────┐
     │ Update  │    │ Create   │   │ Generate │
     │ File    │    │ New File │   │   PDF    │
     └─────────┘    └──────────┘   └──────────┘
                                        │
                                        ▼
                                  ┌──────────┐
                                  │ FIRST_   │
                                  │ LAST_    │
                                  │ RESUME   │
                                  │  .pdf    │
                                  └──────────┘
```

### Implementation

```typescript
// src/lib/file-conversion.ts

import mammoth from 'mammoth';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * DOCX Parsing (primary method)
 */
export async function parseDocx(file: File): Promise<{
  html: string;
  text: string;
  messages: string[];
}> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });
  const textResult = await mammoth.extractRawText({ arrayBuffer });
  
  return {
    html: result.value,
    text: textResult.value,
    messages: result.messages.map(m => m.message),
  };
}

/**
 * Structured extraction from DOCX HTML
 */
export function extractStructuredContent(
  html: string,
  text: string
): ParsedResumeContent {
  // Parse HTML to extract sections
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // Extract by common resume section headers
  const sections = identifySections(doc);
  
  return {
    fullName: extractName(doc, text),
    email: extractEmail(text),
    phone: extractPhone(text),
    linkedIn: extractLinkedIn(text),
    github: extractGithub(text),
    summary: sections.summary,
    experiences: parseExperiences(sections.experience),
    education: parseEducation(sections.education),
    skills: parseSkills(sections.skills),
    projects: parseProjects(sections.projects),
    rawText: text,
    parseMethod: 'docx',
    parsedAt: new Date().toISOString(),
  };
}

/**
 * Write updated content back to DOCX
 */
export async function updateDocx(
  originalFile: File,
  updates: Partial<ParsedResumeContent>
): Promise<Blob> {
  // Use docx library for writing
  const { Document, Packer, Paragraph } = await import('docx');
  
  // Strategy: Replace specific sections while preserving formatting
  // This is complex - may need to store original DOCX structure
  
  // Simplified approach: regenerate from structured content
  const doc = generateDocxFromContent(updates);
  return await Packer.toBlob(doc);
}

/**
 * Convert to PDF for submission
 */
export async function convertToPdf(
  content: ParsedResumeContent,
  userName: { first: string; last: string }
): Promise<Blob> {
  // Option 1: Generate from HTML template
  const html = renderResumeTemplate(content);
  
  // Render to canvas
  const container = document.createElement('div');
  container.innerHTML = html;
  container.style.width = '816px';  // Letter width at 96dpi
  document.body.appendChild(container);
  
  const canvas = await html2canvas(container, {
    scale: 2,  // Higher quality
    useCORS: true,
  });
  
  document.body.removeChild(container);
  
  // Convert to PDF
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'px',
    format: 'letter',
  });
  
  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  pdf.addImage(imgData, 'JPEG', 0, 0, 816, 1056);
  
  return pdf.output('blob');
}

/**
 * File naming convention
 */
export function getSubmissionFileName(
  firstName: string,
  lastName: string
): string {
  const first = firstName.toUpperCase().replace(/[^A-Z]/g, '');
  const last = lastName.toUpperCase().replace(/[^A-Z]/g, '');
  return `${first}_${last}_RESUME.pdf`;
}
```

### Dependencies to Add

```json
{
  "dependencies": {
    "mammoth": "^1.6.0",
    "docx": "^8.5.0",
    "jspdf": "^2.5.1",
    "html2canvas": "^1.4.1"
  }
}
```

---

## 6. Matching Algorithm Design

### Scoring Pipeline

```
Job Description ──────┐
                      │
                      ▼
              ┌───────────────┐
              │   Tokenize    │
              │  & Normalize  │
              └───────────────┘
                      │
                      ▼
              ┌───────────────┐
Resume ──────▶│   Matcher     │
              │   Engine      │
              └───────────────┘
                      │
        ┌─────────────┼─────────────┬─────────────┐
        ▼             ▼             ▼             ▼
   ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐
   │ Skills  │  │Experience│  │ Industry │  │  Vibes  │
   │ Matcher │  │ Matcher  │  │ Matcher  │  │ (AI)    │
   └─────────┘  └──────────┘  └──────────┘  └─────────┘
        │             │             │             │
        └─────────────┼─────────────┴─────────────┘
                      ▼
              ┌───────────────┐
              │   Weighted    │
              │   Combiner    │
              └───────────────┘
                      │
                      ▼
              ┌───────────────┐
              │  Confidence   │
              │  Calibrator   │
              └───────────────┘
                      │
                      ▼
               MatchResult
```

### Algorithm Implementation

```typescript
// src/lib/matching/index.ts

/**
 * Main matching orchestrator
 */
export async function calculateMatch(
  resume: ParsedResumeContent,
  job: JobDescription,
  options: MatchOptions = {}
): Promise<MatchResult> {
  // 1. Skills matching (deterministic)
  const skillsMatch = matchSkills(resume, job);
  
  // 2. Experience matching (deterministic + heuristics)
  const experienceMatch = matchExperience(resume, job);
  
  // 3. Industry matching (keyword + semantic)
  const industryMatch = matchIndustry(resume, job);
  
  // 4. Vibes (AI-powered, optional)
  const vibesScore = options.includeVibes 
    ? await analyzeVibes(resume, job)
    : { score: 70, reasoning: 'Vibes analysis skipped' };
  
  // 5. Combine with weights
  const weights = {
    skills: 0.35,
    experience: 0.30,
    industry: 0.20,
    vibes: 0.15,
  };
  
  const overallScore = Math.round(
    skillsMatch.score * weights.skills +
    experienceMatch.score * weights.experience +
    industryMatch.score * weights.industry +
    vibesScore.score * weights.vibes
  );
  
  // 6. Calibrate confidence
  const confidenceScore = calculateConfidence(
    skillsMatch,
    experienceMatch,
    industryMatch,
    job
  );
  
  // 7. Generate recommendation
  const recommendation = generateRecommendation(
    overallScore,
    skillsMatch,
    experienceMatch
  );
  
  // 8. Generate suggestions (if needed)
  const suggestions = recommendation.action !== 'use_as_is'
    ? await generateSuggestions(resume, job, { 
        skillsMatch, 
        experienceMatch, 
        industryMatch 
      })
    : [];
  
  return {
    resumeId: '', // Filled by caller
    jobId: job.id,
    overallScore,
    confidenceScore,
    skillsMatch,
    experienceMatch,
    industryMatch,
    vibesScore,
    suggestions,
    recommendation,
    analyzedAt: new Date().toISOString(),
  };
}
```

### Skills Matcher

```typescript
// src/lib/matching/skills.ts

const SKILL_SYNONYMS: Record<string, string[]> = {
  'javascript': ['js', 'es6', 'es2015', 'ecmascript'],
  'typescript': ['ts'],
  'react': ['react.js', 'reactjs'],
  'node': ['node.js', 'nodejs'],
  'python': ['py', 'python3'],
  'postgresql': ['postgres', 'psql'],
  'mongodb': ['mongo'],
  'kubernetes': ['k8s'],
  'amazon web services': ['aws'],
  'google cloud': ['gcp', 'google cloud platform'],
  // ... more mappings
};

export function matchSkills(
  resume: ParsedResumeContent,
  job: JobDescription
): SkillsMatchScore {
  // Flatten and normalize resume skills
  const resumeSkills = new Set(
    resume.skills
      .flatMap(cat => cat.skills)
      .map(normalizeSkill)
  );
  
  // Also extract skills from experience bullets
  const experienceSkills = extractSkillsFromText(
    resume.experiences.flatMap(e => e.bullets).join(' ')
  );
  experienceSkills.forEach(s => resumeSkills.add(s));
  
  // Match required skills
  const matchedRequired: string[] = [];
  const missingRequired: string[] = [];
  
  for (const skill of job.requiredSkills) {
    if (skillMatches(skill, resumeSkills)) {
      matchedRequired.push(skill);
    } else {
      missingRequired.push(skill);
    }
  }
  
  // Match preferred skills
  const matchedPreferred: string[] = [];
  const missingPreferred: string[] = [];
  
  for (const skill of job.preferredSkills) {
    if (skillMatches(skill, resumeSkills)) {
      matchedPreferred.push(skill);
    } else {
      missingPreferred.push(skill);
    }
  }
  
  // Calculate score
  const requiredScore = job.requiredSkills.length > 0
    ? (matchedRequired.length / job.requiredSkills.length) * 100
    : 100;
  
  const preferredScore = job.preferredSkills.length > 0
    ? (matchedPreferred.length / job.preferredSkills.length) * 100
    : 100;
  
  // Required skills weighted more heavily
  const score = Math.round(requiredScore * 0.7 + preferredScore * 0.3);
  
  return {
    score,
    matchedRequired,
    missingRequired,
    matchedPreferred,
    missingPreferred,
  };
}

function normalizeSkill(skill: string): string {
  return skill.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

function skillMatches(skill: string, resumeSkills: Set<string>): boolean {
  const normalized = normalizeSkill(skill);
  
  // Direct match
  if (resumeSkills.has(normalized)) return true;
  
  // Synonym match
  for (const [canonical, synonyms] of Object.entries(SKILL_SYNONYMS)) {
    if (normalized === normalizeSkill(canonical) || 
        synonyms.some(s => normalizeSkill(s) === normalized)) {
      if (resumeSkills.has(normalizeSkill(canonical)) ||
          synonyms.some(s => resumeSkills.has(normalizeSkill(s)))) {
        return true;
      }
    }
  }
  
  return false;
}
```

### Confidence Calibration

```typescript
// src/lib/matching/confidence.ts

/**
 * Confidence indicates how reliable the match score is
 * High confidence = we have good data to make the assessment
 * Low confidence = missing info, unclear requirements
 */
export function calculateConfidence(
  skills: SkillsMatchScore,
  experience: ExperienceMatchScore,
  industry: IndustryMatchScore,
  job: JobDescription
): number {
  let confidence = 100;
  
  // Deduct for missing job requirements
  if (job.requiredSkills.length === 0) {
    confidence -= 15; // Can't assess skills properly
  }
  
  if (!job.yearsExperience) {
    confidence -= 10; // Can't assess experience level
  }
  
  // Deduct for vague job description
  if (job.rawDescription.length < 500) {
    confidence -= 10; // Probably missing details
  }
  
  // Deduct for edge cases in matching
  if (skills.missingRequired.length > 0 && skills.matchedRequired.length > 0) {
    // Partial match - less confident in recommendation
    confidence -= 5;
  }
  
  // Boost for strong signals
  if (experience.relevantRoles.length > 0) {
    confidence += 5; // Clear role alignment
  }
  
  if (industry.domainExperience === 'strong') {
    confidence += 5; // Clear industry fit
  }
  
  return Math.max(0, Math.min(100, confidence));
}
```

### Recommendation Generator

```typescript
// src/lib/matching/recommendation.ts

export function generateRecommendation(
  overallScore: number,
  skills: SkillsMatchScore,
  experience: ExperienceMatchScore
): MatchRecommendation {
  // Use as-is: Great match, no major gaps
  if (overallScore >= 80 && skills.missingRequired.length === 0) {
    return {
      action: 'use_as_is',
      confidence: 90,
    };
  }
  
  // Minor tweaks: Good match with small gaps
  if (overallScore >= 65 && skills.missingRequired.length <= 2) {
    return {
      action: 'make_tweaks',
      confidence: 75,
    };
  }
  
  // Create variant: Moderate match, needs significant changes
  if (overallScore >= 45) {
    return {
      action: 'create_variant',
      confidence: 60,
      suggestedVariantName: generateVariantName(skills, experience),
      requiredChanges: [
        ...skills.missingRequired.map(s => `Add ${s} to skills`),
        ...experience.gaps.slice(0, 2),
      ],
    };
  }
  
  // Skip: Poor match, not worth tailoring
  return {
    action: 'skip',
    confidence: 85,
  };
}

function generateVariantName(
  skills: SkillsMatchScore,
  experience: ExperienceMatchScore
): string {
  // Generate a meaningful variant name
  const topSkill = skills.matchedRequired[0] || skills.matchedPreferred[0];
  const role = experience.relevantRoles[0];
  
  if (topSkill && role) {
    return `${role}_${topSkill}`.toLowerCase().replace(/\s+/g, '_');
  }
  
  return `variant_${Date.now()}`;
}
```

---

## 7. Implementation Order

### Phase 1: Foundation (Week 1)
**Goal: Basic resume storage and file handling**

```
Day 1-2: Data Models & Storage
├── Create resume-types.ts with all interfaces
├── Extend storage.ts with resume methods
├── Set up IndexedDB for file handles
└── Write unit tests for storage

Day 3-4: File System Integration
├── Implement File System Access API wrapper
├── DOCX parsing with mammoth.js
├── Basic structured content extraction
└── File handle persistence

Day 5: Basic UI
├── Add "Resumes" tab to options page
├── ResumeList component
├── ResumeCard component
└── Upload/import flow
```

### Phase 2: Core Features (Week 2)
**Goal: Editing and variant management**

```
Day 1-2: Resume Editor
├── ResumeEditor component
├── Section-by-section editing
├── "Save" and "Save as copy" flows
└── Tag management

Day 3-4: PDF Generation
├── Integrate jspdf + html2canvas
├── Resume HTML template
├── FIRST_LAST_RESUME naming
└── Export flow

Day 5: One-Off Slots
├── OneOffSlots component
├── Slot assignment logic
├── Auto-cleanup old one-offs
└── Quick-pick UI in popup
```

### Phase 3: Matching Engine (Week 3)
**Goal: Job analysis and scoring**

```
Day 1-2: Job Description Parser
├── analyzeJobDescription AI integration
├── Keyword extraction
├── Skill categorization
└── Job cache implementation

Day 3-4: Matching Algorithm
├── Skills matcher
├── Experience matcher
├── Industry matcher
├── Score combination & calibration

Day 5: Match UI
├── MatchScore component
├── ConfidenceBadge component
├── Integration with job page detection
└── Match history storage
```

### Phase 4: AI Suggestions (Week 4)
**Goal: Intelligent tailoring recommendations**

```
Day 1-2: Suggestion Generation
├── Implement generateSuggestions
├── Suggestion prioritization
├── Before/after text generation
└── Vibes analysis

Day 3-4: Suggestion UI
├── SuggestionsList component
├── TailoringPanel component
├── Apply/dismiss flows
└── Human-in-the-loop editing

Day 5: Polish & Integration
├── Content script overlay
├── Full flow testing
├── Performance optimization
└── Error handling
```

### Phase 5: Refinement (Week 5)
**Goal: Production-ready polish**

```
Day 1-2: Edge Cases
├── Large file handling
├── Corrupt DOCX recovery
├── Network failure handling
└── Storage quota management

Day 3-4: UX Polish
├── Loading states
├── Empty states
├── Animations & transitions
└── Accessibility audit

Day 5: Testing & Docs
├── Integration tests
├── User documentation
├── Performance benchmarks
└── Bug bash
```

---

## 8. Open Questions / Future Considerations

1. **Google Sheets Integration**: Mentioned in requirements but deprioritized. Would need Google API integration and auth flow.

2. **Offline Mode**: Current design requires internet for AI features. Could cache more aggressively for offline use.

3. **Resume Templates**: Could offer pre-built templates users can start from.

4. **ATS Optimization**: Could add specific ATS-friendly formatting checks.

5. **Batch Processing**: Analyze multiple jobs at once and rank resumes.

---

## Appendix: File Structure

```
src/
├── lib/
│   ├── types.ts                 # Extended with resume types
│   ├── storage.ts               # Extended with resume storage
│   ├── resume-types.ts          # New: Resume-specific types
│   ├── resume-storage.ts        # New: Resume storage helpers
│   ├── resume-parser.ts         # Extended: DOCX parsing
│   ├── file-conversion.ts       # New: DOCX/PDF conversion
│   ├── file-handles.ts          # New: File System Access API
│   └── matching/
│       ├── index.ts             # Main orchestrator
│       ├── skills.ts            # Skills matcher
│       ├── experience.ts        # Experience matcher
│       ├── industry.ts          # Industry matcher
│       ├── confidence.ts        # Confidence calibration
│       └── recommendation.ts    # Recommendation generator
├── options/
│   └── components/
│       └── resume/              # All resume UI components
├── popup/
│   └── components/
│       └── resume/              # Popup resume components
└── content/
    └── components/
        └── resume/              # Content script components
```
