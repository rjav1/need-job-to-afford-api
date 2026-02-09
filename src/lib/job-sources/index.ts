/**
 * Unified Job Source Interface
 * 
 * Aggregates jobs from multiple sources:
 * - Greenhouse (API)
 * - Workday (scraper)
 * - GitHub repos (parser)
 * 
 * Provides a single interface to search across all sources.
 */

import { Job, JobSearchParams, JobSource, JobSourceResult } from '../types';
import greenhouse, { GREENHOUSE_COMPANIES, searchGreenhouseJobs } from './greenhouse';
import workday, { WORKDAY_COMPANIES, searchWorkdayJobs, WorkdayCompany } from './workday';
import github, { GITHUB_JOB_REPOS, searchGitHubJobs, GitHubJobRepo } from './github-repos';

// Re-export types and constants
export { GREENHOUSE_COMPANIES } from './greenhouse';
export { WORKDAY_COMPANIES, type WorkdayCompany } from './workday';
export { GITHUB_JOB_REPOS, type GitHubJobRepo } from './github-repos';

// Re-export individual source modules
export { default as greenhouseSource } from './greenhouse';
export { default as workdaySource } from './workday';
export { default as githubSource } from './github-repos';

/**
 * Configuration for the unified job search
 */
export interface UnifiedSearchConfig {
  sources?: JobSource[];  // Which sources to search (default: all)
  parallel?: boolean;     // Fetch sources in parallel (default: true)
  timeout?: number;       // Timeout per source in ms (default: 30000)
  
  // Source-specific filters
  greenhouseCompanies?: string[];  // Specific Greenhouse company tokens
  workdayCompanies?: WorkdayCompany[];
  githubRepos?: GitHubJobRepo[];
}

export interface UnifiedSearchResult {
  jobs: Job[];
  sources: {
    [key in JobSource]?: {
      count: number;
      error?: string;
      fetchedAt: string;
    };
  };
  totalCount: number;
  fetchedAt: string;
  errors: string[];
}

/**
 * Search for jobs across all configured sources
 */
export async function searchJobs(
  params: JobSearchParams = {},
  config: UnifiedSearchConfig = {}
): Promise<UnifiedSearchResult> {
  const {
    sources = ['greenhouse', 'workday', 'github'],
    parallel = true,
    timeout = 30000,
  } = config;
  
  const results: UnifiedSearchResult = {
    jobs: [],
    sources: {},
    totalCount: 0,
    fetchedAt: new Date().toISOString(),
    errors: [],
  };
  
  const searchTasks: Array<() => Promise<JobSourceResult>> = [];
  
  // Build search tasks for each source
  if (sources.includes('greenhouse')) {
    searchTasks.push(async () => {
      return await withTimeout(
        searchGreenhouseJobs(params, config.greenhouseCompanies),
        timeout,
        'greenhouse'
      );
    });
  }
  
  if (sources.includes('workday')) {
    searchTasks.push(async () => {
      return await withTimeout(
        searchWorkdayJobs(params, config.workdayCompanies),
        timeout,
        'workday'
      );
    });
  }
  
  if (sources.includes('github')) {
    searchTasks.push(async () => {
      return await withTimeout(
        searchGitHubJobs(params, config.githubRepos),
        timeout,
        'github'
      );
    });
  }
  
  // Execute tasks
  let sourceResults: JobSourceResult[];
  if (parallel) {
    const settled = await Promise.allSettled(searchTasks.map(task => task()));
    sourceResults = settled.map((result, idx) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      return {
        jobs: [],
        source: sources[idx],
        fetchedAt: new Date().toISOString(),
        hasMore: false,
        error: result.reason?.message || 'Unknown error',
      };
    });
  } else {
    sourceResults = [];
    for (const task of searchTasks) {
      try {
        sourceResults.push(await task());
      } catch (error) {
        sourceResults.push({
          jobs: [],
          source: 'greenhouse', // will be overwritten
          fetchedAt: new Date().toISOString(),
          hasMore: false,
          error: (error as Error).message,
        });
      }
    }
  }
  
  // Aggregate results
  for (const sourceResult of sourceResults) {
    results.sources[sourceResult.source] = {
      count: sourceResult.jobs.length,
      error: sourceResult.error,
      fetchedAt: sourceResult.fetchedAt,
    };
    
    results.jobs.push(...sourceResult.jobs);
    
    if (sourceResult.error) {
      results.errors.push(`${sourceResult.source}: ${sourceResult.error}`);
    }
  }
  
  results.totalCount = results.jobs.length;
  
  // Sort by posted date (newest first)
  results.jobs.sort((a, b) => {
    const dateA = a.postedAt ? new Date(a.postedAt).getTime() : 0;
    const dateB = b.postedAt ? new Date(b.postedAt).getTime() : 0;
    return dateB - dateA;
  });
  
  // Apply global limit if specified
  if (params.limit && results.jobs.length > params.limit) {
    results.jobs = results.jobs.slice(0, params.limit);
  }
  
  return results;
}

/**
 * Quick search focusing on internships
 */
export async function searchInternships(
  keywords?: string[],
  config?: UnifiedSearchConfig
): Promise<UnifiedSearchResult> {
  return searchJobs(
    {
      keywords,
      jobType: 'internship',
      experienceLevel: 'entry',
    },
    config
  );
}

/**
 * Quick search focusing on new grad positions
 */
export async function searchNewGrad(
  keywords?: string[],
  config?: UnifiedSearchConfig
): Promise<UnifiedSearchResult> {
  return searchJobs(
    {
      keywords,
      experienceLevel: 'entry',
    },
    config
  );
}

/**
 * Search a specific company across all sources
 */
export async function searchCompany(
  companyName: string,
  params: Omit<JobSearchParams, 'companies'> = {}
): Promise<UnifiedSearchResult> {
  return searchJobs({
    ...params,
    companies: [companyName],
  });
}

/**
 * Get job by ID (format: source-company-id)
 */
export async function getJobById(jobId: string): Promise<Job | null> {
  const parts = jobId.split('-');
  if (parts.length < 3) return null;
  
  const source = parts[0] as JobSource;
  
  if (source === 'greenhouse') {
    const companyToken = parts[1];
    const id = parseInt(parts.slice(2).join('-'));
    if (isNaN(id)) return null;
    
    return await greenhouse.fetchJobById(companyToken, id);
  }
  
  // For other sources, we'd need to search
  // This is a simplified implementation
  return null;
}

/**
 * Get summary of all available job sources
 */
export function getSourceSummary() {
  return {
    greenhouse: {
      name: 'Greenhouse',
      type: 'api',
      companiesCount: GREENHOUSE_COMPANIES.length,
      companies: GREENHOUSE_COMPANIES.map(c => c.name),
    },
    workday: {
      name: 'Workday',
      type: 'scraper',
      companiesCount: WORKDAY_COMPANIES.length,
      companies: WORKDAY_COMPANIES.map(c => c.name),
    },
    github: {
      name: 'GitHub Repos',
      type: 'parser',
      reposCount: GITHUB_JOB_REPOS.length,
      repos: GITHUB_JOB_REPOS.map(r => `${r.owner}/${r.repo}`),
    },
  };
}

/**
 * Helper: Add timeout to a promise
 */
async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  source: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(`${source} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

/**
 * Deduplicate jobs by application URL
 */
export function deduplicateJobs(jobs: Job[]): Job[] {
  const seen = new Set<string>();
  return jobs.filter(job => {
    const key = job.applicationUrl.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Filter jobs by relevance to user profile keywords
 */
export function filterByRelevance(jobs: Job[], keywords: string[]): Job[] {
  const lowerKeywords = keywords.map(k => k.toLowerCase());
  
  return jobs.filter(job => {
    const text = `${job.title} ${job.description} ${job.company}`.toLowerCase();
    return lowerKeywords.some(kw => text.includes(kw));
  });
}

// Default export with all functions
export default {
  search: searchJobs,
  searchInternships,
  searchNewGrad,
  searchCompany,
  getJobById,
  getSourceSummary,
  deduplicateJobs,
  filterByRelevance,
  
  // Individual sources
  sources: {
    greenhouse,
    workday,
    github,
  },
};
