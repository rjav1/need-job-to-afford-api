import { UserProfile } from './types';

// Common patterns for extracting info from resume text
const PATTERNS = {
  email: /[\w.-]+@[\w.-]+\.\w+/i,
  phone: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,
  linkedin: /linkedin\.com\/in\/[\w-]+/i,
  github: /github\.com\/[\w-]+/i,
  gpa: /(?:GPA|G\.P\.A\.?)[\s:]*(\d\.\d{1,2})(?:\s*\/\s*4\.0)?/i,
  
  // Education patterns
  university: /(?:University|College|Institute|School)\s+of\s+[\w\s]+|[\w\s]+(?:University|College|Institute|Tech|State)/gi,
  degree: /(?:Bachelor|Master|PhD|Ph\.D\.|B\.S\.|B\.A\.|M\.S\.|M\.A\.|B\.Sc\.|M\.Sc\.)[\w\s.,]*/gi,
  major: /(?:Major|Concentration|Field of Study|Degree in)[\s:]*([A-Za-z\s]+)/i,
  graduation: /(?:Expected\s+)?(?:Graduation|Graduate|Class of)[\s:]*(?:May|June|December|Spring|Fall|Summer)?\s*\d{4}/gi,
  
  // Skills patterns
  skills: /(?:Skills|Technologies|Technical Skills|Programming Languages)[\s:]*([^\n]+(?:\n(?![A-Z])[^\n]+)*)/i,
};

// Common university name variations
const UNIVERSITY_KEYWORDS = [
  'georgia tech', 'georgia institute of technology',
  'mit', 'massachusetts institute of technology',
  'stanford', 'stanford university',
  'berkeley', 'uc berkeley',
  'carnegie mellon', 'cmu',
  'university of',
  'college of',
  'state university',
];

// Extract profile information from resume text
export function extractFromResume(resumeText: string): Partial<UserProfile> {
  const text = resumeText.toLowerCase();
  const originalText = resumeText;
  const extracted: Partial<UserProfile> = {};

  // Extract email
  const emailMatch = originalText.match(PATTERNS.email);
  if (emailMatch) {
    extracted.email = emailMatch[0];
  }

  // Extract phone
  const phoneMatch = originalText.match(PATTERNS.phone);
  if (phoneMatch) {
    extracted.phone = phoneMatch[0].replace(/[^\d+]/g, '').replace(/^1/, '');
    // Format phone
    if (extracted.phone.length === 10) {
      extracted.phone = `(${extracted.phone.slice(0,3)}) ${extracted.phone.slice(3,6)}-${extracted.phone.slice(6)}`;
    }
  }

  // Extract LinkedIn
  const linkedinMatch = originalText.match(PATTERNS.linkedin);
  if (linkedinMatch) {
    extracted.linkedinUrl = `https://${linkedinMatch[0]}`;
  }

  // Extract GitHub
  const githubMatch = originalText.match(PATTERNS.github);
  if (githubMatch) {
    extracted.githubUrl = `https://${githubMatch[0]}`;
  }

  // Extract GPA
  const gpaMatch = originalText.match(PATTERNS.gpa);
  if (gpaMatch) {
    extracted.gpa = gpaMatch[1];
  }

  // Extract University
  const uniMatches = originalText.match(PATTERNS.university);
  if (uniMatches && uniMatches.length > 0) {
    // Get the first/most prominent university
    extracted.university = uniMatches[0].trim();
  }

  // Extract Degree
  const degreeMatches = originalText.match(PATTERNS.degree);
  if (degreeMatches && degreeMatches.length > 0) {
    const degree = degreeMatches[0].trim();
    // Try to split degree and major
    if (degree.toLowerCase().includes(' in ')) {
      const parts = degree.split(/\s+in\s+/i);
      extracted.degree = parts[0].trim();
      if (parts[1]) {
        extracted.major = parts[1].trim();
      }
    } else {
      extracted.degree = degree;
    }
  }

  // Extract graduation date
  const gradMatches = originalText.match(PATTERNS.graduation);
  if (gradMatches && gradMatches.length > 0) {
    extracted.graduationDate = gradMatches[0].replace(/(?:Expected\s+)?(?:Graduation|Graduate|Class of)[\s:]*/i, '').trim();
  }

  // Extract skills
  const skillsMatch = originalText.match(PATTERNS.skills);
  if (skillsMatch) {
    const skillsText = skillsMatch[1];
    // Split by common delimiters
    const skills = skillsText
      .split(/[,;•|]|\n/)
      .map(s => s.trim())
      .filter(s => s.length > 1 && s.length < 30)
      .slice(0, 20); // Limit to 20 skills
    if (skills.length > 0) {
      extracted.skills = skills;
    }
  }

  // Try to extract name from first line (common resume format)
  const lines = originalText.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length > 0) {
    const firstLine = lines[0];
    // If first line looks like a name (2-3 words, no special chars)
    if (/^[A-Z][a-z]+\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)?$/.test(firstLine)) {
      const nameParts = firstLine.split(/\s+/);
      extracted.firstName = nameParts[0];
      extracted.lastName = nameParts[nameParts.length - 1];
    }
  }

  return extracted;
}

// Merge extracted data with existing profile (don't overwrite existing values)
export function mergeWithProfile(profile: UserProfile, extracted: Partial<UserProfile>): UserProfile {
  const merged = { ...profile };
  
  for (const [key, value] of Object.entries(extracted)) {
    if (value && !profile[key as keyof UserProfile]) {
      (merged as any)[key] = value;
    }
  }
  
  return merged;
}
