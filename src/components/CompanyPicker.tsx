import { useState } from 'react';
import { Company, Industry, DEFAULT_INDUSTRIES } from '../lib/heartbeat';

interface CompanyPickerProps {
  companies: Company[];
  industries: Industry[];
  selectedIndustries: string[];
  onAddCompany: (company: Omit<Company, 'id'>) => void;
  onRemoveCompany: (id: string) => void;
  onToggleDreamCompany: (id: string) => void;
  onIndustryChange: (industryIds: string[]) => void;
}

export function CompanyPicker({
  companies,
  industries = DEFAULT_INDUSTRIES,
  selectedIndustries,
  onAddCompany,
  onRemoveCompany,
  onToggleDreamCompany,
  onIndustryChange,
}: CompanyPickerProps) {
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyCareersUrl, setNewCompanyCareersUrl] = useState('');
  const [newCompanyIsDream, setNewCompanyIsDream] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const dreamCompanies = companies.filter(c => c.isDreamCompany);
  const baselineCompanies = companies.filter(c => !c.isDreamCompany);

  const handleAddCompany = () => {
    if (!newCompanyName.trim()) return;

    onAddCompany({
      name: newCompanyName.trim(),
      careersUrl: newCompanyCareersUrl.trim() || undefined,
      isDreamCompany: newCompanyIsDream,
    });

    setNewCompanyName('');
    setNewCompanyCareersUrl('');
    setNewCompanyIsDream(false);
    setShowAddForm(false);
  };

  const toggleIndustry = (industryId: string) => {
    if (selectedIndustries.includes(industryId)) {
      onIndustryChange(selectedIndustries.filter(id => id !== industryId));
    } else {
      onIndustryChange([...selectedIndustries, industryId]);
    }
  };

  return (
    <div className="company-picker">
      {/* Industry Selector */}
      <div className="section">
        <div className="section-header">
          <h3>🏭 Industries</h3>
          <span className="count">{selectedIndustries.length} selected</span>
        </div>
        <p className="hint">Select industries to focus your job search</p>
        
        <div className="industry-chips">
          {industries.map(industry => (
            <button
              key={industry.id}
              className={`industry-chip ${selectedIndustries.includes(industry.id) ? 'active' : ''}`}
              onClick={() => toggleIndustry(industry.id)}
            >
              {industry.name}
            </button>
          ))}
        </div>
      </div>

      {/* Dream Companies */}
      <div className="section">
        <div className="section-header">
          <h3>⭐ Dream Companies</h3>
          <span className="count">{dreamCompanies.length} companies</span>
        </div>
        <p className="hint">
          Companies you really want to work for. We'll check these more frequently!
        </p>
        
        {dreamCompanies.length === 0 ? (
          <div className="empty-state">
            <p>No dream companies yet. Add companies you'd love to work for!</p>
          </div>
        ) : (
          <div className="company-list">
            {dreamCompanies.map(company => (
              <CompanyCard
                key={company.id}
                company={company}
                onRemove={onRemoveCompany}
                onToggleDream={onToggleDreamCompany}
              />
            ))}
          </div>
        )}
      </div>

      {/* Baseline Companies */}
      <div className="section">
        <div className="section-header">
          <h3>🏢 Baseline Companies</h3>
          <span className="count">{baselineCompanies.length} companies</span>
        </div>
        <p className="hint">
          Other companies you're interested in. We'll check these on the regular schedule.
        </p>
        
        {baselineCompanies.length === 0 ? (
          <div className="empty-state">
            <p>No baseline companies yet. Add companies you'd consider working for.</p>
          </div>
        ) : (
          <div className="company-list">
            {baselineCompanies.map(company => (
              <CompanyCard
                key={company.id}
                company={company}
                onRemove={onRemoveCompany}
                onToggleDream={onToggleDreamCompany}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add Company Form */}
      {showAddForm ? (
        <div className="add-form">
          <h4>Add Company</h4>
          <div className="form-row">
            <input
              type="text"
              placeholder="Company name *"
              value={newCompanyName}
              onChange={(e) => setNewCompanyName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddCompany()}
            />
          </div>
          <div className="form-row">
            <input
              type="url"
              placeholder="Careers page URL (optional)"
              value={newCompanyCareersUrl}
              onChange={(e) => setNewCompanyCareersUrl(e.target.value)}
            />
          </div>
          <div className="form-row checkbox">
            <input
              type="checkbox"
              id="isDreamCompany"
              checked={newCompanyIsDream}
              onChange={(e) => setNewCompanyIsDream(e.target.checked)}
            />
            <label htmlFor="isDreamCompany">⭐ This is a dream company</label>
          </div>
          <div className="form-actions">
            <button className="cancel-btn" onClick={() => setShowAddForm(false)}>
              Cancel
            </button>
            <button className="add-btn" onClick={handleAddCompany} disabled={!newCompanyName.trim()}>
              Add Company
            </button>
          </div>
        </div>
      ) : (
        <button className="show-add-btn" onClick={() => setShowAddForm(true)}>
          + Add Company
        </button>
      )}

      <style>{`
        .company-picker {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .section {
          background: #f8fafc;
          border-radius: 12px;
          padding: 20px;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
        }

        .section-header h3 {
          margin: 0;
          padding: 0;
          border: none;
          font-size: 16px;
          color: #334155;
        }

        .count {
          font-size: 12px;
          color: #667eea;
          background: #eef2ff;
          padding: 4px 10px;
          border-radius: 12px;
        }

        .hint {
          font-size: 12px;
          color: #94a3b8;
          margin-bottom: 16px;
        }

        .industry-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .industry-chip {
          padding: 8px 14px;
          border: 1px solid #e2e8f0;
          background: white;
          border-radius: 20px;
          font-size: 13px;
          color: #64748b;
          cursor: pointer;
          transition: all 0.2s;
        }

        .industry-chip:hover {
          border-color: #667eea;
          color: #667eea;
        }

        .industry-chip.active {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-color: transparent;
        }

        .company-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .company-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 12px 16px;
        }

        .company-info {
          flex: 1;
        }

        .company-name {
          font-size: 14px;
          font-weight: 600;
          color: #334155;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .company-url {
          font-size: 11px;
          color: #667eea;
          text-decoration: none;
          margin-top: 2px;
          display: block;
        }

        .company-url:hover {
          text-decoration: underline;
        }

        .company-meta {
          font-size: 11px;
          color: #94a3b8;
          margin-top: 4px;
        }

        .company-actions {
          display: flex;
          gap: 8px;
        }

        .action-btn {
          width: 32px;
          height: 32px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .dream-btn {
          background: #fef3c7;
          color: #d97706;
        }

        .dream-btn.active {
          background: #fcd34d;
          color: #92400e;
        }

        .dream-btn:hover {
          transform: scale(1.1);
        }

        .remove-btn {
          background: #fee2e2;
          color: #ef4444;
        }

        .remove-btn:hover {
          background: #ef4444;
          color: white;
        }

        .empty-state {
          text-align: center;
          padding: 24px;
          color: #94a3b8;
          font-size: 13px;
        }

        .add-form {
          background: white;
          border: 2px dashed #e2e8f0;
          border-radius: 12px;
          padding: 20px;
        }

        .add-form h4 {
          margin: 0 0 16px 0;
          font-size: 14px;
          color: #334155;
        }

        .form-row {
          margin-bottom: 12px;
        }

        .form-row input[type="text"],
        .form-row input[type="url"] {
          width: 100%;
          padding: 10px 14px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 14px;
        }

        .form-row input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .form-row.checkbox {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .form-row.checkbox input {
          width: 16px;
          height: 16px;
          accent-color: #667eea;
        }

        .form-row.checkbox label {
          font-size: 13px;
          color: #334155;
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 16px;
        }

        .cancel-btn {
          padding: 8px 16px;
          border: 1px solid #e2e8f0;
          background: white;
          border-radius: 8px;
          font-size: 13px;
          color: #64748b;
          cursor: pointer;
        }

        .cancel-btn:hover {
          background: #f8fafc;
        }

        .add-btn {
          padding: 8px 16px;
          border: none;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 8px;
          font-size: 13px;
          color: white;
          cursor: pointer;
        }

        .add-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .show-add-btn {
          width: 100%;
          padding: 14px;
          border: 2px dashed #e2e8f0;
          background: transparent;
          border-radius: 12px;
          font-size: 14px;
          color: #64748b;
          cursor: pointer;
          transition: all 0.2s;
        }

        .show-add-btn:hover {
          border-color: #667eea;
          color: #667eea;
        }
      `}</style>
    </div>
  );
}

interface CompanyCardProps {
  company: Company;
  onRemove: (id: string) => void;
  onToggleDream: (id: string) => void;
}

function CompanyCard({ company, onRemove, onToggleDream }: CompanyCardProps) {
  return (
    <div className="company-card">
      <div className="company-info">
        <div className="company-name">
          {company.isDreamCompany && <span>⭐</span>}
          {company.name}
        </div>
        {company.careersUrl && (
          <a href={company.careersUrl} target="_blank" rel="noopener noreferrer" className="company-url">
            {company.careersUrl}
          </a>
        )}
        {company.lastChecked && (
          <div className="company-meta">
            Last checked: {new Date(company.lastChecked).toLocaleDateString()}
            {company.lastJobCount !== undefined && ` • ${company.lastJobCount} jobs found`}
          </div>
        )}
      </div>
      <div className="company-actions">
        <button
          className={`action-btn dream-btn ${company.isDreamCompany ? 'active' : ''}`}
          onClick={() => onToggleDream(company.id)}
          title={company.isDreamCompany ? 'Remove from dream companies' : 'Add to dream companies'}
        >
          ⭐
        </button>
        <button
          className="action-btn remove-btn"
          onClick={() => onRemove(company.id)}
          title="Remove company"
        >
          ×
        </button>
      </div>
    </div>
  );
}

export default CompanyPicker;
