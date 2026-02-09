/**
 * Greenhouse API Integration
 * 
 * Greenhouse provides a public Job Board API that doesn't require authentication.
 * Each company has a unique board token (e.g., "airbnb", "stripe", "figma").
 * 
 * API Docs: https://developers.greenhouse.io/job-board.html
 */

import { Job, JobSourceResult, JobSearchParams, JobType, ExperienceLevel } from '../types';

interface GreenhouseJob {
  id: number;
  title: string;
  updated_at: string;
  requisition_id: string;
  location: {
    name: string;
  };
  absolute_url: string;
  metadata?: Array<{
    id: number;
    name: string;
    value: string | string[] | null;
    value_type: string;
  }>;
  content?: string;
  departments: Array<{
    id: number;
    name: string;
  }>;
  offices: Array<{
    id: number;
    name: string;
    location: string;
  }>;
}

interface GreenhouseResponse {
  jobs: GreenhouseJob[];
  meta?: {
    total: number;
  };
}

// Popular companies using Greenhouse
export const GREENHOUSE_COMPANIES = [
  { name: 'Airbnb', token: 'airbnb' },
  { name: 'Stripe', token: 'stripe' },
  { name: 'Figma', token: 'figma' },
  { name: 'Notion', token: 'notion' },
  { name: 'Discord', token: 'discord' },
  { name: 'Coinbase', token: 'coinbase' },
  { name: 'Cloudflare', token: 'cloudflare' },
  { name: 'Ramp', token: 'ramp' },
  { name: 'Plaid', token: 'plaid' },
  { name: 'Scale AI', token: 'scaleai' },
  { name: 'Anthropic', token: 'anthropic' },
  { name: 'OpenAI', token: 'openai' },
  { name: 'Brex', token: 'brex' },
  { name: 'DoorDash', token: 'doordash' },
  { name: 'Instacart', token: 'instacart' },
  { name: 'Robinhood', token: 'robinhood' },
  { name: 'Snap', token: 'snap' },
  { name: 'Twitch', token: 'twitch' },
  { name: 'Square', token: 'squareup' },
  { name: 'Lyft', token: 'lyft' },
  { name: 'Pinterest', token: 'pinterest' },
  { name: 'Dropbox', token: 'dropbox' },
  { name: 'Palantir', token: 'palantir' },
  { name: 'Databricks', token: 'databricks' },
  { name: 'MongoDB', token: 'mongodb' },
  { name: 'Atlassian', token: 'atlassian' },
  { name: 'Reddit', token: 'reddit' },
  { name: 'GitLab', token: 'gitlab' },
  { name: 'Anduril', token: 'andurilindustries' },
  { name: 'Verkada', token: 'verkada' },
] as const;

const BASE_URL = 'https://boards-api.greenhouse.io/v1/boards';

/**
 * Fetch all jobs from a company's Greenhouse board
 */
export async function fetchGreenhouseJobs(
  companyToken: string,
  companyName?: string
): Promise<Job[]> {
  const url = `${BASE_URL}/${companyToken}/jobs?content=true`;
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`Greenhouse board not found for token: ${companyToken}`);
        return [];
      }
      throw new Error(`Greenhouse API error: ${response.status}`);
    }
    
    const data: GreenhouseResponse = await response.json();
    const resolvedName = companyName || companyToken;
    
    return data.jobs.map(job => normalizeGreenhouseJob(job, companyToken, resolvedName));
  } catch (error) {
    console.error(`Error fetching Greenhouse jobs for ${companyToken}:`, error);
    throw error;
  }
}

/**
 * Fetch a single job by ID
 */
export async function fetchGreenhouseJobById(
  companyToken: string,
  jobId: number
): Promise<Job | null> {
  const url = `${BASE_URL}/${companyToken}/jobs/${jobId}`;
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Greenhouse API error: ${response.status}`);
    }
    
    const job: GreenhouseJob = await response.json();
    return normalizeGreenhouseJob(job, companyToken, companyToken);
  } catch (error) {
    console.error(`Error fetching Greenhouse job ${jobId}:`, error);
    throw error;
  }
}

/**
 * Search across multiple Greenhouse companies
 */
export async function searchGreenhouseJobs(
  params: JobSearchParams,
  companyTokens?: string[]
): Promise<JobSourceResult> {
  const tokens = companyTokens || GREENHOUSE_COMPANIES.map(c => c.token);
  const tokenToName = new Map<string, string>(GREENHOUSE_COMPANIES.map(c => [c.token, c.name]));
  
  const allJobs: Job[] = [];
  const errors: string[] = [];
  
  // Fetch from all companies in parallel (with rate limiting)
  const batchSize = 5;
  for (let i = 0; i < tokens.length; i += batchSize) {
    const batch = tokens.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(token => fetchGreenhouseJobs(token, tokenToName.get(token) || token))
    );
    
    for (const result of results) {
      if (result.status === 'fulfilled') {
        allJobs.push(...result.value);
      } else {
        errors.push(result.reason?.message || 'Unknown error');
      }
    }
    
    // Small delay between batches to avoid rate limiting
    if (i + batchSize < tokens.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  // Filter jobs based on search params
  let filteredJobs = allJobs;
  
  if (params.keywords?.length) {
    const keywords = params.keywords.map(k => k.toLowerCase());
    filteredJobs = filteredJobs.filter(job => {
      const searchText = `${job.title} ${job.description} ${job.company}`.toLowerCase();
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
    source: 'greenhouse',
    fetchedAt: new Date().toISOString(),
    hasMore: false,
    error: errors.length > 0 ? errors.join('; ') : undefined,
  };
}

/**
 * Convert Greenhouse job format to our standard Job format
 */
function normalizeGreenhouseJob(
  job: GreenhouseJob,
  companyToken: string,
  companyName: string
): Job {
  const title = job.title.toLowerCase();
  
  // Detect job type from title
  let jobType: JobType = 'full-time';
  if (title.includes('intern') || title.includes('internship')) {
    jobType = 'internship';
  } else if (title.includes('part-time') || title.includes('part time')) {
    jobType = 'part-time';
  } else if (title.includes('contract') || title.includes('contractor')) {
    jobType = 'contract';
  }
  
  // Detect experience level from title
  let experienceLevel: ExperienceLevel = 'unknown';
  if (title.includes('senior') || title.includes('sr.') || title.includes('staff') || title.includes('principal')) {
    experienceLevel = 'senior';
  } else if (title.includes('lead') || title.includes('manager') || title.includes('director')) {
    experienceLevel = 'lead';
  } else if (title.includes('junior') || title.includes('jr.') || title.includes('entry') || title.includes('associate') || title.includes('new grad')) {
    experienceLevel = 'entry';
  } else if (title.includes('mid') || title.includes('ii') || title.includes('iii')) {
    experienceLevel = 'mid';
  }
  
  // Detect remote from location
  const location = job.location?.name || 'Unknown';
  const isRemote = location.toLowerCase().includes('remote') || 
                   location.toLowerCase().includes('anywhere') ||
                   location.toLowerCase().includes('distributed');
  
  // Extract department
  const department = job.departments?.[0]?.name;
  
  // Create short description from content
  let shortDescription: string | undefined;
  if (job.content) {
    // Strip HTML and truncate
    const textContent = job.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    shortDescription = textContent.length > 300 ? textContent.slice(0, 297) + '...' : textContent;
  }
  
  return {
    id: `greenhouse-${companyToken}-${job.id}`,
    source: 'greenhouse',
    sourceId: job.id.toString(),
    company: companyName,
    companyUrl: `https://boards.greenhouse.io/${companyToken}`,
    title: job.title,
    description: job.content || '',
    shortDescription,
    location,
    isRemote,
    jobType,
    experienceLevel,
    department,
    applicationUrl: job.absolute_url,
    postedAt: job.updated_at,
    updatedAt: job.updated_at,
    scrapedAt: new Date().toISOString(),
  };
}

export default {
  fetchJobs: fetchGreenhouseJobs,
  fetchJobById: fetchGreenhouseJobById,
  search: searchGreenhouseJobs,
  companies: GREENHOUSE_COMPANIES,
};
