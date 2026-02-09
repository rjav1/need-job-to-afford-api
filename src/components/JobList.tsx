import React, { useState, useMemo } from 'react';
import { JobPosting } from '../lib/heartbeat';
import { FilterWeights } from './FilterSliders';

interface JobListProps {
  jobs: JobPosting[];
  filterWeights: FilterWeights;
  selectedIndustries: string[];
  onApply: (job: JobPosting) => void;
  onSave: (job: JobPosting) => void;
  onViewDetails: (job: JobPosting) => void;
  pageSize?: number;
}

type SortField = 'matchScore' | 'postedDate' | 'company' | 'title';
type SortDirection = 'asc' | 'desc';

export function JobList({
  jobs,
  filterWeights,
  selectedIndustries,
  onApply,
  onSave,
  onViewDetails,
  pageSize = 25,
}: JobListProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>('matchScore');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filterType, setFilterType] = useState<string>('all');
  const [showDreamOnly, setShowDreamOnly] = useState(false);
  const [savedJobs, setSavedJobs] = useState<Set<string>>(new Set());

  // Calculate match scores based on filter weights
  const jobsWithScores = useMemo(() => {
    return jobs.map(job => ({
      ...job,
      matchScore: calculateMatchScore(job, filterWeights),
    }));
  }, [jobs, filterWeights]);

  // Filter and sort jobs
  const filteredJobs = useMemo(() => {
    let result = [...jobsWithScores];

    // Filter by job type
    if (filterType !== 'all') {
      result = result.filter(job => job.type === filterType);
    }

    // Filter by dream companies
    if (showDreamOnly) {
      result = result.filter(job => job.isDreamCompany);
    }

    // Sort jobs
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'matchScore':
          comparison = (a.matchScore || 0) - (b.matchScore || 0);
          break;
        case 'postedDate':
          comparison = new Date(a.postedDate || 0).getTime() - new Date(b.postedDate || 0).getTime();
          break;
        case 'company':
          comparison = a.company.localeCompare(b.company);
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
      }
      return sortDirection === 'desc' ? -comparison : comparison;
    });

    return result;
  }, [jobsWithScores, filterType, showDreamOnly, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredJobs.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedJobs = filteredJobs.slice(startIndex, startIndex + pageSize);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleSaveJob = (job: JobPosting) => {
    setSavedJobs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(job.id)) {
        newSet.delete(job.id);
      } else {
        newSet.add(job.id);
      }
      return newSet;
    });
    onSave(job);
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return '↕';
    return sortDirection === 'desc' ? '↓' : '↑';
  };

  const getMatchScoreColor = (score: number): string => {
    if (score >= 80) return '#10b981';
    if (score >= 60) return '#667eea';
    if (score >= 40) return '#f59e0b';
    return '#ef4444';
  };

  const getJobTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      'full-time': 'Full-time',
      'part-time': 'Part-time',
      'contract': 'Contract',
      'internship': 'Internship',
      'unknown': 'Unknown',
    };
    return labels[type] || type;
  };

  return (
    <div className="job-list">
      {/* Filters & Controls */}
      <div className="list-controls">
        <div className="filter-row">
          <div className="filter-group">
            <label>Job Type:</label>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="all">All Types</option>
              <option value="full-time">Full-time</option>
              <option value="part-time">Part-time</option>
              <option value="contract">Contract</option>
              <option value="internship">Internship</option>
            </select>
          </div>

          <div className="filter-group checkbox">
            <input
              type="checkbox"
              id="dreamOnly"
              checked={showDreamOnly}
              onChange={(e) => setShowDreamOnly(e.target.checked)}
            />
            <label htmlFor="dreamOnly">⭐ Dream Companies Only</label>
          </div>

          <div className="results-count">
            Showing {paginatedJobs.length} of {filteredJobs.length} jobs
          </div>
        </div>
      </div>

      {/* Column Headers */}
      <div className="list-header">
        <div className="col-match" onClick={() => handleSort('matchScore')}>
          Match {getSortIcon('matchScore')}
        </div>
        <div className="col-job" onClick={() => handleSort('title')}>
          Job {getSortIcon('title')}
        </div>
        <div className="col-company" onClick={() => handleSort('company')}>
          Company {getSortIcon('company')}
        </div>
        <div className="col-location">Location</div>
        <div className="col-type">Type</div>
        <div className="col-date" onClick={() => handleSort('postedDate')}>
          Posted {getSortIcon('postedDate')}
        </div>
        <div className="col-actions">Actions</div>
      </div>

      {/* Job List */}
      {paginatedJobs.length === 0 ? (
        <div className="empty-state">
          <p>No jobs found matching your criteria.</p>
          <p className="hint">Try adjusting your filters or adding more companies to track.</p>
        </div>
      ) : (
        <div className="jobs">
          {paginatedJobs.map(job => (
            <div 
              key={job.id} 
              className={`job-row ${job.isNew ? 'new' : ''} ${job.isDreamCompany ? 'dream' : ''}`}
              onClick={() => onViewDetails(job)}
            >
              <div className="col-match">
                <div 
                  className="match-badge"
                  style={{ background: getMatchScoreColor(job.matchScore || 0) }}
                >
                  {job.matchScore || 0}%
                </div>
              </div>
              <div className="col-job">
                <div className="job-title">
                  {job.isNew && <span className="new-badge">NEW</span>}
                  {job.title}
                </div>
                {job.salary && <div className="job-salary">{job.salary}</div>}
              </div>
              <div className="col-company">
                <div className="company-name">
                  {job.isDreamCompany && <span className="dream-star">⭐</span>}
                  {job.company}
                </div>
              </div>
              <div className="col-location">{job.location}</div>
              <div className="col-type">
                <span className={`type-badge ${job.type}`}>
                  {getJobTypeLabel(job.type)}
                </span>
              </div>
              <div className="col-date">
                {job.postedDate ? new Date(job.postedDate).toLocaleDateString() : '-'}
              </div>
              <div className="col-actions" onClick={(e) => e.stopPropagation()}>
                <button 
                  className={`action-btn save ${savedJobs.has(job.id) ? 'saved' : ''}`}
                  onClick={() => handleSaveJob(job)}
                  title={savedJobs.has(job.id) ? 'Unsave' : 'Save for later'}
                >
                  {savedJobs.has(job.id) ? '★' : '☆'}
                </button>
                <button 
                  className="action-btn apply"
                  onClick={() => onApply(job)}
                  title="Apply now"
                >
                  Apply
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
          >
            ««
          </button>
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            «
          </button>
          
          <div className="page-numbers">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  className={currentPage === pageNum ? 'active' : ''}
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
          >
            »
          </button>
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
          >
            »»
          </button>

          <span className="page-info">
            Page {currentPage} of {totalPages}
          </span>
        </div>
      )}

      <style>{`
        .job-list {
          background: white;
          border-radius: 12px;
          overflow: hidden;
        }

        .list-controls {
          padding: 16px 20px;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
        }

        .filter-row {
          display: flex;
          align-items: center;
          gap: 20px;
          flex-wrap: wrap;
        }

        .filter-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .filter-group label {
          font-size: 13px;
          color: #64748b;
        }

        .filter-group select {
          padding: 6px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          font-size: 13px;
          background: white;
        }

        .filter-group.checkbox {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .filter-group.checkbox input {
          width: 16px;
          height: 16px;
          accent-color: #667eea;
        }

        .results-count {
          margin-left: auto;
          font-size: 13px;
          color: #94a3b8;
        }

        .list-header {
          display: grid;
          grid-template-columns: 70px 1fr 150px 120px 100px 100px 120px;
          padding: 12px 20px;
          background: #f1f5f9;
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .list-header > div {
          cursor: pointer;
          user-select: none;
        }

        .list-header > div:hover {
          color: #334155;
        }

        .jobs {
          max-height: 600px;
          overflow-y: auto;
        }

        .job-row {
          display: grid;
          grid-template-columns: 70px 1fr 150px 120px 100px 100px 120px;
          padding: 14px 20px;
          border-bottom: 1px solid #f1f5f9;
          cursor: pointer;
          transition: background 0.2s;
          align-items: center;
        }

        .job-row:hover {
          background: #f8fafc;
        }

        .job-row.new {
          background: #f0fdf4;
        }

        .job-row.dream {
          border-left: 3px solid #fcd34d;
        }

        .match-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 28px;
          border-radius: 14px;
          color: white;
          font-size: 12px;
          font-weight: 600;
        }

        .job-title {
          font-size: 14px;
          font-weight: 500;
          color: #334155;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .new-badge {
          font-size: 9px;
          font-weight: 700;
          padding: 2px 6px;
          background: #10b981;
          color: white;
          border-radius: 4px;
        }

        .job-salary {
          font-size: 12px;
          color: #10b981;
          margin-top: 2px;
        }

        .company-name {
          font-size: 13px;
          color: #475569;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .dream-star {
          font-size: 12px;
        }

        .col-location,
        .col-date {
          font-size: 13px;
          color: #64748b;
        }

        .type-badge {
          font-size: 11px;
          padding: 4px 8px;
          border-radius: 4px;
          background: #e2e8f0;
          color: #475569;
        }

        .type-badge.full-time {
          background: #d1fae5;
          color: #065f46;
        }

        .type-badge.internship {
          background: #e0e7ff;
          color: #3730a3;
        }

        .type-badge.contract {
          background: #fef3c7;
          color: #92400e;
        }

        .col-actions {
          display: flex;
          gap: 8px;
        }

        .action-btn {
          padding: 6px 12px;
          border: none;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .action-btn.save {
          background: #f8fafc;
          color: #f59e0b;
          border: 1px solid #e2e8f0;
        }

        .action-btn.save.saved {
          background: #fef3c7;
          color: #d97706;
        }

        .action-btn.apply {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .action-btn:hover {
          transform: translateY(-1px);
        }

        .empty-state {
          text-align: center;
          padding: 48px;
          color: #94a3b8;
        }

        .empty-state .hint {
          margin-top: 8px;
          font-size: 13px;
        }

        .pagination {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          padding: 16px;
          background: #f8fafc;
          border-top: 1px solid #e2e8f0;
        }

        .pagination button {
          min-width: 36px;
          height: 36px;
          padding: 0 8px;
          border: 1px solid #e2e8f0;
          background: white;
          border-radius: 6px;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .pagination button:hover:not(:disabled) {
          border-color: #667eea;
          color: #667eea;
        }

        .pagination button.active {
          background: #667eea;
          color: white;
          border-color: #667eea;
        }

        .pagination button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .page-numbers {
          display: flex;
          gap: 4px;
        }

        .page-info {
          margin-left: 16px;
          font-size: 13px;
          color: #64748b;
        }
      `}</style>
    </div>
  );
}

/**
 * Calculate match score based on job posting and filter weights
 */
function calculateMatchScore(job: JobPosting, weights: FilterWeights): number {
  // This is a simplified scoring algorithm
  // In production, this would analyze job requirements against user profile
  
  let score = 50; // Base score

  // Boost for dream companies
  if (job.isDreamCompany) {
    score += 15;
  }

  // Boost for new jobs
  if (job.isNew) {
    score += 5;
  }

  // Add some variance based on job properties
  if (job.type === 'full-time') {
    score += 5;
  }

  // Apply weight modifiers (simplified)
  score = Math.min(100, Math.max(0, score + (weights.skillMatch - 50) * 0.2));

  return Math.round(score);
}

export default JobList;
