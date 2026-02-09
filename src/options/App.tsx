import React, { useEffect, useState } from 'react';
import { storage } from '../lib/storage';
import { UserProfile, Settings, ProjectDescription, ApplicationRecord, DEFAULT_PROFILE, DEFAULT_SETTINGS } from '../lib/types';
import { extractFromResume, mergeWithProfile } from '../lib/resume-parser';

export default function App() {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [apiKey, setApiKey] = useState('');
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [activeSection, setActiveSection] = useState<'profile' | 'projects' | 'settings' | 'history'>('profile');
  const [saved, setSaved] = useState(false);
  const [newProject, setNewProject] = useState<ProjectDescription>({
    name: '',
    description: '',
    technologies: [],
    highlights: [],
  });

  useEffect(() => {
    Promise.all([
      storage.getProfile(),
      storage.getSettings(),
      storage.getApiKey(),
      storage.getApplications(),
    ]).then(([p, s, k, a]) => {
      setProfile(p);
      setSettings(s);
      setApiKey(k);
      setApplications(a);
    });
  }, []);

  const handleSave = async () => {
    await storage.saveProfile(profile);
    await storage.saveSettings(settings);
    await storage.saveApiKey(apiKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleProfileChange = (field: keyof UserProfile, value: any) => {
    setProfile({ ...profile, [field]: value });
  };

  const handleAddProject = () => {
    if (newProject.name && newProject.description) {
      const updatedProfile = {
        ...profile,
        projects: [...profile.projects, newProject],
      };
      setProfile(updatedProfile);
      setNewProject({ name: '', description: '', technologies: [], highlights: [] });
    }
  };

  const handleRemoveProject = (index: number) => {
    const projects = profile.projects.filter((_, i) => i !== index);
    setProfile({ ...profile, projects });
  };

  const handleResumeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const resumeText = event.target?.result as string;
        setProfile({
          ...profile,
          resumeText,
          resumeFileName: file.name,
        });
      };
      reader.readAsText(file);
    }
  };

  const handleParseResume = () => {
    if (!profile.resumeText) {
      alert('Please upload or paste your resume first!');
      return;
    }
    const extracted = extractFromResume(profile.resumeText);
    const merged = mergeWithProfile(profile, extracted);
    setProfile(merged);
    alert(`Extracted ${Object.keys(extracted).length} fields from your resume! Review and save your profile.`);
  };

  return (
    <div className="options-page">
      <aside className="sidebar">
        <div className="logo">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
          </svg>
          <h1>AI Job Applier</h1>
        </div>

        <nav className="nav">
          <button 
            className={activeSection === 'profile' ? 'active' : ''} 
            onClick={() => setActiveSection('profile')}
          >
            👤 Profile
          </button>
          <button 
            className={activeSection === 'projects' ? 'active' : ''} 
            onClick={() => setActiveSection('projects')}
          >
            📁 Projects
          </button>
          <button 
            className={activeSection === 'settings' ? 'active' : ''} 
            onClick={() => setActiveSection('settings')}
          >
            ⚙️ Settings
          </button>
          <button 
            className={activeSection === 'history' ? 'active' : ''} 
            onClick={() => setActiveSection('history')}
          >
            📋 History
          </button>
        </nav>

        <button className={`save-btn ${saved ? 'saved' : ''}`} onClick={handleSave}>
          {saved ? '✓ Saved!' : 'Save Changes'}
        </button>
      </aside>

      <main className="main-content">
        {activeSection === 'profile' && (
          <section>
            <h2>Personal Information</h2>
            <p className="description">This information will be used to auto-fill job applications.</p>
            
            <div className="form-grid">
              <div className="form-group">
                <label>First Name *</label>
                <input 
                  type="text" 
                  value={profile.firstName}
                  onChange={(e) => handleProfileChange('firstName', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Last Name *</label>
                <input 
                  type="text" 
                  value={profile.lastName}
                  onChange={(e) => handleProfileChange('lastName', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Email *</label>
                <input 
                  type="email" 
                  value={profile.email}
                  onChange={(e) => handleProfileChange('email', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input 
                  type="tel" 
                  value={profile.phone}
                  onChange={(e) => handleProfileChange('phone', e.target.value)}
                />
              </div>
            </div>

            <h3>Address</h3>
            <div className="form-grid">
              <div className="form-group full">
                <label>Street Address</label>
                <input 
                  type="text" 
                  value={profile.address}
                  onChange={(e) => handleProfileChange('address', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>City</label>
                <input 
                  type="text" 
                  value={profile.city}
                  onChange={(e) => handleProfileChange('city', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>State</label>
                <input 
                  type="text" 
                  value={profile.state}
                  onChange={(e) => handleProfileChange('state', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>ZIP Code</label>
                <input 
                  type="text" 
                  value={profile.zipCode}
                  onChange={(e) => handleProfileChange('zipCode', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Country</label>
                <input 
                  type="text" 
                  value={profile.country}
                  onChange={(e) => handleProfileChange('country', e.target.value)}
                />
              </div>
            </div>

            <h3>Links</h3>
            <div className="form-grid">
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
              <div className="form-group full">
                <label>Portfolio / Website</label>
                <input 
                  type="url" 
                  value={profile.portfolioUrl}
                  onChange={(e) => handleProfileChange('portfolioUrl', e.target.value)}
                />
              </div>
            </div>

            <h3>Education</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>University *</label>
                <input 
                  type="text" 
                  value={profile.university}
                  onChange={(e) => handleProfileChange('university', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Degree</label>
                <input 
                  type="text" 
                  value={profile.degree}
                  onChange={(e) => handleProfileChange('degree', e.target.value)}
                  placeholder="Bachelor of Science"
                />
              </div>
              <div className="form-group">
                <label>Major</label>
                <input 
                  type="text" 
                  value={profile.major}
                  onChange={(e) => handleProfileChange('major', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>GPA</label>
                <input 
                  type="text" 
                  value={profile.gpa}
                  onChange={(e) => handleProfileChange('gpa', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Graduation Date</label>
                <input 
                  type="text" 
                  value={profile.graduationDate}
                  onChange={(e) => handleProfileChange('graduationDate', e.target.value)}
                  placeholder="May 2026"
                />
              </div>
            </div>

            <h3>Work Authorization</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Work Authorization</label>
                <select 
                  value={profile.workAuthorization}
                  onChange={(e) => handleProfileChange('workAuthorization', e.target.value)}
                >
                  <option value="us_citizen">US Citizen</option>
                  <option value="permanent_resident">Permanent Resident</option>
                  <option value="visa">Visa Holder (requires sponsorship)</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label>Years of Experience</label>
                <input 
                  type="text" 
                  value={profile.yearsOfExperience}
                  onChange={(e) => handleProfileChange('yearsOfExperience', e.target.value)}
                />
              </div>
            </div>

            <h3>Skills</h3>
            <div className="form-group full">
              <label>Skills (comma separated)</label>
              <textarea 
                value={profile.skills.join(', ')}
                onChange={(e) => handleProfileChange('skills', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                rows={3}
                placeholder="Python, JavaScript, React, Node.js, SQL, Git..."
              />
            </div>

            <h3>Resume</h3>
            <div className="form-group full">
              <label>Upload Resume (TXT or paste below)</label>
              <input type="file" accept=".txt,.pdf" onChange={handleResumeUpload} />
              {profile.resumeFileName && (
                <p className="file-name">📄 {profile.resumeFileName}</p>
              )}
              <textarea 
                value={profile.resumeText}
                onChange={(e) => handleProfileChange('resumeText', e.target.value)}
                rows={8}
                placeholder="Paste your resume text here for AI to reference..."
              />
              <button 
                className="add-btn" 
                onClick={handleParseResume}
                style={{ marginTop: '12px' }}
              >
                🔍 Extract Info from Resume
              </button>
              <p className="hint">
                Click to auto-fill your profile fields from your resume. Works best with plain text resumes.
              </p>
            </div>
          </section>
        )}

        {activeSection === 'projects' && (
          <section>
            <h2>Projects</h2>
            <p className="description">Add projects for the AI to reference when answering "describe a project" questions.</p>

            <div className="projects-list">
              {profile.projects.map((project, index) => (
                <div key={index} className="project-card">
                  <div className="project-header">
                    <h4>{project.name}</h4>
                    <button className="remove-btn" onClick={() => handleRemoveProject(index)}>×</button>
                  </div>
                  <p>{project.description}</p>
                  {project.technologies.length > 0 && (
                    <div className="tags">
                      {project.technologies.map((tech, i) => (
                        <span key={i} className="tag">{tech}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="add-project">
              <h3>Add New Project</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label>Project Name *</label>
                  <input 
                    type="text" 
                    value={newProject.name}
                    onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  />
                </div>
                <div className="form-group full">
                  <label>Description *</label>
                  <textarea 
                    value={newProject.description}
                    onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="form-group full">
                  <label>Technologies (comma separated)</label>
                  <input 
                    type="text" 
                    value={newProject.technologies.join(', ')}
                    onChange={(e) => setNewProject({ 
                      ...newProject, 
                      technologies: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                    })}
                    placeholder="React, Python, TensorFlow..."
                  />
                </div>
              </div>
              <button className="add-btn" onClick={handleAddProject}>+ Add Project</button>
            </div>
          </section>
        )}

        {activeSection === 'settings' && (
          <section>
            <h2>Settings</h2>

            <h3>AI Configuration</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>AI Provider</label>
                <select 
                  value={settings.aiProvider}
                  onChange={(e) => setSettings({ ...settings, aiProvider: e.target.value as 'openai' | 'anthropic' })}
                >
                  <option value="openai">OpenAI (GPT-4)</option>
                  <option value="anthropic">Anthropic (Claude)</option>
                </select>
              </div>
              <div className="form-group">
                <label>API Key *</label>
                <input 
                  type="password" 
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-... or sk-ant-..."
                />
                <p className="hint">Your API key is stored locally and never sent to our servers.</p>
              </div>
            </div>

            <h3>AI Mode</h3>
            <div className="form-group checkbox">
              <input 
                type="checkbox" 
                id="testMode"
                checked={(settings as any).testMode}
                onChange={(e) => setSettings({ ...settings, testMode: e.target.checked } as any)}
              />
              <label htmlFor="testMode">🧪 Test Mode (Discord AI via Ronald)</label>
            </div>
            <p className="hint" style={{ marginBottom: '12px', marginLeft: '28px' }}>
              Routes AI requests to Discord #job-applier-ai channel. Ronald will respond with AI-generated answers.
            </p>
            <div className="form-group checkbox">
              <input 
                type="checkbox" 
                id="noAiMode"
                checked={settings.noAiMode}
                onChange={(e) => setSettings({ ...settings, noAiMode: e.target.checked })}
              />
              <label htmlFor="noAiMode">No AI Mode (use templates only, no API key needed)</label>
            </div>
            <div className="form-group checkbox">
              <input 
                type="checkbox" 
                id="preferTemplates"
                checked={settings.preferTemplates}
                onChange={(e) => setSettings({ ...settings, preferTemplates: e.target.checked })}
              />
              <label htmlFor="preferTemplates">Prefer templates over AI (saves API costs)</label>
            </div>
            <p className="hint" style={{ marginBottom: '16px' }}>
              Templates work for common questions like "Why this company?", "Tell us about yourself", etc.
              Enable "No AI Mode" if you don't have an API key.
            </p>

            <h3>Behavior</h3>
            <div className="form-group checkbox">
              <input 
                type="checkbox" 
                id="autoFill"
                checked={settings.autoFillEnabled}
                onChange={(e) => setSettings({ ...settings, autoFillEnabled: e.target.checked })}
              />
              <label htmlFor="autoFill">Auto-fill forms when page loads</label>
            </div>
            <div className="form-group checkbox">
              <input 
                type="checkbox" 
                id="preview"
                checked={settings.showPreviewBeforeFill}
                onChange={(e) => setSettings({ ...settings, showPreviewBeforeFill: e.target.checked })}
              />
              <label htmlFor="preview">Show preview before filling</label>
            </div>
            <div className="form-group checkbox">
              <input 
                type="checkbox" 
                id="darkMode"
                checked={settings.darkMode}
                onChange={(e) => setSettings({ ...settings, darkMode: e.target.checked })}
              />
              <label htmlFor="darkMode">Dark mode</label>
            </div>

            <h3>Data</h3>
            <button 
              className="danger-btn"
              onClick={async () => {
                if (confirm('Are you sure? This will delete all your data.')) {
                  await storage.clearAll();
                  window.location.reload();
                }
              }}
            >
              Clear All Data
            </button>
          </section>
        )}

        {activeSection === 'history' && (
          <section>
            <h2>Application History</h2>
            <p className="description">Track jobs you've applied to.</p>

            {applications.length === 0 ? (
              <div className="empty-state">
                <p>No applications yet. Start applying to jobs!</p>
              </div>
            ) : (
              <div className="applications-list">
                {applications.map((app) => (
                  <div key={app.id} className="application-card">
                    <div className="app-info">
                      <h4>{app.jobTitle}</h4>
                      <p>{app.companyName}</p>
                      <span className={`status ${app.status}`}>{app.status}</span>
                    </div>
                    <div className="app-meta">
                      <span>{new Date(app.appliedAt).toLocaleDateString()}</span>
                      <a href={app.jobUrl} target="_blank">View Job</a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
