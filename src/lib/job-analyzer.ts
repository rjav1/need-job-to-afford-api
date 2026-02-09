import { UserProfile } from './types';

/**
 * Job Analyzer - Extracts structured requirements from job descriptions
 */

export interface JobRequirements {
  // Core info
  title: string;
  company: string;
  location: string;
  remote: 'remote' | 'hybrid' | 'onsite' | 'unknown';
  
  // Skills breakdown
  requiredSkills: string[];
  preferredSkills: string[];
  
  // Experience
  minYearsExperience: number;
  maxYearsExperience: number | null;
  experienceLevel: 'entry' | 'mid' | 'senior' | 'lead' | 'executive';
  
  // Education
  requiredEducation: string[];
  preferredEducation: string[];
  
  // Industry context
  industry: string;
  domain: string[];
  
  // Culture / Vibes
  companyValues: string[];
  teamSize: string;
  keywords: string[];
  
  // Raw data
  rawText: string;
  extractedAt: string;
}

// Skill categories for normalization
const SKILL_ALIASES: Record<string, string[]> = {
  'javascript': ['js', 'ecmascript', 'es6', 'es2015'],
  'typescript': ['ts'],
  'python': ['py', 'python3'],
  'react': ['reactjs', 'react.js'],
  'node': ['nodejs', 'node.js'],
  'vue': ['vuejs', 'vue.js'],
  'angular': ['angularjs', 'angular.js'],
  'machine learning': ['ml', 'deep learning', 'dl'],
  'artificial intelligence': ['ai'],
  'amazon web services': ['aws'],
  'google cloud platform': ['gcp', 'google cloud'],
  'microsoft azure': ['azure'],
  'kubernetes': ['k8s'],
  'docker': ['containers', 'containerization'],
  'postgresql': ['postgres', 'psql'],
  'mongodb': ['mongo'],
  'graphql': ['gql'],
  'rest api': ['restful', 'rest apis'],
  'ci/cd': ['cicd', 'continuous integration', 'continuous deployment'],
  'sql': ['structured query language'],
};

// Common tech skills to look for
const TECH_SKILLS = [
  // Languages
  'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'go', 'rust', 'ruby', 'php', 'swift', 'kotlin', 'scala',
  // Frontend
  'react', 'vue', 'angular', 'svelte', 'next.js', 'nuxt', 'html', 'css', 'sass', 'tailwind',
  // Backend
  'node', 'express', 'django', 'flask', 'fastapi', 'spring', 'rails', '.net',
  // Databases
  'sql', 'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'dynamodb', 'cassandra',
  // Cloud & DevOps
  'aws', 'gcp', 'azure', 'docker', 'kubernetes', 'terraform', 'jenkins', 'github actions', 'ci/cd',
  // Data & ML
  'machine learning', 'deep learning', 'tensorflow', 'pytorch', 'pandas', 'numpy', 'spark', 'hadoop',
  // Other
  'graphql', 'rest api', 'microservices', 'git', 'agile', 'scrum', 'jira',
];

// Soft skills to detect
const SOFT_SKILLS = [
  'communication', 'leadership', 'teamwork', 'problem-solving', 'analytical',
  'collaboration', 'initiative', 'adaptability', 'creativity', 'attention to detail',
  'time management', 'mentoring', 'presentation', 'critical thinking',
];

// Experience level patterns
const EXPERIENCE_PATTERNS = {
  entry: /(?:entry.?level|junior|new grad|0-2 years|1-2 years|intern|graduate)/i,
  mid: /(?:mid.?level|intermediate|3-5 years|2-4 years|4-6 years)/i,
  senior: /(?:senior|sr\.?|5\+ years|6\+ years|7\+ years|experienced)/i,
  lead: /(?:lead|principal|staff|8\+ years|10\+ years)/i,
  executive: /(?:director|vp|vice president|chief|head of|c-level)/i,
};

// Industry patterns
const INDUSTRY_PATTERNS: Record<string, RegExp> = {
  'fintech': /fintech|financial|banking|payments|trading|investment/i,
  'healthcare': /healthcare|health tech|medical|biotech|pharma/i,
  'e-commerce': /e-?commerce|retail|marketplace|shopping/i,
  'saas': /saas|b2b|enterprise software/i,
  'consumer': /consumer|b2c|social|entertainment|gaming/i,
  'edtech': /edtech|education|learning|training/i,
  'security': /security|cybersecurity|infosec/i,
  'ai/ml': /artificial intelligence|machine learning|ai\/ml|data science/i,
  'devtools': /developer tools|devtools|infrastructure|platform/i,
  'logistics': /logistics|supply chain|shipping|transportation/i,
};

/**
 * Extract job requirements from a job description
 */
export function analyzeJobDescription(jobText: string): JobRequirements {
  const text = jobText.toLowerCase();
  const lines = jobText.split('\n').map(l => l.trim()).filter(Boolean);
  
  return {
    title: extractJobTitle(lines),
    company: extractCompany(lines),
    location: extractLocation(text),
    remote: extractRemoteStatus(text),
    requiredSkills: extractSkills(text, true),
    preferredSkills: extractSkills(text, false),
    minYearsExperience: extractMinExperience(text),
    maxYearsExperience: extractMaxExperience(text),
    experienceLevel: extractExperienceLevel(text),
    requiredEducation: extractEducation(text, true),
    preferredEducation: extractEducation(text, false),
    industry: extractIndustry(text),
    domain: extractDomains(text),
    companyValues: extractValues(text),
    teamSize: extractTeamSize(text),
    keywords: extractKeywords(text),
    rawText: jobText,
    extractedAt: new Date().toISOString(),
  };
}

function extractJobTitle(lines: string[]): string {
  // First non-empty line is often the title
  for (const line of lines.slice(0, 5)) {
    // Skip company names and locations
    if (line.length > 10 && line.length < 80 && 
        !line.includes('@') && 
        !line.match(/^\d/) &&
        !line.toLowerCase().includes('apply')) {
      return line;
    }
  }
  return 'Unknown Position';
}

function extractCompany(lines: string[]): string {
  // Look for "at [Company]" or company indicators
  for (const line of lines.slice(0, 10)) {
    const atMatch = line.match(/at\s+([A-Z][A-Za-z0-9\s]+?)(?:\s*[-–|]|$)/);
    if (atMatch) return atMatch[1].trim();
    
    const companyMatch = line.match(/^([A-Z][A-Za-z0-9\s]+?)\s+(?:is hiring|is looking|seeks)/i);
    if (companyMatch) return companyMatch[1].trim();
  }
  return 'Unknown Company';
}

function extractLocation(text: string): string {
  // Common location patterns
  const patterns = [
    /(?:location|based in|office in)[:\s]+([A-Za-z\s,]+?)(?:\.|$|\n)/i,
    /(?:San Francisco|New York|Seattle|Austin|Boston|Chicago|Los Angeles|Denver|Miami|Atlanta|Portland)[,\s]+(?:CA|NY|WA|TX|MA|IL|CO|FL|GA|OR)/i,
    /(?:Remote|Hybrid|On-?site)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[0].trim();
  }
  return 'Not specified';
}

function extractRemoteStatus(text: string): 'remote' | 'hybrid' | 'onsite' | 'unknown' {
  if (/fully remote|100% remote|remote.?first|work from anywhere/i.test(text)) return 'remote';
  if (/hybrid|flexible.?location|mix of remote/i.test(text)) return 'hybrid';
  if (/on.?site|in.?office|office.?based|in.?person/i.test(text)) return 'onsite';
  if (/remote/i.test(text)) return 'remote';
  return 'unknown';
}

function extractSkills(text: string, required: boolean): string[] {
  const skills: Set<string> = new Set();
  
  // Determine which section to focus on
  const requiredSection = text.match(/(?:required|must have|requirements|qualifications)[:\s]*([\s\S]*?)(?:preferred|nice to have|bonus|about us|$)/i);
  const preferredSection = text.match(/(?:preferred|nice to have|bonus|plus)[:\s]*([\s\S]*?)(?:about us|benefits|apply|$)/i);
  
  const searchText = required 
    ? (requiredSection?.[1] || text)
    : (preferredSection?.[1] || '');
  
  // Find tech skills
  for (const skill of TECH_SKILLS) {
    const normalizedText = normalizeSkill(searchText);
    if (normalizedText.includes(skill) || hasAlias(searchText, skill)) {
      skills.add(skill);
    }
  }
  
  // Find soft skills (usually required)
  if (required) {
    for (const skill of SOFT_SKILLS) {
      if (searchText.includes(skill)) {
        skills.add(skill);
      }
    }
  }
  
  return Array.from(skills);
}

function normalizeSkill(text: string): string {
  let normalized = text.toLowerCase();
  for (const [canonical, aliases] of Object.entries(SKILL_ALIASES)) {
    for (const alias of aliases) {
      normalized = normalized.replace(new RegExp(`\\b${alias}\\b`, 'gi'), canonical);
    }
  }
  return normalized;
}

function hasAlias(text: string, skill: string): boolean {
  const aliases = SKILL_ALIASES[skill] || [];
  const lowerText = text.toLowerCase();
  return aliases.some(alias => lowerText.includes(alias));
}

function extractMinExperience(text: string): number {
  // Look for patterns like "3+ years", "3-5 years", "minimum 3 years"
  const patterns = [
    /(\d+)\+?\s*years?\s*(?:of\s+)?(?:experience|exp)/i,
    /(?:minimum|at least|min)\s*(\d+)\s*years?/i,
    /(\d+)\s*-\s*\d+\s*years?/i,
  ];
  
  let minYears = 0;
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const years = parseInt(match[1]);
      if (years > minYears && years < 20) {
        minYears = years;
      }
    }
  }
  return minYears;
}

function extractMaxExperience(text: string): number | null {
  const match = text.match(/(\d+)\s*-\s*(\d+)\s*years?/i);
  if (match) {
    return parseInt(match[2]);
  }
  return null;
}

function extractExperienceLevel(text: string): 'entry' | 'mid' | 'senior' | 'lead' | 'executive' {
  for (const [level, pattern] of Object.entries(EXPERIENCE_PATTERNS)) {
    if (pattern.test(text)) {
      return level as 'entry' | 'mid' | 'senior' | 'lead' | 'executive';
    }
  }
  
  // Infer from years
  const minExp = extractMinExperience(text);
  if (minExp >= 10) return 'lead';
  if (minExp >= 5) return 'senior';
  if (minExp >= 2) return 'mid';
  return 'entry';
}

function extractEducation(text: string, required: boolean): string[] {
  const education: string[] = [];
  
  const patterns = [
    /(?:bachelor'?s?|b\.?s\.?|b\.?a\.?)\s*(?:degree)?\s*(?:in)?\s*([a-z\s]+)?/gi,
    /(?:master'?s?|m\.?s\.?|m\.?a\.?|mba)\s*(?:degree)?\s*(?:in)?\s*([a-z\s]+)?/gi,
    /(?:ph\.?d\.?|doctorate)\s*(?:in)?\s*([a-z\s]+)?/gi,
    /computer science|software engineering|data science|mathematics|statistics|physics/gi,
  ];
  
  for (const pattern of patterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      education.push(match[0].trim());
    }
  }
  
  // Check if education is required or preferred
  const requiredSection = /required|must have/i.test(text.slice(0, text.indexOf(education[0] || '')));
  
  if (required && !requiredSection && education.length > 0) {
    return [];
  }
  
  return [...new Set(education)];
}

function extractIndustry(text: string): string {
  for (const [industry, pattern] of Object.entries(INDUSTRY_PATTERNS)) {
    if (pattern.test(text)) {
      return industry;
    }
  }
  return 'technology';
}

function extractDomains(text: string): string[] {
  const domains: string[] = [];
  const domainPatterns = [
    /(?:api|backend|frontend|full.?stack|mobile|web|cloud|data|ml|devops|security|infrastructure)/gi,
  ];
  
  for (const pattern of domainPatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      domains.push(match[0].toLowerCase());
    }
  }
  
  return [...new Set(domains)];
}

function extractValues(text: string): string[] {
  const values: string[] = [];
  const valuePatterns = [
    /(?:we value|we believe in|our values|culture)[:\s]*([^.]+)/gi,
    /(?:diversity|inclusion|innovation|collaboration|transparency|growth|learning)/gi,
  ];
  
  for (const pattern of valuePatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      values.push(match[0].toLowerCase().trim());
    }
  }
  
  return [...new Set(values)].slice(0, 5);
}

function extractTeamSize(text: string): string {
  const match = text.match(/(?:team of|team size)[:\s]*(\d+[-\s]?\d*)/i);
  if (match) return match[1];
  
  if (/startup|small team|early.?stage/i.test(text)) return 'small';
  if (/large|enterprise|established/i.test(text)) return 'large';
  return 'unknown';
}

function extractKeywords(text: string): string[] {
  // Extract important repeated words (potential keywords)
  const words = text.toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 4);
  
  const wordCounts: Record<string, number> = {};
  for (const word of words) {
    wordCounts[word] = (wordCounts[word] || 0) + 1;
  }
  
  // Filter common words
  const stopWords = new Set(['about', 'their', 'there', 'where', 'which', 'would', 'could', 'should', 'these', 'those', 'other', 'being']);
  
  return Object.entries(wordCounts)
    .filter(([word, count]) => count >= 2 && !stopWords.has(word))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word]) => word);
}

/**
 * Generate AI prompt for deep job analysis
 */
export function buildJobAnalysisPrompt(jobText: string): string {
  return `Analyze this job description and extract structured requirements. Be thorough but concise.

JOB DESCRIPTION:
${jobText}

Extract the following in JSON format:
{
  "title": "exact job title",
  "company": "company name",
  "requiredSkills": ["list of must-have technical skills"],
  "preferredSkills": ["nice-to-have skills"],
  "minYearsExperience": number,
  "experienceLevel": "entry|mid|senior|lead",
  "education": ["required education"],
  "industry": "primary industry",
  "keyResponsibilities": ["top 3-5 responsibilities"],
  "cultureSignals": ["what the company values"],
  "redFlags": ["any concerning patterns"],
  "idealCandidate": "brief description of who would thrive"
}

Return only valid JSON, no explanation.`;
}

/**
 * Compare resume to job requirements for quick compatibility check
 */
export function quickCompatibilityCheck(profile: UserProfile, job: JobRequirements): {
  compatible: boolean;
  matchingSkills: string[];
  missingSkills: string[];
  experienceMatch: boolean;
} {
  const profileSkills = new Set(profile.skills.map(s => s.toLowerCase()));
  const requiredSkills = new Set(job.requiredSkills.map(s => s.toLowerCase()));
  
  const matchingSkills = [...requiredSkills].filter(s => 
    profileSkills.has(s) || hasAlias(profile.skills.join(' '), s)
  );
  const missingSkills = [...requiredSkills].filter(s => !matchingSkills.includes(s));
  
  const yearsExp = parseInt(profile.yearsOfExperience) || 0;
  const experienceMatch = yearsExp >= job.minYearsExperience;
  
  const skillMatchRatio = matchingSkills.length / Math.max(requiredSkills.size, 1);
  const compatible = skillMatchRatio >= 0.5 && (experienceMatch || job.minYearsExperience <= 2);
  
  return {
    compatible,
    matchingSkills,
    missingSkills,
    experienceMatch,
  };
}
