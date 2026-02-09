/**
 * ApplyControls Component
 * 
 * UI controls for one-click apply, full auto mode, and swarm mode.
 * Used in popup and options page.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  ApplyConfig, 
  ApplyState, 
  ApplyMode,
  ApplyResult,
  JobTarget,
  getApplyConfig, 
  setApplyConfig,
  getApplyState,
  oneClickApply,
  fullAutoApply,
  swarmApply,
  pauseSwarm,
  resumeSwarm,
  stopApply,
  onApplyEvent,
  ApplyEvent,
} from '../lib/auto-apply';
import { 
  getRecentApplications, 
  getTodayApplications,
  ApplicationLogEntry,
  getApplicationAnalytics,
  ApplicationAnalytics,
} from '../lib/application-logger';
import {
  getLearningInsights,
} from '../lib/feedback-learner';

// Styles as CSS-in-JS for component encapsulation
const styles = {
  container: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    padding: '16px',
    maxWidth: '400px',
  },
  section: {
    marginBottom: '20px',
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: '600' as const,
    color: '#475569',
    marginBottom: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  modeSelector: {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px',
  },
  modeButton: {
    flex: 1,
    padding: '12px 8px',
    border: '2px solid #e2e8f0',
    borderRadius: '10px',
    background: 'white',
    cursor: 'pointer',
    textAlign: 'center' as const,
    transition: 'all 0.2s ease',
    fontSize: '12px',
  },
  modeButtonActive: {
    borderColor: '#667eea',
    background: 'linear-gradient(135deg, #667eea15 0%, #764ba215 100%)',
  },
  modeIcon: {
    fontSize: '20px',
    display: 'block',
    marginBottom: '4px',
  },
  modeLabel: {
    fontWeight: '600' as const,
    color: '#334155',
  },
  primaryButton: {
    width: '100%',
    padding: '14px',
    border: 'none',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    fontSize: '15px',
    fontWeight: '600' as const,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'transform 0.1s ease, box-shadow 0.2s ease',
  },
  secondaryButton: {
    width: '100%',
    padding: '12px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    background: 'white',
    color: '#475569',
    fontSize: '14px',
    fontWeight: '500' as const,
    cursor: 'pointer',
    marginTop: '10px',
  },
  dangerButton: {
    background: '#ef4444',
    color: 'white',
    border: 'none',
  },
  configPanel: {
    background: '#f8fafc',
    borderRadius: '10px',
    padding: '12px',
    marginTop: '12px',
  },
  configRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
    fontSize: '13px',
  },
  configLabel: {
    color: '#64748b',
  },
  toggle: {
    width: '44px',
    height: '24px',
    borderRadius: '12px',
    background: '#cbd5e1',
    border: 'none',
    cursor: 'pointer',
    position: 'relative' as const,
    transition: 'background 0.2s ease',
  },
  toggleActive: {
    background: '#667eea',
  },
  toggleKnob: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    background: 'white',
    position: 'absolute' as const,
    top: '2px',
    left: '2px',
    transition: 'left 0.2s ease',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
  },
  toggleKnobActive: {
    left: '22px',
  },
  input: {
    padding: '8px 12px',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    width: '80px',
    fontSize: '13px',
    textAlign: 'right' as const,
  },
  progressBar: {
    width: '100%',
    height: '8px',
    background: '#e2e8f0',
    borderRadius: '4px',
    overflow: 'hidden',
    marginTop: '12px',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
    transition: 'width 0.3s ease',
  },
  statusCard: {
    background: 'white',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '12px',
    marginTop: '12px',
  },
  statusRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
    color: '#64748b',
    marginBottom: '6px',
  },
  statusValue: {
    fontWeight: '600' as const,
    color: '#334155',
  },
  recentItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 0',
    borderBottom: '1px solid #f1f5f9',
    fontSize: '13px',
  },
  recentTitle: {
    fontWeight: '500' as const,
    color: '#334155',
  },
  recentCompany: {
    color: '#64748b',
    fontSize: '12px',
  },
  badge: {
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600' as const,
  },
  badgeSuccess: {
    background: '#dcfce7',
    color: '#166534',
  },
  badgeError: {
    background: '#fee2e2',
    color: '#991b1b',
  },
  badgePending: {
    background: '#fef3c7',
    color: '#92400e',
  },
  swarmInput: {
    width: '100%',
    padding: '10px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '13px',
    marginBottom: '10px',
    minHeight: '80px',
    resize: 'vertical' as const,
  },
  hint: {
    fontSize: '12px',
    color: '#94a3b8',
    marginTop: '4px',
  },
  insightCard: {
    background: 'linear-gradient(135deg, #667eea15 0%, #764ba215 100%)',
    borderRadius: '10px',
    padding: '12px',
    marginTop: '12px',
  },
  insightValue: {
    fontSize: '24px',
    fontWeight: '700' as const,
    color: '#667eea',
  },
  insightLabel: {
    fontSize: '12px',
    color: '#64748b',
  },
};

interface ApplyControlsProps {
  compact?: boolean;  // Compact mode for popup
  onApply?: (result: ApplyResult) => void;
}

export default function ApplyControls({ compact = false, onApply }: ApplyControlsProps) {
  // State
  const [config, setConfig] = useState<ApplyConfig | null>(null);
  const [state, setState] = useState<ApplyState | null>(null);
  const [mode, setMode] = useState<ApplyMode>('one-click');
  const [isLoading, setIsLoading] = useState(false);
  const [lastResult, setLastResult] = useState<ApplyResult | null>(null);
  const [recentApps, setRecentApps] = useState<ApplicationLogEntry[]>([]);
  const [analytics, setAnalytics] = useState<ApplicationAnalytics | null>(null);
  const [swarmUrls, setSwarmUrls] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  
  // Load initial data
  useEffect(() => {
    loadData();
    
    // Subscribe to apply events
    const unsubscribe = onApplyEvent(handleApplyEvent);
    return () => unsubscribe();
  }, []);
  
  const loadData = async () => {
    const [configData, recentData, analyticsData] = await Promise.all([
      getApplyConfig(),
      getRecentApplications(5),
      getApplicationAnalytics(),
    ]);
    
    setConfig(configData);
    setMode(configData.mode);
    setRecentApps(recentData);
    setAnalytics(analyticsData);
  };
  
  const handleApplyEvent = useCallback((event: ApplyEvent) => {
    switch (event.type) {
      case 'started':
        setIsLoading(true);
        break;
      case 'progress':
        setState(getApplyState());
        break;
      case 'completed':
        setIsLoading(false);
        if (event.data.mode !== 'swarm') {
          setLastResult(event.data);
          onApply?.(event.data);
        }
        loadData();
        break;
      case 'failed':
        setIsLoading(false);
        setLastResult(event.data);
        break;
      case 'paused':
        setIsLoading(false);
        setState(getApplyState());
        break;
      case 'review-stop':
        setIsLoading(false);
        setLastResult(event.data);
        break;
      case 'swarm-next':
        setState(getApplyState());
        break;
    }
  }, [onApply]);
  
  const handleModeChange = async (newMode: ApplyMode) => {
    setMode(newMode);
    if (config) {
      const newConfig = { ...config, mode: newMode };
      setConfig(newConfig);
      await setApplyConfig(newConfig);
    }
  };
  
  const handleConfigChange = async (key: keyof ApplyConfig, value: any) => {
    if (config) {
      const newConfig = { ...config, [key]: value };
      setConfig(newConfig);
      await setApplyConfig(newConfig);
    }
  };
  
  const handleApplyClick = async () => {
    setIsLoading(true);
    setLastResult(null);
    
    try {
      switch (mode) {
        case 'one-click':
          await oneClickApply();
          break;
        case 'full-auto':
          await fullAutoApply();
          break;
        case 'swarm':
          const jobs = parseSwarmUrls(swarmUrls);
          if (jobs.length > 0) {
            await swarmApply(jobs);
          }
          break;
      }
    } catch (error) {
      console.error('Apply error:', error);
      setIsLoading(false);
    }
  };
  
  const parseSwarmUrls = (input: string): JobTarget[] => {
    const urls = input.split('\n').filter(u => u.trim().startsWith('http'));
    return urls.map(url => ({
      url: url.trim(),
      title: 'Unknown',
      company: 'Unknown',
      source: 'other' as const,
    }));
  };
  
  if (!config) {
    return <div style={styles.container}>Loading...</div>;
  }
  
  return (
    <div style={styles.container}>
      {/* Mode Selector */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>
          <span>⚡</span> Apply Mode
        </div>
        <div style={styles.modeSelector}>
          <button
            style={{
              ...styles.modeButton,
              ...(mode === 'one-click' ? styles.modeButtonActive : {}),
            }}
            onClick={() => handleModeChange('one-click')}
          >
            <span style={styles.modeIcon}>🎯</span>
            <span style={styles.modeLabel}>One-Click</span>
          </button>
          <button
            style={{
              ...styles.modeButton,
              ...(mode === 'full-auto' ? styles.modeButtonActive : {}),
            }}
            onClick={() => handleModeChange('full-auto')}
          >
            <span style={styles.modeIcon}>🚀</span>
            <span style={styles.modeLabel}>Full Auto</span>
          </button>
          <button
            style={{
              ...styles.modeButton,
              ...(mode === 'swarm' ? styles.modeButtonActive : {}),
            }}
            onClick={() => handleModeChange('swarm')}
          >
            <span style={styles.modeIcon}>🐝</span>
            <span style={styles.modeLabel}>Swarm</span>
          </button>
        </div>
        
        {/* Mode description */}
        <p style={styles.hint}>
          {mode === 'one-click' && '• Fill form and stop at review page'}
          {mode === 'full-auto' && '• Fill form and submit automatically'}
          {mode === 'swarm' && '• Apply to multiple jobs in sequence'}
        </p>
      </div>
      
      {/* Swarm URL input */}
      {mode === 'swarm' && (
        <div style={styles.section}>
          <textarea
            style={styles.swarmInput}
            placeholder="Paste job URLs (one per line)..."
            value={swarmUrls}
            onChange={(e) => setSwarmUrls(e.target.value)}
          />
          <p style={styles.hint}>
            {parseSwarmUrls(swarmUrls).length} jobs queued
          </p>
        </div>
      )}
      
      {/* Main Apply Button */}
      <button
        style={{
          ...styles.primaryButton,
          opacity: isLoading ? 0.7 : 1,
          cursor: isLoading ? 'not-allowed' : 'pointer',
        }}
        onClick={handleApplyClick}
        disabled={isLoading || (mode === 'swarm' && parseSwarmUrls(swarmUrls).length === 0)}
      >
        {isLoading ? (
          <>
            <span>⏳</span> Applying...
          </>
        ) : (
          <>
            <span>{mode === 'one-click' ? '🎯' : mode === 'full-auto' ? '🚀' : '🐝'}</span>
            {mode === 'one-click' && 'Apply Now'}
            {mode === 'full-auto' && 'Auto Apply & Submit'}
            {mode === 'swarm' && `Start Swarm (${parseSwarmUrls(swarmUrls).length} jobs)`}
          </>
        )}
      </button>
      
      {/* Swarm controls */}
      {state?.isRunning && mode === 'swarm' && (
        <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
          <button
            style={{ ...styles.secondaryButton, flex: 1 }}
            onClick={pauseSwarm}
          >
            ⏸️ Pause
          </button>
          <button
            style={{ ...styles.secondaryButton, ...styles.dangerButton, flex: 1 }}
            onClick={stopApply}
          >
            ⏹️ Stop
          </button>
        </div>
      )}
      
      {/* Progress bar */}
      {state?.isRunning && (
        <div>
          <div style={styles.progressBar}>
            <div 
              style={{
                ...styles.progressFill,
                width: `${(state.progress.completed / state.progress.total) * 100}%`,
              }}
            />
          </div>
          <div style={styles.statusCard}>
            <div style={styles.statusRow}>
              <span>Progress</span>
              <span style={styles.statusValue}>
                {state.progress.completed + state.progress.failed} / {state.progress.total}
              </span>
            </div>
            <div style={styles.statusRow}>
              <span>Successful</span>
              <span style={{ ...styles.statusValue, color: '#10b981' }}>
                {state.progress.completed}
              </span>
            </div>
            <div style={styles.statusRow}>
              <span>Failed</span>
              <span style={{ ...styles.statusValue, color: '#ef4444' }}>
                {state.progress.failed}
              </span>
            </div>
            {state.currentJob && (
              <div style={styles.statusRow}>
                <span>Current</span>
                <span style={styles.statusValue}>
                  {state.currentJob.company || 'Processing...'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Last result */}
      {lastResult && !state?.isRunning && (
        <div style={styles.statusCard}>
          <div style={styles.statusRow}>
            <span>{lastResult.success ? '✅' : '❌'} {lastResult.jobTitle}</span>
            <span style={{
              ...styles.badge,
              ...(lastResult.success ? styles.badgeSuccess : styles.badgeError),
            }}>
              {lastResult.stoppedAtReview ? 'Ready for Review' : 
               lastResult.submitted ? 'Submitted' : 
               lastResult.success ? 'Filled' : 'Error'}
            </span>
          </div>
          <div style={styles.statusRow}>
            <span>{lastResult.company}</span>
            <span>{lastResult.fieldsFilled}/{lastResult.totalFields} fields</span>
          </div>
          {lastResult.errors.length > 0 && (
            <p style={{ ...styles.hint, color: '#ef4444' }}>
              {lastResult.errors[0]}
            </p>
          )}
        </div>
      )}
      
      {/* Config toggle */}
      <button
        style={styles.secondaryButton}
        onClick={() => setShowConfig(!showConfig)}
      >
        ⚙️ {showConfig ? 'Hide' : 'Show'} Settings
      </button>
      
      {/* Configuration panel */}
      {showConfig && (
        <div style={styles.configPanel}>
          <div style={styles.configRow}>
            <span style={styles.configLabel}>Stop at review page</span>
            <Toggle
              active={config.stopOnReview}
              onChange={(v) => handleConfigChange('stopOnReview', v)}
            />
          </div>
          <div style={styles.configRow}>
            <span style={styles.configLabel}>Auto-submit (Full Auto)</span>
            <Toggle
              active={config.submitAutomatically}
              onChange={(v) => handleConfigChange('submitAutomatically', v)}
            />
          </div>
          <div style={styles.configRow}>
            <span style={styles.configLabel}>Pause swarm on error</span>
            <Toggle
              active={config.pauseOnError}
              onChange={(v) => handleConfigChange('pauseOnError', v)}
            />
          </div>
          <div style={styles.configRow}>
            <span style={styles.configLabel}>Delay between jobs (ms)</span>
            <input
              type="number"
              style={styles.input}
              value={config.delayBetweenJobs}
              onChange={(e) => handleConfigChange('delayBetweenJobs', parseInt(e.target.value) || 3000)}
            />
          </div>
          <div style={styles.configRow}>
            <span style={styles.configLabel}>Max swarm applications</span>
            <input
              type="number"
              style={styles.input}
              value={config.maxApplications}
              onChange={(e) => handleConfigChange('maxApplications', parseInt(e.target.value) || 10)}
            />
          </div>
        </div>
      )}
      
      {/* Quick stats */}
      {!compact && analytics && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            <span>📊</span> Today's Stats
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ ...styles.insightCard, flex: 1, textAlign: 'center' as const }}>
              <div style={styles.insightValue}>{analytics.totalApplications}</div>
              <div style={styles.insightLabel}>Total Applications</div>
            </div>
            <div style={{ ...styles.insightCard, flex: 1, textAlign: 'center' as const }}>
              <div style={styles.insightValue}>{analytics.submissions}</div>
              <div style={styles.insightLabel}>Submitted</div>
            </div>
            <div style={{ ...styles.insightCard, flex: 1, textAlign: 'center' as const }}>
              <div style={styles.insightValue}>
                {analytics.averageFieldsFilled.toFixed(1)}
              </div>
              <div style={styles.insightLabel}>Avg Fields</div>
            </div>
          </div>
        </div>
      )}
      
      {/* Recent applications */}
      {!compact && recentApps.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            <span>📋</span> Recent Applications
          </div>
          {recentApps.slice(0, 3).map((app) => (
            <div key={app.id} style={styles.recentItem}>
              <div>
                <div style={styles.recentTitle}>{app.jobTitle}</div>
                <div style={styles.recentCompany}>{app.company}</div>
              </div>
              <span style={{
                ...styles.badge,
                ...(app.status === 'submitted' || app.status === 'filled' 
                  ? styles.badgeSuccess 
                  : app.status === 'error' 
                    ? styles.badgeError 
                    : styles.badgePending),
              }}>
                {app.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Toggle component
function Toggle({ active, onChange }: { active: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      style={{
        ...styles.toggle,
        ...(active ? styles.toggleActive : {}),
      }}
      onClick={() => onChange(!active)}
    >
      <div
        style={{
          ...styles.toggleKnob,
          ...(active ? styles.toggleKnobActive : {}),
        }}
      />
    </button>
  );
}

// Export for use in popup/options
export { ApplyControls };
