import { useState, useEffect } from 'react';
import { FilterSliders, FilterWeights, DEFAULT_FILTER_WEIGHTS } from './FilterSliders';
import { CompanyPicker } from './CompanyPicker';
import { JobList } from './JobList';
import { 
  HeartbeatConfig, 
  HeartbeatResult,
  JobPosting, 
  Company, 
  Industry,
  DEFAULT_HEARTBEAT_CONFIG,
  DEFAULT_INDUSTRIES,
  getHeartbeatManager,
  HEARTBEAT_STORAGE_KEYS,
} from '../lib/heartbeat';
import { ApplicationRecord } from '../lib/types';
import { storage, generateId } from '../lib/storage';

interface JobFinderProps {
  onNavigateToApplication?: (job: JobPosting) => void;
}

type ActiveTab = 'jobs' | 'companies' | 'settings' | 'logs';

export function JobFinder({ onNavigateToApplication }: JobFinderProps) {
  // State
  const [activeTab, setActiveTab] = useState<ActiveTab>('jobs');
  const [filterWeights, setFilterWeights] = useState<FilterWeights>(DEFAULT_FILTER_WEIGHTS);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [industries, setIndustries] = useState<Industry[]>(DEFAULT_INDUSTRIES);
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [heartbeatConfig, setHeartbeatConfig] = useState<HeartbeatConfig>(DEFAULT_HEARTBEAT_CONFIG);
  const [isLoading, setIsLoading] = useState(false);
  const [lastPulse, setLastPulse] = useState<Date | null>(null);
  const [applicationLogs, setApplicationLogs] = useState<ApplicationRecord[]>([]);
  const [, setPulseResults] = useState<HeartbeatResult[]>([]);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load from storage
      const stored = await chrome.storage.local.get([
        HEARTBEAT_STORAGE_KEYS.CONFIG,
        HEARTBEAT_STORAGE_KEYS.COMPANIES,
        HEARTBEAT_STORAGE_KEYS.INDUSTRIES,
        HEARTBEAT_STORAGE_KEYS.LAST_RESULTS,
        'filterWeights',
        'selectedIndustries',
      ]);

      if (stored[HEARTBEAT_STORAGE_KEYS.CONFIG]) {
        setHeartbeatConfig({ ...DEFAULT_HEARTBEAT_CONFIG, ...stored[HEARTBEAT_STORAGE_KEYS.CONFIG] });
      }
      if (stored[HEARTBEAT_STORAGE_KEYS.COMPANIES]) {
        setCompanies(stored[HEARTBEAT_STORAGE_KEYS.COMPANIES]);
      }
      if (stored[HEARTBEAT_STORAGE_KEYS.INDUSTRIES]) {
        setIndustries(stored[HEARTBEAT_STORAGE_KEYS.INDUSTRIES]);
      }
      if (stored[HEARTBEAT_STORAGE_KEYS.LAST_RESULTS]) {
        setPulseResults(stored[HEARTBEAT_STORAGE_KEYS.LAST_RESULTS]);
        // Extract jobs from results
        const allJobs = stored[HEARTBEAT_STORAGE_KEYS.LAST_RESULTS].flatMap(
          (r: HeartbeatResult) => r.jobs
        );
        setJobs(allJobs);
      }
      if (stored.filterWeights) {
        setFilterWeights({ ...DEFAULT_FILTER_WEIGHTS, ...stored.filterWeights });
      }
      if (stored.selectedIndustries) {
        setSelectedIndustries(stored.selectedIndustries);
      }

      // Load application logs
      const apps = await storage.getApplications();
      setApplicationLogs(apps);
    } catch (error) {
      console.error('Error loading job finder data:', error);
    }
    setIsLoading(false);
  };

  // Save filter weights
  const handleFilterWeightsChange = async (weights: FilterWeights) => {
    setFilterWeights(weights);
    await chrome.storage.local.set({ filterWeights: weights });
  };

  // Add company
  const handleAddCompany = async (company: Omit<Company, 'id'>) => {
    const newCompany: Company = {
      ...company,
      id: `company_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
    const updated = [...companies, newCompany];
    setCompanies(updated);
    await chrome.storage.local.set({ [HEARTBEAT_STORAGE_KEYS.COMPANIES]: updated });
  };

  // Remove company
  const handleRemoveCompany = async (id: string) => {
    const updated = companies.filter(c => c.id !== id);
    setCompanies(updated);
    await chrome.storage.local.set({ [HEARTBEAT_STORAGE_KEYS.COMPANIES]: updated });
  };

  // Toggle dream company
  const handleToggleDreamCompany = async (id: string) => {
    const updated = companies.map(c => 
      c.id === id ? { ...c, isDreamCompany: !c.isDreamCompany } : c
    );
    setCompanies(updated);
    await chrome.storage.local.set({ [HEARTBEAT_STORAGE_KEYS.COMPANIES]: updated });
  };

  // Change selected industries
  const handleIndustryChange = async (industryIds: string[]) => {
    setSelectedIndustries(industryIds);
    await chrome.storage.local.set({ selectedIndustries: industryIds });
  };

  // Update heartbeat config
  const handleConfigChange = async (updates: Partial<HeartbeatConfig>) => {
    const updated = { ...heartbeatConfig, ...updates };
    setHeartbeatConfig(updated);
    await chrome.storage.local.set({ [HEARTBEAT_STORAGE_KEYS.CONFIG]: updated });
  };

  // Manual pulse
  const handleManualPulse = async () => {
    setIsLoading(true);
    try {
      const manager = getHeartbeatManager();
      await manager.init();
      const results = await manager.pulse(false);
      setPulseResults(results);
      
      // Extract all jobs from results
      const allJobs = results.flatMap(r => r.jobs);
      setJobs(allJobs);
      
      setLastPulse(new Date());
    } catch (error) {
      console.error('Pulse error:', error);
    }
    setIsLoading(false);
  };

  // Apply to job
  const handleApply = async (job: JobPosting) => {
    // Create application record
    const record: ApplicationRecord = {
      id: generateId(),
      companyName: job.company,
      jobTitle: job.title,
      jobUrl: job.url,
      appliedAt: new Date().toISOString(),
      status: 'in_progress',
      aiResponsesUsed: [],
    };
    
    await storage.saveApplication(record);
    setApplicationLogs(prev => [record, ...prev]);

    // Navigate to application if handler provided
    if (onNavigateToApplication) {
      onNavigateToApplication(job);
    } else {
      window.open(job.url, '_blank');
    }
  };

  // Save job for later
  const handleSaveJob = async (job: JobPosting) => {
    const record: ApplicationRecord = {
      id: generateId(),
      companyName: job.company,
      jobTitle: job.title,
      jobUrl: job.url,
      appliedAt: new Date().toISOString(),
      status: 'saved',
      aiResponsesUsed: [],
    };
    
    await storage.saveApplication(record);
    setApplicationLogs(prev => [record, ...prev]);
  };

  // View job details
  const handleViewDetails = (job: JobPosting) => {
    window.open(job.url, '_blank');
  };

  return (
    <div className="job-finder">
      {/* Header */}
      <div className="finder-header">
        <div className="header-content">
          <h2>🔍 Job Finder</h2>
          <p className="description">
            Track companies, find matching jobs, and apply with AI assistance
          </p>
        </div>
        <div className="header-actions">
          <div className="pulse-status">
            {heartbeatConfig.enabled ? (
              <span className="status-badge active">
                <span className="pulse-dot"></span>
                Heartbeat Active
              </span>
            ) : (
              <span className="status-badge inactive">Heartbeat Paused</span>
            )}
            {lastPulse && (
              <span className="last-pulse">
                Last check: {lastPulse.toLocaleTimeString()}
              </span>
            )}
          </div>
          <button 
            className="pulse-btn" 
            onClick={handleManualPulse}
            disabled={isLoading}
          >
            {isLoading ? '⟳ Checking...' : '⟳ Check Now'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="finder-tabs">
        <button 
          className={activeTab === 'jobs' ? 'active' : ''}
          onClick={() => setActiveTab('jobs')}
        >
          📋 Jobs ({jobs.length})
        </button>
        <button 
          className={activeTab === 'companies' ? 'active' : ''}
          onClick={() => setActiveTab('companies')}
        >
          🏢 Companies ({companies.length})
        </button>
        <button 
          className={activeTab === 'settings' ? 'active' : ''}
          onClick={() => setActiveTab('settings')}
        >
          ⚙️ Settings
        </button>
        <button 
          className={activeTab === 'logs' ? 'active' : ''}
          onClick={() => setActiveTab('logs')}
        >
          📜 Logs ({applicationLogs.length})
        </button>
      </div>

      {/* Content */}
      <div className="finder-content">
        {activeTab === 'jobs' && (
          <div className="jobs-tab">
            <FilterSliders
              weights={filterWeights}
              onChange={handleFilterWeightsChange}
              disabled={isLoading}
            />
            <JobList
              jobs={jobs}
              filterWeights={filterWeights}
              selectedIndustries={selectedIndustries}
              onApply={handleApply}
              onSave={handleSaveJob}
              onViewDetails={handleViewDetails}
              pageSize={25}
            />
          </div>
        )}

        {activeTab === 'companies' && (
          <CompanyPicker
            companies={companies}
            industries={industries}
            selectedIndustries={selectedIndustries}
            onAddCompany={handleAddCompany}
            onRemoveCompany={handleRemoveCompany}
            onToggleDreamCompany={handleToggleDreamCompany}
            onIndustryChange={handleIndustryChange}
          />
        )}

        {activeTab === 'settings' && (
          <div className="settings-tab">
            <div className="settings-section">
              <h3>💓 Heartbeat Settings</h3>
              <p className="hint">
                The heartbeat system periodically checks your tracked companies for new job postings.
              </p>

              <div className="setting-row">
                <div className="setting-info">
                  <label>Enable Heartbeat</label>
                  <p>Automatically check for new jobs</p>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={heartbeatConfig.enabled}
                    onChange={(e) => handleConfigChange({ enabled: e.target.checked })}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              <div className="setting-row">
                <div className="setting-info">
                  <label>Check Frequency</label>
                  <p>How often to check for new jobs (all companies)</p>
                </div>
                <div className="setting-control">
                  <input
                    type="number"
                    min="15"
                    max="240"
                    value={heartbeatConfig.frequencyMinutes}
                    onChange={(e) => handleConfigChange({ 
                      frequencyMinutes: parseInt(e.target.value) || 60 
                    })}
                  />
                  <span>minutes</span>
                </div>
              </div>

              <div className="setting-row">
                <div className="setting-info">
                  <label>Dream Company Frequency</label>
                  <p>Check dream companies more frequently</p>
                </div>
                <div className="setting-control">
                  <input
                    type="number"
                    min="5"
                    max="120"
                    value={heartbeatConfig.dreamCompanyFrequencyMinutes}
                    onChange={(e) => handleConfigChange({ 
                      dreamCompanyFrequencyMinutes: parseInt(e.target.value) || 30 
                    })}
                  />
                  <span>minutes</span>
                </div>
              </div>

              <div className="setting-row">
                <div className="setting-info">
                  <label>Notify on New Jobs</label>
                  <p>Get notified when new jobs are found</p>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={heartbeatConfig.notifyOnNewJobs}
                    onChange={(e) => handleConfigChange({ notifyOnNewJobs: e.target.checked })}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              <div className="setting-row">
                <div className="setting-info">
                  <label>Notify for Dream Companies</label>
                  <p>Extra notification for dream company jobs</p>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={heartbeatConfig.notifyOnDreamCompanyJobs}
                    onChange={(e) => handleConfigChange({ notifyOnDreamCompanyJobs: e.target.checked })}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="logs-tab">
            <div className="logs-header">
              <h3>📜 Application Logs</h3>
              <p className="hint">Track your job applications and their status</p>
            </div>

            {applicationLogs.length === 0 ? (
              <div className="empty-state">
                <p>No applications yet. Start applying to jobs!</p>
              </div>
            ) : (
              <div className="logs-list">
                {applicationLogs.map(log => (
                  <div key={log.id} className={`log-item ${log.status}`}>
                    <div className="log-main">
                      <div className="log-title">{log.jobTitle}</div>
                      <div className="log-company">{log.companyName}</div>
                    </div>
                    <div className="log-meta">
                      <span className={`status-badge ${log.status}`}>
                        {log.status === 'applied' && '✓ Applied'}
                        {log.status === 'in_progress' && '⏳ In Progress'}
                        {log.status === 'saved' && '★ Saved'}
                      </span>
                      <span className="log-date">
                        {new Date(log.appliedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <a href={log.jobUrl} target="_blank" rel="noopener noreferrer" className="log-link">
                      View →
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        .job-finder {
          background: white;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .finder-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 24px 32px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .header-content h2 {
          margin: 0 0 4px 0;
          font-size: 24px;
        }

        .header-content .description {
          margin: 0;
          opacity: 0.9;
          font-size: 14px;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .pulse-status {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;
        }

        .status-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          padding: 4px 10px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.2);
        }

        .status-badge.active {
          background: rgba(16, 185, 129, 0.3);
        }

        .status-badge.inactive {
          background: rgba(255, 255, 255, 0.2);
        }

        .pulse-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #10b981;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .last-pulse {
          font-size: 11px;
          opacity: 0.8;
        }

        .pulse-btn {
          padding: 10px 20px;
          border: 2px solid rgba(255, 255, 255, 0.5);
          background: transparent;
          color: white;
          border-radius: 10px;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .pulse-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.2);
          border-color: white;
        }

        .pulse-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .finder-tabs {
          display: flex;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
        }

        .finder-tabs button {
          flex: 1;
          padding: 16px;
          border: none;
          background: transparent;
          font-size: 14px;
          color: #64748b;
          cursor: pointer;
          transition: all 0.2s;
          border-bottom: 2px solid transparent;
        }

        .finder-tabs button:hover {
          color: #334155;
          background: white;
        }

        .finder-tabs button.active {
          color: #667eea;
          background: white;
          border-bottom-color: #667eea;
        }

        .finder-content {
          padding: 24px;
        }

        .jobs-tab {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .settings-tab {
          max-width: 600px;
        }

        .settings-section {
          background: #f8fafc;
          border-radius: 12px;
          padding: 20px;
        }

        .settings-section h3 {
          margin: 0 0 4px 0;
          padding: 0;
          border: none;
          font-size: 16px;
          color: #334155;
        }

        .settings-section > .hint {
          margin-bottom: 20px;
        }

        .setting-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          background: white;
          border-radius: 10px;
          margin-bottom: 8px;
          border: 1px solid #e2e8f0;
        }

        .setting-info label {
          font-size: 14px;
          font-weight: 500;
          color: #334155;
          display: block;
        }

        .setting-info p {
          font-size: 12px;
          color: #94a3b8;
          margin: 4px 0 0 0;
        }

        .setting-control {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .setting-control input[type="number"] {
          width: 80px;
          padding: 8px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          font-size: 14px;
          text-align: center;
        }

        .setting-control span {
          font-size: 13px;
          color: #64748b;
        }

        .toggle {
          position: relative;
          display: inline-block;
          width: 48px;
          height: 26px;
        }

        .toggle input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .toggle-slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #e2e8f0;
          transition: 0.3s;
          border-radius: 26px;
        }

        .toggle-slider:before {
          position: absolute;
          content: "";
          height: 20px;
          width: 20px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: 0.3s;
          border-radius: 50%;
        }

        .toggle input:checked + .toggle-slider {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        .toggle input:checked + .toggle-slider:before {
          transform: translateX(22px);
        }

        .logs-tab {
          background: #f8fafc;
          border-radius: 12px;
          padding: 20px;
        }

        .logs-header {
          margin-bottom: 20px;
        }

        .logs-header h3 {
          margin: 0 0 4px 0;
          padding: 0;
          border: none;
          font-size: 16px;
          color: #334155;
        }

        .logs-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .log-item {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 14px 16px;
          background: white;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
        }

        .log-item.saved {
          border-left: 3px solid #f59e0b;
        }

        .log-item.applied {
          border-left: 3px solid #10b981;
        }

        .log-main {
          flex: 1;
        }

        .log-title {
          font-size: 14px;
          font-weight: 500;
          color: #334155;
        }

        .log-company {
          font-size: 12px;
          color: #64748b;
          margin-top: 2px;
        }

        .log-meta {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;
        }

        .log-meta .status-badge {
          font-size: 11px;
          padding: 4px 8px;
          border-radius: 4px;
        }

        .log-meta .status-badge.applied {
          background: #d1fae5;
          color: #065f46;
        }

        .log-meta .status-badge.in_progress {
          background: #fef3c7;
          color: #92400e;
        }

        .log-meta .status-badge.saved {
          background: #e0e7ff;
          color: #3730a3;
        }

        .log-date {
          font-size: 11px;
          color: #94a3b8;
        }

        .log-link {
          font-size: 12px;
          color: #667eea;
          text-decoration: none;
        }

        .log-link:hover {
          text-decoration: underline;
        }

        .empty-state {
          text-align: center;
          padding: 48px;
          color: #94a3b8;
        }

        .hint {
          font-size: 12px;
          color: #94a3b8;
        }
      `}</style>
    </div>
  );
}

export default JobFinder;
