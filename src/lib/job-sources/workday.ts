/**
 * Workday Job Scraper
 * 
 * Workday is a common ATS used by many large companies.
 * Each company has a unique Workday subdomain and career site.
 * 
 * Workday URLs follow patterns like:
 * - https://company.wd5.myworkdayjobs.com/en-US/careers
 * - https://company.wd1.myworkdayjobs.com/External
 * 
 * The API endpoint is usually:
 * https://company.wd5.myworkdayjobs.com/wday/cxs/company/careers/jobs
 */

import { Job, JobSourceResult, JobSearchParams, JobType, ExperienceLevel } from '../types';

interface WorkdayJob {
  title: string;
  externalPath: string;
  locationsText: string;
  postedOn: string;
  bulletFields?: string[];
  subtitles?: Array<{ title: string }>;
}

interface WorkdayFacet {
  descriptor: string;
  count: number;
  id: string;
}

interface WorkdayResponse {
  total: number;
  jobPostings: WorkdayJob[];
  facets?: {
    locations?: WorkdayFacet[];
    jobFamilyGroup?: WorkdayFacet[];
    timeType?: WorkdayFacet[];
  };
}

interface WorkdayJobDetails {
  jobPostingInfo: {
    title: string;
    jobDescription: string;
    location: string;
    postedOn: string;
    startDate?: string;
    jobRequisitionId: string;
    externalApplyUrl?: string;
  };
}

export interface WorkdayCompany {
  name: string;
  subdomain: string;
  instance: string;  // wd1, wd5, etc.
  careerPath: string;  // careers, External, etc.
}

// Popular companies using Workday
export const WORKDAY_COMPANIES: WorkdayCompany[] = [
  { name: 'Amazon', subdomain: 'amazon', instance: 'wd5', careerPath: 'Amazon' },
  { name: 'Adobe', subdomain: 'adobe', instance: 'wd5', careerPath: 'external_experienced' },
  { name: 'Salesforce', subdomain: 'salesforce', instance: 'wd1', careerPath: 'External_Career_Site' },
  { name: 'Netflix', subdomain: 'netflix', instance: 'wd5', careerPath: 'Netflix-Careers' },
  { name: 'Uber', subdomain: 'uber', instance: 'wd5', careerPath: 'Uber_Careers' },
  { name: 'Microsoft', subdomain: 'microsoft', instance: 'wd1', careerPath: 'MS-External-Careers' },
  { name: 'Apple', subdomain: 'apple', instance: 'wd1', careerPath: 'External' },
  { name: 'Target', subdomain: 'target', instance: 'wd5', careerPath: 'targetcareers' },
  { name: 'Walmart', subdomain: 'walmart', instance: 'wd5', careerPath: 'WalmartExternal' },
  { name: 'Goldman Sachs', subdomain: 'gs', instance: 'wd5', careerPath: 'GS' },
  { name: 'JP Morgan', subdomain: 'jpmorganchase', instance: 'wd5', careerPath: 'CorporateJPMC' },
  { name: 'Bank of America', subdomain: 'bankofamerica', instance: 'wd5', careerPath: 'careers' },
  { name: 'Cisco', subdomain: 'cisco', instance: 'wd1', careerPath: 'Cisco' },
  { name: 'Intel', subdomain: 'intel', instance: 'wd1', careerPath: 'External' },
  { name: 'IBM', subdomain: 'ibm', instance: 'wd5', careerPath: 'External' },
  { name: 'Oracle', subdomain: 'oracle', instance: 'wd1', careerPath: 'Careers' },
  { name: 'SAP', subdomain: 'sap', instance: 'wd1', careerPath: 'SAPCareers' },
  { name: 'Visa', subdomain: 'visa', instance: 'wd5', careerPath: 'VisaCareers' },
  { name: 'Mastercard', subdomain: 'mastercard', instance: 'wd5', careerPath: 'Mastercard' },
  { name: 'Capital One', subdomain: 'capitalone', instance: 'wd1', careerPath: 'Capital_One' },
];

/**
 * Build the Workday API URL for a company
 */
function buildWorkdayUrl(company: WorkdayCompany): string {
  return `https://${company.subdomain}.${company.instance}.myworkdayjobs.com`;
}

/**
 * Fetch jobs from a Workday company
 */
export async function fetchWorkdayJobs(
  company: WorkdayCompany,
  limit: number = 50,
  offset: number = 0,
  searchText?: string
): Promise<Job[]> {
  const baseUrl = buildWorkdayUrl(company);
  const apiUrl = `${baseUrl}/wday/cxs/${company.subdomain}/${company.careerPath}/jobs`;
  
  const requestBody = {
    appliedFacets: {},
    limit,
    offset,
    searchText: searchText || '',
  };
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`Workday site not found for ${company.name}`);
        return [];
      }
      throw new Error(`Workday API error: ${response.status}`);
    }
    
    const data: WorkdayResponse = await response.json();
    
    return data.jobPostings.map(job => 
      normalizeWorkdayJob(job, company, baseUrl)
    );
  } catch (error) {
    console.error(`Error fetching Workday jobs for ${company.name}:`, error);
    throw error;
  }
}

/**
 * Fetch detailed job information
 */
export async function fetchWorkdayJobDetails(
  company: WorkdayCompany,
  externalPath: string
): Promise<WorkdayJobDetails | null> {
  const baseUrl = buildWorkdayUrl(company);
  const apiUrl = `${baseUrl}/wday/cxs/${company.subdomain}/${company.careerPath}${externalPath}`;
  
  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Workday API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error fetching Workday job details:`, error);
    throw error;
  }
}

/**
 * Search across multiple Workday companies
 */
export async function searchWorkdayJobs(
  params: JobSearchParams,
  companies?: WorkdayCompany[]
): Promise<JobSourceResult> {
  const targetCompanies = companies || WORKDAY_COMPANIES;
  const allJobs: Job[] = [];
  const errors: string[] = [];
  
  // Build search text from keywords
  const searchText = params.keywords?.join(' ');
  
  // Fetch from companies in parallel (with rate limiting)
  const batchSize = 3;
  for (let i = 0; i < targetCompanies.length; i += batchSize) {
    const batch = targetCompanies.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(company => fetchWorkdayJobs(company, 50, 0, searchText))
    );
    
    for (const result of results) {
      if (result.status === 'fulfilled') {
        allJobs.push(...result.value);
      } else {
        errors.push(result.reason?.message || 'Unknown error');
      }
    }
    
    // Delay between batches
    if (i + batchSize < targetCompanies.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  // Filter jobs based on search params
  let filteredJobs = allJobs;
  
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
    const companyNames = params.companies.map(c => c.toLowerCase());
    filteredJobs = filteredJobs.filter(job => 
      companyNames.includes(job.company.toLowerCase())
    );
  }
  
  // Apply limit
  if (params.limit) {
    filteredJobs = filteredJobs.slice(0, params.limit);
  }
  
  return {
    jobs: filteredJobs,
    source: 'workday',
    fetchedAt: new Date().toISOString(),
    hasMore: false,
    error: errors.length > 0 ? errors.join('; ') : undefined,
  };
}

/**
 * Convert Workday job format to our standard Job format
 */
function normalizeWorkdayJob(
  job: WorkdayJob,
  company: WorkdayCompany,
  baseUrl: string
): Job {
  const title = job.title.toLowerCase();
  
  // Detect job type
  let jobType: JobType = 'full-time';
  if (title.includes('intern') || title.includes('internship')) {
    jobType = 'internship';
  } else if (title.includes('part-time') || title.includes('part time')) {
    jobType = 'part-time';
  } else if (title.includes('contract') || title.includes('contractor') || title.includes('temp')) {
    jobType = 'contract';
  }
  
  // Detect experience level
  let experienceLevel: ExperienceLevel = 'unknown';
  if (title.includes('senior') || title.includes('sr.') || title.includes('sr ') || 
      title.includes('staff') || title.includes('principal')) {
    experienceLevel = 'senior';
  } else if (title.includes('lead') || title.includes('manager') || title.includes('director')) {
    experienceLevel = 'lead';
  } else if (title.includes('junior') || title.includes('jr.') || title.includes('jr ') ||
             title.includes('entry') || title.includes('associate') || 
             title.includes('new grad') || title.includes('graduate')) {
    experienceLevel = 'entry';
  } else if (title.includes(' ii') || title.includes(' iii') || title.includes(' 2') || title.includes(' 3')) {
    experienceLevel = 'mid';
  }
  
  // Detect remote
  const location = job.locationsText || 'Unknown';
  const isRemote = location.toLowerCase().includes('remote') || 
                   location.toLowerCase().includes('virtual') ||
                   location.toLowerCase().includes('anywhere');
  
  // Extract job ID from external path
  const jobIdMatch = job.externalPath.match(/\/job\/([^\/]+)/);
  const sourceId = jobIdMatch ? jobIdMatch[1] : job.externalPath;
  
  // Build description from bullet fields if available
  let description = '';
  if (job.bulletFields?.length) {
    description = job.bulletFields.join('\n');
  }
  
  return {
    id: `workday-${company.subdomain}-${sourceId}`,
    source: 'workday',
    sourceId,
    company: company.name,
    companyUrl: baseUrl,
    title: job.title,
    description,
    shortDescription: job.subtitles?.map(s => s.title).join(' | '),
    location,
    isRemote,
    jobType,
    experienceLevel,
    applicationUrl: `${baseUrl}/en-US/${company.careerPath}${job.externalPath}`,
    postedAt: job.postedOn,
    scrapedAt: new Date().toISOString(),
  };
}

/**
 * Validate if a Workday company configuration is accessible
 */
export async function validateWorkdayCompany(company: WorkdayCompany): Promise<boolean> {
  try {
    await fetchWorkdayJobs(company, 1, 0);
    return true;
  } catch {
    return false;
  }
}

export default {
  fetchJobs: fetchWorkdayJobs,
  fetchJobDetails: fetchWorkdayJobDetails,
  search: searchWorkdayJobs,
  companies: WORKDAY_COMPANIES,
  validate: validateWorkdayCompany,
};
