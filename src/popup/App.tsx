import React, { useEffect, useState } from 'react';
import { storage } from '../lib/storage';
import { UserProfile, Settings, DEFAULT_PROFILE, DEFAULT_SETTINGS } from '../lib/types';

interface PageInfo {
  fields: Array<{ fieldType: string; label: string; isRequired: boolean }>;
  jobInfo: { company: string; title: string };
}

export default function App() {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'fill' | 'profile' | 'settings'>('fill');

  useEffect(() => {
    // Load profile and settings
    Promise.all([storage.getProfile(), storage.getSettings()])
      .then(([p, s]) => {
        setProfile(p);
        setSettings(s);
      });

    // Get page info from content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_FIELDS' }, (response) => {
          if (response) {
            setPageInfo(response);
          }
        });
      }
    });
  }, []);

  const handleFillAll = async () => {
    if (!profile.firstName || !profile.email) {
      setStatus('error');
      setMessage('Please complete your profile first!');
      setActiveTab('profile');
      return;
    }

    setStatus('loading');
    setMessage('Filling forms...');

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'FILL_ALL' }, (response) => {
          if (response?.success) {
            setStatus('success');
            setMessage('Forms filled successfully!');
          } else {
            setStatus('error');
            setMessage('Some fields could not be filled.');
          }
        });
      }
    });
  };

  const handleRefresh = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'REFRESH_DETECTION' }, (response) => {
          if (response) {
            setMessage(`Found ${response.count} fields`);
          }
        });
      }
    });
  };

  const handleProfileChange = (field: keyof UserProfile, value: string) => {
    const newProfile = { ...profile, [field]: value };
    setProfile(newProfile);
    storage.saveProfile(newProfile);
  };

  const handleSkillsChange = (value: string) => {
    const skills = value.split(',').map(s => s.trim()).filter(Boolean);
    const newProfile = { ...profile, skills };
    setProfile(newProfile);
    storage.saveProfile(newProfile);
  };

  const profileComplete = profile.firstName && profile.email && profile.university;

  return (
    <div className="popup">
      <header className="header">
        <div className="logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
          </svg>
          <span>AI Job Applier</span>
        </div>
        {!profileComplete && (
          <span className="badge warning">Setup needed</span>
        )}
      </header>

      <nav className="tabs">
        <button 
          className={activeTab === 'fill' ? 'active' : ''} 
          onClick={() => setActiveTab('fill')}
        >
          Fill
        </button>
        <button 
          className={activeTab === 'profile' ? 'active' : ''} 
          onClick={() => setActiveTab('profile')}
        >
          Profile
        </button>
        <button 
          className={activeTab === 'settings' ? 'active' : ''} 
          onClick={() => setActiveTab('settings')}
        >
          Settings
        </button>
      </nav>

      <main className="content">
        {activeTab === 'fill' && (
          <div className="fill-tab">
            {pageInfo && (
              <div className="job-info">
                {pageInfo.jobInfo.company && (
                  <>
                    <h3>{pageInfo.jobInfo.title || 'Job Application'}</h3>
                    <p>{pageInfo.jobInfo.company}</p>
                  </>
                )}
                <span className="field-count">{pageInfo.fields.length} fields detected</span>
              </div>
            )}

            {message && (
              <div className={`message ${status}`}>
                {message}
              </div>
            )}

            <button 
              className="btn primary" 
              onClick={handleFillAll}
              disabled={status === 'loading'}
            >
              {status === 'loading' ? 'Filling...' : '⚡ Auto-Fill All Fields'}
            </button>

            <button className="btn secondary" onClick={handleRefresh}>
              🔄 Refresh Detection
            </button>

            <button 
              className="btn secondary" 
              onClick={() => chrome.runtime.openOptionsPage()}
            >
              ⚙️ Full Settings
            </button>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="profile-tab">
            <div className="form-group">
              <label>First Name *</label>
              <input 
                type="text" 
                value={profile.firstName}
                onChange={(e) => handleProfileChange('firstName', e.target.value)}
                placeholder="John"
              />
            </div>
            <div className="form-group">
              <label>Last Name *</label>
              <input 
                type="text" 
                value={profile.lastName}
                onChange={(e) => handleProfileChange('lastName', e.target.value)}
                placeholder="Doe"
              />
            </div>
            <div className="form-group">
              <label>Email *</label>
              <input 
                type="email" 
                value={profile.email}
                onChange={(e) => handleProfileChange('email', e.target.value)}
                placeholder="john@example.com"
              />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input 
                type="tel" 
                value={profile.phone}
                onChange={(e) => handleProfileChange('phone', e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>
            <div className="form-group">
              <label>University *</label>
              <input 
                type="text" 
                value={profile.university}
                onChange={(e) => handleProfileChange('university', e.target.value)}
                placeholder="Georgia Tech"
              />
            </div>
            <div className="form-group">
              <label>Major</label>
              <input 
                type="text" 
                value={profile.major}
                onChange={(e) => handleProfileChange('major', e.target.value)}
                placeholder="Computer Science"
              />
            </div>
            <div className="form-group">
              <label>GPA</label>
              <input 
                type="text" 
                value={profile.gpa}
                onChange={(e) => handleProfileChange('gpa', e.target.value)}
                placeholder="3.8"
              />
            </div>
            <div className="form-group">
              <label>LinkedIn URL</label>
              <input 
                type="url" 
                value={profile.linkedinUrl}
                onChange={(e) => handleProfileChange('linkedinUrl', e.target.value)}
                placeholder="https://linkedin.com/in/..."
              />
            </div>
            <div className="form-group">
              <label>GitHub URL</label>
              <input 
                type="url" 
                value={profile.githubUrl}
                onChange={(e) => handleProfileChange('githubUrl', e.target.value)}
                placeholder="https://github.com/..."
              />
            </div>
            <div className="form-group">
              <label>Skills (comma separated)</label>
              <input 
                type="text" 
                value={profile.skills.join(', ')}
                onChange={(e) => handleSkillsChange(e.target.value)}
                placeholder="Python, JavaScript, React, ..."
              />
            </div>
            <p className="hint">
              For full profile setup including resume, <a href="#" onClick={() => chrome.runtime.openOptionsPage()}>open settings page</a>
            </p>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="settings-tab">
            <div className="form-group">
              <label>AI Provider</label>
              <select 
                value={settings.aiProvider}
                onChange={(e) => {
                  const newSettings = { ...settings, aiProvider: e.target.value as 'openai' | 'anthropic' };
                  setSettings(newSettings);
                  storage.saveSettings(newSettings);
                }}
              >
                <option value="openai">OpenAI (GPT-4)</option>
                <option value="anthropic">Anthropic (Claude)</option>
              </select>
            </div>

            <div className="form-group checkbox">
              <input 
                type="checkbox" 
                id="autoFill"
                checked={settings.autoFillEnabled}
                onChange={(e) => {
                  const newSettings = { ...settings, autoFillEnabled: e.target.checked };
                  setSettings(newSettings);
                  storage.saveSettings(newSettings);
                }}
              />
              <label htmlFor="autoFill">Enable auto-fill on page load</label>
            </div>

            <div className="form-group checkbox">
              <input 
                type="checkbox" 
                id="preview"
                checked={settings.showPreviewBeforeFill}
                onChange={(e) => {
                  const newSettings = { ...settings, showPreviewBeforeFill: e.target.checked };
                  setSettings(newSettings);
                  storage.saveSettings(newSettings);
                }}
              />
              <label htmlFor="preview">Show preview before filling</label>
            </div>

            <button 
              className="btn secondary full-width" 
              onClick={() => chrome.runtime.openOptionsPage()}
            >
              Open Full Settings Page
            </button>
          </div>
        )}
      </main>

      <footer className="footer">
        <a href="https://github.com/ai-job-applier" target="_blank">GitHub</a>
        <span>v1.0.0</span>
      </footer>
    </div>
  );
}
