import { UserProfile } from './types';
import { JobRequirements, analyzeJobDescription, quickCompatibilityCheck } from './job-analyzer';

/**
 * Resume Matcher - AI-powered resume to job matching with scoring
 * 
 * Scoring weights:
 * - Skills: 35%
 * - Experience: 30%
 * - Industry: 20%
 * - Vibes (culture fit): 15%
 */

// Scoring weights
const WEIGHTS = {
  skills: 0.35,
  experience: 0.30,
  industry: 0.20,
  vibes: 0.15,
};

export type RecommendationType = 'use_as_is' | 'make_tweaks' | 'create_variant';

export interface MatchScore {
  overall: number;  // 0-100
  confidence: number;  // 0-1 confidence in our scoring
  breakdown: {
    skills: number;
    experience: number;
    industry: number;
    vibes: number;
  };
  details: ScoreDetails;
}

export interface ScoreDetails {
  matchingSkills: string[];
  missingSkills: string[];
  bonusSkills: string[];  // Preferred skills the candidate has
  experienceGap: number;  // positive = overqualified, negative = underqualified
  industryMatch: boolean;
  cultureFit: string[];  // Matching cultural signals
}

export interface MatchResult {
  score: MatchScore;
  recommendation: RecommendationType;
  summary: string;  // Medium-length summary
  suggestions: Suggestion[];
  resumeStrengths: string[];
  resumeWeaknesses: string[];
}

export interface Suggestion {
  type: 'add' | 'remove' | 'reword' | 'highlight' | 'reorder';
  section: 'skills' | 'experience' | 'summary' | 'projects' | 'education' | 'general';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  example?: string;
}

export interface FeedbackData {
  matchId: string;
  jobUrl: string;
  originalScore: number;
  userAction: 'applied' | 'skipped' | 'edited';
  outcome?: 'interview' | 'rejected' | 'offer' | 'unknown';
  manualEdits?: string[];
  timestamp: string;
}

// Store feedback for learning
const feedbackStore: FeedbackData[] = [];

/**
 * Main matching function - analyzes resume against job description
 */
export function matchResumeToJob(
  profile: UserProfile,
  jobDescription: string
): MatchResult {
  // Analyze the job description
  const jobReqs = analyzeJobDescription(jobDescription);
  
  // Calculate individual scores
  const skillsScore = calculateSkillsScore(profile, jobReqs);
  const experienceScore = calculateExperienceScore(profile, jobReqs);
  const industryScore = calculateIndustryScore(profile, jobReqs);
  const vibesScore = calculateVibesScore(profile, jobReqs);
  
  // Calculate weighted overall score
  const overall = Math.round(
    skillsScore.score * WEIGHTS.skills +
    experienceScore.score * WEIGHTS.experience +
    industryScore.score * WEIGHTS.industry +
    vibesScore.score * WEIGHTS.vibes
  );
  
  // Calculate confidence based on data quality
  const confidence = calculateConfidence(profile, jobReqs);
  
  const score: MatchScore = {
    overall,
    confidence,
    breakdown: {
      skills: skillsScore.score,
      experience: experienceScore.score,
      industry: industryScore.score,
      vibes: vibesScore.score,
    },
    details: {
      matchingSkills: skillsScore.matching,
      missingSkills: skillsScore.missing,
      bonusSkills: skillsScore.bonus,
      experienceGap: experienceScore.gap,
      industryMatch: industryScore.match,
      cultureFit: vibesScore.matchingValues,
    },
  };
  
  // Generate recommendation
  const recommendation = generateRecommendation(score, profile);
  
  // Generate suggestions
  const suggestions = generateSuggestions(profile, jobReqs, score);
  
  // Identify strengths and weaknesses
  const { strengths, weaknesses } = analyzeResumeQuality(profile, jobReqs, score);
  
  // Generate summary
  const summary = generateSummary(score, recommendation, jobReqs);
  
  return {
    score,
    recommendation,
    summary,
    suggestions,
    resumeStrengths: strengths,
    resumeWeaknesses: weaknesses,
  };
}

/**
 * Calculate skills match score (0-100)
 */
function calculateSkillsScore(profile: UserProfile, job: JobRequirements): {
  score: number;
  matching: string[];
  missing: string[];
  bonus: string[];
} {
  const profileSkills = normalizeSkills(profile.skills);
  const requiredSkills = normalizeSkills(job.requiredSkills);
  const preferredSkills = normalizeSkills(job.preferredSkills);
  
  // Calculate required skills match
  const matching: string[] = [];
  const missing: string[] = [];
  
  for (const skill of requiredSkills) {
    if (hasSkillMatch(profileSkills, skill)) {
      matching.push(skill);
    } else {
      missing.push(skill);
    }
  }
  
  // Calculate bonus points for preferred skills
  const bonus: string[] = [];
  for (const skill of preferredSkills) {
    if (hasSkillMatch(profileSkills, skill) && !matching.includes(skill)) {
      bonus.push(skill);
    }
  }
  
  // Score calculation
  const requiredMatchRatio = requiredSkills.length > 0 
    ? matching.length / requiredSkills.length 
    : 1;
  
  const bonusPoints = preferredSkills.length > 0
    ? (bonus.length / preferredSkills.length) * 10  // Up to 10 bonus points
    : 0;
  
  const baseScore = requiredMatchRatio * 90;  // Up to 90 for required skills
  const score = Math.min(100, Math.round(baseScore + bonusPoints));
  
  return { score, matching, missing, bonus };
}

/**
 * Calculate experience match score (0-100)
 */
function calculateExperienceScore(profile: UserProfile, job: JobRequirements): {
  score: number;
  gap: number;
} {
  const profileYears = parseInt(profile.yearsOfExperience) || 0;
  const minRequired = job.minYearsExperience;
  const maxRequired = job.maxYearsExperience;
  
  // Calculate gap (positive = overqualified, negative = underqualified)
  const gap = profileYears - minRequired;
  
  let score: number;
  
  if (profileYears >= minRequired) {
    // Meets or exceeds requirement
    if (maxRequired && profileYears > maxRequired + 3) {
      // Significantly overqualified (might be seen as flight risk)
      score = 70;
    } else if (maxRequired && profileYears > maxRequired) {
      // Slightly overqualified
      score = 85;
    } else {
      // Perfect match
      score = 100;
    }
  } else {
    // Underqualified
    const shortfall = minRequired - profileYears;
    if (shortfall <= 1) {
      // Close enough, might still be considered
      score = 75;
    } else if (shortfall <= 2) {
      // Slightly under, compensate with skills
      score = 50;
    } else {
      // Significantly under
      score = Math.max(20, 50 - (shortfall * 10));
    }
  }
  
  return { score, gap };
}

/**
 * Calculate industry match score (0-100)
 */
function calculateIndustryScore(profile: UserProfile, job: JobRequirements): {
  score: number;
  match: boolean;
} {
  // Extract industry signals from profile
  const profileIndustries = extractIndustriesFromProfile(profile);
  
  // Direct industry match
  if (profileIndustries.includes(job.industry)) {
    return { score: 100, match: true };
  }
  
  // Related industry (e.g., fintech experience for finance job)
  const relatedIndustries = getRelatedIndustries(job.industry);
  const hasRelated = profileIndustries.some(i => relatedIndustries.includes(i));
  if (hasRelated) {
    return { score: 75, match: false };
  }
  
  // Domain overlap (e.g., backend experience regardless of industry)
  const profileDomains = extractDomainsFromProfile(profile);
  const domainOverlap = job.domain.filter(d => profileDomains.includes(d));
  if (domainOverlap.length > 0) {
    const overlapRatio = domainOverlap.length / Math.max(job.domain.length, 1);
    return { score: Math.round(50 + overlapRatio * 30), match: false };
  }
  
  // No clear match - still give base points for transferable skills
  return { score: 40, match: false };
}

/**
 * Calculate vibes/culture fit score (0-100)
 */
function calculateVibesScore(profile: UserProfile, job: JobRequirements): {
  score: number;
  matchingValues: string[];
} {
  const matchingValues: string[] = [];
  
  // Extract signals from profile (projects, descriptions, etc.)
  const profileSignals = extractCultureSignals(profile);
  
  // Check for value alignment
  for (const value of job.companyValues) {
    if (profileSignals.some(s => s.includes(value) || value.includes(s))) {
      matchingValues.push(value);
    }
  }
  
  // Check for keyword alignment
  const profileKeywords = extractKeywordsFromProfile(profile);
  const keywordOverlap = job.keywords.filter(k => 
    profileKeywords.some(pk => pk.includes(k) || k.includes(pk))
  );
  
  // Score based on alignment
  const valueScore = job.companyValues.length > 0
    ? (matchingValues.length / job.companyValues.length) * 50
    : 50;
  
  const keywordScore = job.keywords.length > 0
    ? (keywordOverlap.length / job.keywords.length) * 50
    : 50;
  
  const score = Math.round(valueScore + keywordScore);
  
  return { score, matchingValues };
}

/**
 * Calculate confidence in our scoring
 */
function calculateConfidence(profile: UserProfile, job: JobRequirements): number {
  let confidence = 0.5;  // Base confidence
  
  // More data = higher confidence
  if (profile.skills.length >= 5) confidence += 0.1;
  if (profile.projects.length >= 2) confidence += 0.1;
  if (profile.resumeText.length > 500) confidence += 0.1;
  if (job.requiredSkills.length >= 3) confidence += 0.1;
  if (job.rawText.length > 500) confidence += 0.1;
  
  return Math.min(0.95, confidence);
}

/**
 * Generate recommendation based on score
 */
function generateRecommendation(score: MatchScore, profile: UserProfile): RecommendationType {
  const { overall, breakdown } = score;
  
  // High match - use as is
  if (overall >= 80 && breakdown.skills >= 75) {
    return 'use_as_is';
  }
  
  // Decent match but could improve
  if (overall >= 60 || (overall >= 50 && breakdown.skills >= 70)) {
    return 'make_tweaks';
  }
  
  // Low match - create targeted variant
  return 'create_variant';
}

/**
 * Generate actionable suggestions
 */
function generateSuggestions(
  profile: UserProfile,
  job: JobRequirements,
  score: MatchScore
): Suggestion[] {
  const suggestions: Suggestion[] = [];
  
  // Missing skills suggestions
  for (const skill of score.details.missingSkills.slice(0, 3)) {
    // Check if user actually has related skills
    const hasRelated = profile.skills.some(s => 
      isRelatedSkill(s.toLowerCase(), skill.toLowerCase())
    );
    
    if (hasRelated) {
      suggestions.push({
        type: 'reword',
        section: 'skills',
        priority: 'high',
        title: `Highlight "${skill}" experience`,
        description: `The job requires "${skill}". You have related skills - make sure to mention any ${skill} experience explicitly.`,
        example: `Add "${skill}" to your skills section if you have any exposure to it.`,
      });
    } else {
      suggestions.push({
        type: 'add',
        section: 'skills',
        priority: 'medium',
        title: `Consider learning ${skill}`,
        description: `"${skill}" is a required skill. If you have any experience, add it. If not, consider quick tutorials to gain basic familiarity.`,
      });
    }
  }
  
  // Experience gap suggestions
  if (score.details.experienceGap < 0) {
    suggestions.push({
      type: 'highlight',
      section: 'experience',
      priority: 'high',
      title: 'Emphasize impact over years',
      description: `You're ${Math.abs(score.details.experienceGap)} years below the requirement. Focus on concrete achievements and impact rather than duration.`,
      example: 'Instead of "Worked on X project", say "Led development of X, reducing load time by 40%"',
    });
  }
  
  // Industry mismatch suggestions
  if (!score.details.industryMatch && score.breakdown.industry < 70) {
    suggestions.push({
      type: 'reword',
      section: 'summary',
      priority: 'medium',
      title: `Tailor for ${job.industry} industry`,
      description: `Highlight any experience relevant to ${job.industry}. Even tangential experience counts.`,
      example: `If applying to fintech, mention any projects involving payments, data security, or financial calculations.`,
    });
  }
  
  // Projects suggestions
  if (profile.projects.length === 0) {
    suggestions.push({
      type: 'add',
      section: 'projects',
      priority: 'high',
      title: 'Add relevant projects',
      description: 'Including 2-3 relevant projects significantly improves your chances. Even personal or academic projects count.',
    });
  } else if (profile.projects.length < 3) {
    const relevantTech = job.requiredSkills.filter(s => 
      !profile.projects.some(p => p.technologies.map(t => t.toLowerCase()).includes(s))
    );
    if (relevantTech.length > 0) {
      suggestions.push({
        type: 'add',
        section: 'projects',
        priority: 'medium',
        title: `Add projects using ${relevantTech.slice(0, 2).join(', ')}`,
        description: 'Projects demonstrating required technologies give concrete proof of your skills.',
      });
    }
  }
  
  // Skills ordering
  if (score.details.matchingSkills.length > 0) {
    const profileSkillsLower = profile.skills.map(s => s.toLowerCase());
    const firstMatchIndex = profileSkillsLower.findIndex(s => 
      score.details.matchingSkills.map(m => m.toLowerCase()).includes(s)
    );
    
    if (firstMatchIndex > 2) {
      suggestions.push({
        type: 'reorder',
        section: 'skills',
        priority: 'low',
        title: 'Reorder skills for relevance',
        description: 'Move the most relevant skills to the top. Recruiters often skim the first few items.',
        example: `Put ${score.details.matchingSkills.slice(0, 3).join(', ')} at the beginning.`,
      });
    }
  }
  
  // Culture fit suggestions
  if (score.breakdown.vibes < 60 && job.companyValues.length > 0) {
    suggestions.push({
      type: 'add',
      section: 'general',
      priority: 'low',
      title: 'Align with company values',
      description: `The company values: ${job.companyValues.join(', ')}. Consider mentioning relevant experiences or values in your summary.`,
    });
  }
  
  return suggestions.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

/**
 * Analyze resume strengths and weaknesses for this job
 */
function analyzeResumeQuality(
  profile: UserProfile,
  job: JobRequirements,
  score: MatchScore
): { strengths: string[]; weaknesses: string[] } {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  
  // Skills assessment
  if (score.breakdown.skills >= 80) {
    strengths.push(`Strong skill match (${score.details.matchingSkills.length} of ${job.requiredSkills.length} required skills)`);
  } else if (score.breakdown.skills < 50) {
    weaknesses.push(`Missing key skills: ${score.details.missingSkills.slice(0, 3).join(', ')}`);
  }
  
  // Bonus skills
  if (score.details.bonusSkills.length > 0) {
    strengths.push(`Has preferred skills: ${score.details.bonusSkills.join(', ')}`);
  }
  
  // Experience assessment
  if (score.details.experienceGap >= 0 && score.details.experienceGap <= 2) {
    strengths.push('Experience level is a good fit');
  } else if (score.details.experienceGap < 0) {
    weaknesses.push(`${Math.abs(score.details.experienceGap)} years below experience requirement`);
  } else if (score.details.experienceGap > 3) {
    weaknesses.push('May appear overqualified');
  }
  
  // Industry
  if (score.details.industryMatch) {
    strengths.push(`Direct ${job.industry} industry experience`);
  } else if (score.breakdown.industry < 50) {
    weaknesses.push(`No clear ${job.industry} industry experience`);
  }
  
  // Projects
  if (profile.projects.length >= 3) {
    strengths.push('Strong project portfolio');
  } else if (profile.projects.length === 0) {
    weaknesses.push('No projects listed');
  }
  
  // Education
  if (job.requiredEducation.length > 0) {
    const hasEducation = job.requiredEducation.some(e => 
      profile.degree.toLowerCase().includes(e.toLowerCase()) ||
      profile.major.toLowerCase().includes(e.toLowerCase())
    );
    if (hasEducation) {
      strengths.push('Education meets requirements');
    }
  }
  
  return { strengths, weaknesses };
}

/**
 * Generate human-readable summary
 */
function generateSummary(
  score: MatchScore,
  recommendation: RecommendationType,
  job: JobRequirements
): string {
  const { overall, breakdown, details } = score;
  
  let summary = '';
  
  // Overall assessment
  if (overall >= 80) {
    summary = `Excellent match (${overall}%)! Your profile aligns very well with this ${job.title} position.`;
  } else if (overall >= 65) {
    summary = `Good match (${overall}%). You meet most requirements for this ${job.title} role.`;
  } else if (overall >= 50) {
    summary = `Moderate match (${overall}%). Some gaps exist, but you could be competitive with adjustments.`;
  } else {
    summary = `Low match (${overall}%). Significant gaps between your profile and this ${job.title} role.`;
  }
  
  // Key points
  const points: string[] = [];
  
  if (details.matchingSkills.length > 0) {
    points.push(`You match ${details.matchingSkills.length} of ${job.requiredSkills.length} required skills`);
  }
  
  if (details.missingSkills.length > 0 && details.missingSkills.length <= 3) {
    points.push(`Missing: ${details.missingSkills.join(', ')}`);
  }
  
  if (details.experienceGap !== 0) {
    if (details.experienceGap > 0) {
      points.push(`${details.experienceGap}+ years above minimum experience`);
    } else {
      points.push(`${Math.abs(details.experienceGap)} years below minimum experience`);
    }
  }
  
  if (points.length > 0) {
    summary += ' ' + points.join('. ') + '.';
  }
  
  // Recommendation
  switch (recommendation) {
    case 'use_as_is':
      summary += ' Recommendation: Apply with your current resume.';
      break;
    case 'make_tweaks':
      summary += ' Recommendation: Make small adjustments to highlight relevant experience.';
      break;
    case 'create_variant':
      summary += ' Recommendation: Consider creating a tailored version for this role.';
      break;
  }
  
  return summary;
}

// ============ Helper Functions ============

function normalizeSkills(skills: string[]): string[] {
  return skills.map(s => s.toLowerCase().trim());
}

function hasSkillMatch(profileSkills: string[], requiredSkill: string): boolean {
  const required = requiredSkill.toLowerCase();
  
  // Direct match
  if (profileSkills.includes(required)) return true;
  
  // Partial match (e.g., "react" matches "react.js")
  if (profileSkills.some(s => s.includes(required) || required.includes(s))) return true;
  
  // Check aliases
  return profileSkills.some(s => isRelatedSkill(s, required));
}

function isRelatedSkill(skill1: string, skill2: string): boolean {
  const relatedGroups = [
    ['javascript', 'typescript', 'js', 'ts'],
    ['react', 'react.js', 'reactjs'],
    ['node', 'node.js', 'nodejs'],
    ['python', 'django', 'flask', 'fastapi'],
    ['sql', 'postgresql', 'mysql', 'sqlite'],
    ['aws', 'amazon web services', 'cloud'],
    ['docker', 'kubernetes', 'k8s', 'containers'],
    ['machine learning', 'ml', 'deep learning', 'ai'],
  ];
  
  for (const group of relatedGroups) {
    if (group.includes(skill1) && group.includes(skill2)) {
      return true;
    }
  }
  
  return false;
}

function extractIndustriesFromProfile(profile: UserProfile): string[] {
  const industries: string[] = [];
  const text = [
    profile.resumeText,
    ...profile.projects.map(p => p.description),
  ].join(' ').toLowerCase();
  
  const industryKeywords: Record<string, string[]> = {
    'fintech': ['finance', 'banking', 'payments', 'trading'],
    'healthcare': ['health', 'medical', 'patient', 'clinical'],
    'e-commerce': ['commerce', 'retail', 'shopping', 'marketplace'],
    'saas': ['saas', 'b2b', 'enterprise'],
    'edtech': ['education', 'learning', 'students', 'courses'],
  };
  
  for (const [industry, keywords] of Object.entries(industryKeywords)) {
    if (keywords.some(k => text.includes(k))) {
      industries.push(industry);
    }
  }
  
  return industries;
}

function getRelatedIndustries(industry: string): string[] {
  const relatedMap: Record<string, string[]> = {
    'fintech': ['saas', 'e-commerce'],
    'healthcare': ['saas', 'ai/ml'],
    'e-commerce': ['fintech', 'saas', 'consumer'],
    'saas': ['fintech', 'devtools', 'e-commerce'],
    'ai/ml': ['healthcare', 'fintech', 'devtools'],
  };
  
  return relatedMap[industry] || [];
}

function extractDomainsFromProfile(profile: UserProfile): string[] {
  const domains: string[] = [];
  const text = [
    profile.resumeText,
    profile.skills.join(' '),
    ...profile.projects.map(p => p.technologies.join(' ')),
  ].join(' ').toLowerCase();
  
  const domainKeywords: Record<string, string[]> = {
    'frontend': ['react', 'vue', 'angular', 'css', 'html', 'ui', 'ux'],
    'backend': ['api', 'server', 'database', 'node', 'python', 'java'],
    'fullstack': ['full stack', 'full-stack', 'fullstack'],
    'mobile': ['ios', 'android', 'react native', 'flutter'],
    'data': ['data', 'analytics', 'sql', 'etl', 'pipeline'],
    'ml': ['machine learning', 'ml', 'tensorflow', 'pytorch'],
    'devops': ['devops', 'ci/cd', 'docker', 'kubernetes', 'aws'],
    'security': ['security', 'authentication', 'encryption'],
  };
  
  for (const [domain, keywords] of Object.entries(domainKeywords)) {
    if (keywords.some(k => text.includes(k))) {
      domains.push(domain);
    }
  }
  
  return domains;
}

function extractCultureSignals(profile: UserProfile): string[] {
  const signals: string[] = [];
  const text = [
    profile.resumeText,
    ...profile.projects.map(p => p.description),
    ...profile.projects.flatMap(p => p.highlights),
  ].join(' ').toLowerCase();
  
  const cultureKeywords = [
    'collaboration', 'team', 'leadership', 'mentor', 'innovation',
    'open source', 'community', 'agile', 'startup', 'diversity',
    'remote', 'async', 'communication', 'initiative', 'ownership',
  ];
  
  for (const keyword of cultureKeywords) {
    if (text.includes(keyword)) {
      signals.push(keyword);
    }
  }
  
  return signals;
}

function extractKeywordsFromProfile(profile: UserProfile): string[] {
  const text = [
    profile.resumeText,
    profile.skills.join(' '),
    ...profile.projects.map(p => p.description),
  ].join(' ').toLowerCase();
  
  const words = text.split(/\s+/).filter(w => w.length > 4);
  const wordCounts: Record<string, number> = {};
  
  for (const word of words) {
    wordCounts[word] = (wordCounts[word] || 0) + 1;
  }
  
  return Object.entries(wordCounts)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word]) => word);
}

// ============ AI Prompts ============

/**
 * Build prompt for AI-enhanced matching analysis
 */
export function buildMatchingPrompt(profile: UserProfile, jobDescription: string): string {
  const skillsList = profile.skills.join(', ');
  const projectsList = profile.projects
    .map(p => `- ${p.name}: ${p.description} (${p.technologies.join(', ')})`)
    .join('\n');
  
  return `You are an expert resume reviewer and job matching specialist. Analyze how well this candidate matches the job.

CANDIDATE PROFILE:
- Name: ${profile.firstName} ${profile.lastName}
- Education: ${profile.degree} in ${profile.major} from ${profile.university}
- Experience: ${profile.yearsOfExperience || '0'} years
- Skills: ${skillsList}
- Projects:
${projectsList}

Resume Summary:
${profile.resumeText.slice(0, 1000)}

JOB DESCRIPTION:
${jobDescription}

Provide your analysis in JSON format:
{
  "overallMatch": <0-100>,
  "confidence": <0-1>,
  "skillsAnalysis": {
    "score": <0-100>,
    "matching": ["skill1", "skill2"],
    "missing": ["skill3"],
    "transferable": ["skill they have that could transfer"]
  },
  "experienceAnalysis": {
    "score": <0-100>,
    "gap": <years above/below requirement>,
    "relevance": "how relevant is their experience"
  },
  "industryFit": {
    "score": <0-100>,
    "match": true/false,
    "reasoning": "why"
  },
  "cultureFit": {
    "score": <0-100>,
    "signals": ["matching culture signals"]
  },
  "recommendation": "use_as_is|make_tweaks|create_variant",
  "summary": "2-3 sentence summary",
  "topSuggestions": [
    {
      "type": "add|remove|reword|highlight",
      "section": "skills|experience|projects|summary",
      "priority": "high|medium|low",
      "suggestion": "specific actionable suggestion"
    }
  ],
  "strengths": ["strength1", "strength2"],
  "weaknesses": ["weakness1", "weakness2"]
}

Be specific, actionable, and honest. Return only valid JSON.`;
}

/**
 * Build prompt for generating improvement suggestions
 */
export function buildSuggestionsPrompt(
  profile: UserProfile,
  jobDescription: string,
  currentScore: MatchScore
): string {
  return `You are a career coach helping optimize a resume for a specific job. 

Current match score: ${currentScore.overall}%
- Skills: ${currentScore.breakdown.skills}%
- Experience: ${currentScore.breakdown.experience}%
- Industry: ${currentScore.breakdown.industry}%
- Culture fit: ${currentScore.breakdown.vibes}%

Missing skills: ${currentScore.details.missingSkills.join(', ')}
Experience gap: ${currentScore.details.experienceGap} years

RESUME SKILLS: ${profile.skills.join(', ')}

JOB DESCRIPTION:
${jobDescription.slice(0, 1500)}

Generate 3-5 specific, actionable suggestions to improve this match. Focus on:
1. How to highlight existing relevant experience
2. Which skills to emphasize or add
3. How to frame experience for this industry
4. Quick wins vs longer-term improvements

Format as JSON array:
[
  {
    "type": "reword|add|highlight|reorder",
    "section": "skills|experience|summary|projects",
    "priority": "high|medium|low",
    "title": "short title",
    "description": "detailed suggestion",
    "example": "concrete example if applicable",
    "impact": "estimated score improvement"
  }
]

Be specific with examples. Return only valid JSON.`;
}

// ============ Feedback Learning ============

/**
 * Record feedback for learning
 */
export function recordFeedback(feedback: FeedbackData): void {
  feedbackStore.push(feedback);
  
  // In a real implementation, this would:
  // 1. Store to persistent storage
  // 2. Periodically analyze patterns
  // 3. Adjust scoring weights based on outcomes
  
  console.log('[Resume Matcher] Recorded feedback:', feedback.matchId);
}

/**
 * Get feedback summary for learning insights
 */
export function getFeedbackSummary(): {
  totalFeedback: number;
  outcomes: Record<string, number>;
  avgScoreByOutcome: Record<string, number>;
} {
  const outcomes: Record<string, number> = {};
  const scoresByOutcome: Record<string, number[]> = {};
  
  for (const fb of feedbackStore) {
    const outcome = fb.outcome || 'unknown';
    outcomes[outcome] = (outcomes[outcome] || 0) + 1;
    
    if (!scoresByOutcome[outcome]) scoresByOutcome[outcome] = [];
    scoresByOutcome[outcome].push(fb.originalScore);
  }
  
  const avgScoreByOutcome: Record<string, number> = {};
  for (const [outcome, scores] of Object.entries(scoresByOutcome)) {
    avgScoreByOutcome[outcome] = Math.round(
      scores.reduce((a, b) => a + b, 0) / scores.length
    );
  }
  
  return {
    totalFeedback: feedbackStore.length,
    outcomes,
    avgScoreByOutcome,
  };
}

/**
 * Adjust weights based on feedback (simple implementation)
 */
export function adjustWeightsFromFeedback(): void {
  // This would analyze feedback patterns and adjust WEIGHTS
  // For example, if high-skill matches are getting rejected,
  // we might increase the weight on experience or industry fit
  
  // Placeholder for ML-based weight adjustment
  console.log('[Resume Matcher] Analyzing feedback for weight adjustment...');
}
