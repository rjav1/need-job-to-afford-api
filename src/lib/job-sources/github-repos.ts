/**
 * GitHub Repository Job Parser
 * 
 * Parses job listings from community-maintained GitHub repositories.
 * These repos typically have markdown tables with job postings.
 * 
 * Popular repos:
 * - SimplifyJobs/Summer2025-Internships
 * - pittcsc/Summer2024-Internships (archived)
 * - ReaVNaiL/New-Grad-2024
 */

import { Job, JobSourceResult, JobSearchParams, JobType, ExperienceLevel } from '../types';

export interface GitHubJobRepo {
  owner: string;
  repo: string;
  branch: string;
  filePath: string;
  name: string;
  jobType: JobType;
  experienceLevel: ExperienceLevel;
}

// Known job listing repositories
export const GITHUB_JOB_REPOS: GitHubJobRepo[] = [
  {
    owner: 'SimplifyJobs',
    repo: 'Summer2025-Internships',
    branch: 'dev',
    filePath: 'README.md',
    name: 'Summer 2025 Tech Internships',
    jobType: 'internship',
    experienceLevel: 'entry',
  },
  {
    owner: 'SimplifyJobs',
    repo: 'New-Grad-Positions',
    branch: 'dev',
    filePath: 'README.md',
    name: 'New Grad Positions',
    jobType: 'full-time',
    experienceLevel: 'entry',
  },
  {
    owner: 'cvrve',
    repo: 'Summer2025-Internships',
    branch: 'main',
    filePath: 'README.md',
    name: 'Summer 2025 Internships (cvrve)',
    jobType: 'internship',
    experienceLevel: 'entry',
  },
  {
    owner: 'ReaVNaiL',
    repo: 'New-Grad-2024',
    branch: 'main',
    filePath: 'README.md',
    name: 'New Grad 2024',
    jobType: 'full-time',
    experienceLevel: 'entry',
  },
];

interface ParsedTableRow {
  company: string;
  role: string;
  location: string;
  applicationUrl: string;
  datePosted?: string;
  notes?: string;
}

/**
 * Fetch raw content from a GitHub repository file
 */
async function fetchGitHubRawContent(
  owner: string,
  repo: string,
  branch: string,
  filePath: string
): Promise<string> {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GitHub fetch error: ${response.status} for ${url}`);
  }
  
  return await response.text();
}

/**
 * Parse a markdown table into rows
 * 
 * Handles tables like:
 * | Company | Role | Location | Application/Link | Date Posted |
 * | ------- | ---- | -------- | ---------------- | ----------- |
 * | Google  | SWE  | NYC      | [Apply](url)     | Oct 10      |
 */
function parseMarkdownTable(content: string): ParsedTableRow[] {
  const rows: ParsedTableRow[] = [];
  const lines = content.split('\n');
  
  let inTable = false;
  let headerRow: string[] = [];
  let columnMap: Map<string, number> = new Map();
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip empty lines
    if (!trimmedLine) {
      inTable = false;
      continue;
    }
    
    // Detect table rows (start with |)
    if (trimmedLine.startsWith('|')) {
      const cells = trimmedLine
        .split('|')
        .map(cell => cell.trim())
        .filter((_, i, arr) => i > 0 && i < arr.length - 1); // Remove empty first/last
      
      // Skip separator rows (|---|---|)
      if (cells.every(cell => /^[-:]+$/.test(cell))) {
        continue;
      }
      
      // Detect header row
      if (!inTable) {
        headerRow = cells.map(c => c.toLowerCase());
        
        // Map column names to indices
        headerRow.forEach((col, idx) => {
          if (col.includes('company') || col.includes('name')) {
            columnMap.set('company', idx);
          } else if (col.includes('role') || col.includes('position') || col.includes('title')) {
            columnMap.set('role', idx);
          } else if (col.includes('location')) {
            columnMap.set('location', idx);
          } else if (col.includes('link') || col.includes('apply') || col.includes('application')) {
            columnMap.set('link', idx);
          } else if (col.includes('date') || col.includes('posted')) {
            columnMap.set('date', idx);
          } else if (col.includes('note') || col.includes('status')) {
            columnMap.set('notes', idx);
          }
        });
        
        inTable = true;
        continue;
      }
      
      // Parse data row
      if (inTable && cells.length >= 3) {
        // Extract link from markdown format [text](url)
        const linkCell = columnMap.has('link') ? cells[columnMap.get('link')!] : '';
        const linkMatch = linkCell.match(/\[([^\]]*)\]\(([^)]+)\)/);
        const applicationUrl = linkMatch ? linkMatch[2] : '';
        
        // Skip rows with 🔒 (closed applications)
        if (linkCell.includes('🔒') || cells.some(c => c.includes('🔒'))) {
          continue;
        }
        
        // Skip if no valid application URL
        if (!applicationUrl || applicationUrl === '#') {
          continue;
        }
        
        // Extract company name (might have link)
        let company = columnMap.has('company') ? cells[columnMap.get('company')!] : cells[0];
        const companyMatch = company.match(/\[([^\]]+)\]/);
        company = companyMatch ? companyMatch[1] : company;
        company = company.replace(/[*_]/g, '').trim(); // Remove markdown formatting
        
        rows.push({
          company,
          role: columnMap.has('role') ? cells[columnMap.get('role')!].replace(/[*_]/g, '') : '',
          location: columnMap.has('location') ? cells[columnMap.get('location')!] : '',
          applicationUrl,
          datePosted: columnMap.has('date') ? cells[columnMap.get('date')!] : undefined,
          notes: columnMap.has('notes') ? cells[columnMap.get('notes')!] : undefined,
        });
      }
    } else {
      inTable = false;
    }
  }
  
  return rows;
}

/**
 * Fetch and parse jobs from a GitHub repository
 */
export async function fetchGitHubRepoJobs(repo: GitHubJobRepo): Promise<Job[]> {
  try {
    const content = await fetchGitHubRawContent(
      repo.owner,
      repo.repo,
      repo.branch,
      repo.filePath
    );
    
    const tableRows = parseMarkdownTable(content);
    
    return tableRows.map((row, idx) => normalizeGitHubJob(row, repo, idx));
  } catch (error) {
    console.error(`Error fetching GitHub repo ${repo.owner}/${repo.repo}:`, error);
    throw error;
  }
}

/**
 * Convert parsed table row to our standard Job format
 */
function normalizeGitHubJob(
  row: ParsedTableRow,
  repo: GitHubJobRepo,
  index: number
): Job {
  const title = row.role.toLowerCase();
  
  // Override job type detection with repo default
  let jobType: JobType = repo.jobType;
  if (title.includes('intern')) {
    jobType = 'internship';
  } else if (title.includes('full-time') || title.includes('full time')) {
    jobType = 'full-time';
  }
  
  // Detect remote
  const location = row.location || 'Unknown';
  const isRemote = location.toLowerCase().includes('remote') || 
                   location.toLowerCase().includes('virtual');
  
  // Create a unique ID
  const sourceId = `${repo.owner}-${repo.repo}-${row.company}-${index}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  
  return {
    id: `github-${sourceId}`,
    source: 'github',
    sourceId,
    company: row.company,
    companyUrl: undefined,
    title: row.role || `${repo.jobType === 'internship' ? 'Internship' : 'Position'}`,
    description: row.notes || `${row.role} position at ${row.company}`,
    shortDescription: row.notes,
    location,
    isRemote,
    jobType,
    experienceLevel: repo.experienceLevel,
    applicationUrl: row.applicationUrl,
    postedAt: parseRelativeDate(row.datePosted),
    scrapedAt: new Date().toISOString(),
    tags: [repo.name],
  };
}

/**
 * Parse relative dates like "Oct 10" or "2 days ago"
 */
function parseRelativeDate(dateStr?: string): string | undefined {
  if (!dateStr) return undefined;
  
  const now = new Date();
  const currentYear = now.getFullYear();
  
  // Try parsing "Mon DD" format (e.g., "Oct 10")
  const monthDayMatch = dateStr.match(/(\w{3})\s+(\d{1,2})/);
  if (monthDayMatch) {
    const months: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    };
    const month = months[monthDayMatch[1].toLowerCase()];
    const day = parseInt(monthDayMatch[2]);
    if (month !== undefined) {
      const date = new Date(currentYear, month, day);
      // If date is in the future, assume previous year
      if (date > now) {
        date.setFullYear(currentYear - 1);
      }
      return date.toISOString();
    }
  }
  
  return undefined;
}

/**
 * Search across all GitHub job repos
 */
export async function searchGitHubJobs(
  params: JobSearchParams,
  repos?: GitHubJobRepo[]
): Promise<JobSourceResult> {
  const targetRepos = repos || GITHUB_JOB_REPOS;
  const allJobs: Job[] = [];
  const errors: string[] = [];
  
  // Fetch from all repos in parallel
  const results = await Promise.allSettled(
    targetRepos.map(repo => fetchGitHubRepoJobs(repo))
  );
  
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allJobs.push(...result.value);
    } else {
      errors.push(result.reason?.message || 'Unknown error');
    }
  }
  
  // Filter jobs
  let filteredJobs = allJobs;
  
  if (params.keywords?.length) {
    const keywords = params.keywords.map(k => k.toLowerCase());
    filteredJobs = filteredJobs.filter(job => {
      const searchText = `${job.title} ${job.company} ${job.description}`.toLowerCase();
      return keywords.some(kw => searchText.includes(kw));
    });
  }
  
  if (params.location) {
    const loc = params.location.toLowerCase();
    filteredJobs = filteredJobs.filter(job => 
      job.location.toLowerCase().includes(loc)
    );
  }
  
  if (params.remote !== undefined) {
    filteredJobs = filteredJobs.filter(job => job.isRemote === params.remote);
  }
  
  if (params.jobType) {
    filteredJobs = filteredJobs.filter(job => job.jobType === params.jobType);
  }
  
  if (params.experienceLevel) {
    filteredJobs = filteredJobs.filter(job => job.experienceLevel === params.experienceLevel);
  }
  
  if (params.companies?.length) {
    const companies = params.companies.map(c => c.toLowerCase());
    filteredJobs = filteredJobs.filter(job => 
      companies.includes(job.company.toLowerCase())
    );
  }
  
  // Apply limit
  if (params.limit) {
    filteredJobs = filteredJobs.slice(0, params.limit);
  }
  
  return {
    jobs: filteredJobs,
    source: 'github',
    fetchedAt: new Date().toISOString(),
    hasMore: false,
    error: errors.length > 0 ? errors.join('; ') : undefined,
  };
}

/**
 * Get list of available repos with their status
 */
export async function listAvailableRepos(): Promise<Array<GitHubJobRepo & { accessible: boolean; jobCount?: number }>> {
  const results = await Promise.allSettled(
    GITHUB_JOB_REPOS.map(async repo => {
      try {
        const jobs = await fetchGitHubRepoJobs(repo);
        return { ...repo, accessible: true, jobCount: jobs.length };
      } catch {
        return { ...repo, accessible: false };
      }
    })
  );
  
  return results.map(r => r.status === 'fulfilled' ? r.value : { ...GITHUB_JOB_REPOS[0], accessible: false });
}

export default {
  fetchJobs: fetchGitHubRepoJobs,
  search: searchGitHubJobs,
  repos: GITHUB_JOB_REPOS,
  listRepos: listAvailableRepos,
};
