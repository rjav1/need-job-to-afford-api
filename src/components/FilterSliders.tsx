import React from 'react';

export interface FilterWeights {
  skillMatch: number;      // 0-100: How important skill matching is
  locationMatch: number;   // 0-100: How important location proximity is
  salaryMatch: number;     // 0-100: How important salary range is
  experienceMatch: number; // 0-100: How important experience level match is
  companySize: number;     // 0-100: Preference for company size (0=startup, 100=enterprise)
  remotePreference: number; // 0-100: Preference for remote work
}

export const DEFAULT_FILTER_WEIGHTS: FilterWeights = {
  skillMatch: 80,
  locationMatch: 50,
  salaryMatch: 60,
  experienceMatch: 70,
  companySize: 50,
  remotePreference: 70,
};

interface FilterSlidersProps {
  weights: FilterWeights;
  onChange: (weights: FilterWeights) => void;
  disabled?: boolean;
}

interface SliderConfig {
  key: keyof FilterWeights;
  label: string;
  description: string;
  leftLabel: string;
  rightLabel: string;
}

const SLIDER_CONFIGS: SliderConfig[] = [
  {
    key: 'skillMatch',
    label: 'Skill Match',
    description: 'How closely your skills should match job requirements',
    leftLabel: 'Flexible',
    rightLabel: 'Exact Match',
  },
  {
    key: 'locationMatch',
    label: 'Location',
    description: 'Preference for jobs near your location',
    leftLabel: 'Anywhere',
    rightLabel: 'Local Only',
  },
  {
    key: 'salaryMatch',
    label: 'Salary Range',
    description: 'How important salary matching is',
    leftLabel: 'Flexible',
    rightLabel: 'Must Match',
  },
  {
    key: 'experienceMatch',
    label: 'Experience Level',
    description: 'Match jobs to your experience level',
    leftLabel: 'Any Level',
    rightLabel: 'Exact Level',
  },
  {
    key: 'companySize',
    label: 'Company Size',
    description: 'Preference for company size',
    leftLabel: 'Startup',
    rightLabel: 'Enterprise',
  },
  {
    key: 'remotePreference',
    label: 'Remote Work',
    description: 'Preference for remote opportunities',
    leftLabel: 'On-site OK',
    rightLabel: 'Remote Only',
  },
];

export function FilterSliders({ weights, onChange, disabled }: FilterSlidersProps) {
  const handleSliderChange = (key: keyof FilterWeights, value: number) => {
    onChange({
      ...weights,
      [key]: value,
    });
  };

  const getSliderColor = (value: number): string => {
    // Gradient from blue (0) to purple (100)
    const hue = 250 - (value * 0.5); // 250 (blue) to 200 (purple)
    return `hsl(${hue}, 70%, 55%)`;
  };

  return (
    <div className="filter-sliders">
      <div className="sliders-header">
        <h3>🎯 Matching Weights</h3>
        <p className="hint">Adjust these sliders to prioritize what matters most to you</p>
      </div>

      <div className="sliders-grid">
        {SLIDER_CONFIGS.map(config => (
          <div key={config.key} className="slider-item">
            <div className="slider-header">
              <label>{config.label}</label>
              <span className="slider-value" style={{ color: getSliderColor(weights[config.key]) }}>
                {weights[config.key]}%
              </span>
            </div>
            <p className="slider-description">{config.description}</p>
            <div className="slider-wrapper">
              <span className="slider-label left">{config.leftLabel}</span>
              <input
                type="range"
                min="0"
                max="100"
                value={weights[config.key]}
                onChange={(e) => handleSliderChange(config.key, parseInt(e.target.value))}
                disabled={disabled}
                className="slider"
                style={{
                  background: `linear-gradient(to right, ${getSliderColor(weights[config.key])} 0%, ${getSliderColor(weights[config.key])} ${weights[config.key]}%, #e2e8f0 ${weights[config.key]}%, #e2e8f0 100%)`,
                }}
              />
              <span className="slider-label right">{config.rightLabel}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="slider-actions">
        <button
          className="reset-btn"
          onClick={() => onChange(DEFAULT_FILTER_WEIGHTS)}
          disabled={disabled}
        >
          Reset to Defaults
        </button>
      </div>

      <style>{`
        .filter-sliders {
          background: #f8fafc;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 20px;
        }

        .sliders-header {
          margin-bottom: 20px;
        }

        .sliders-header h3 {
          margin: 0 0 4px 0;
          padding: 0;
          border: none;
          font-size: 16px;
          color: #334155;
        }

        .sliders-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 24px;
        }

        @media (max-width: 768px) {
          .sliders-grid {
            grid-template-columns: 1fr;
          }
        }

        .slider-item {
          background: white;
          border-radius: 10px;
          padding: 16px;
          border: 1px solid #e2e8f0;
        }

        .slider-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
        }

        .slider-header label {
          font-weight: 600;
          font-size: 14px;
          color: #334155;
        }

        .slider-value {
          font-weight: 700;
          font-size: 14px;
        }

        .slider-description {
          font-size: 12px;
          color: #94a3b8;
          margin-bottom: 12px;
        }

        .slider-wrapper {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .slider-label {
          font-size: 10px;
          color: #64748b;
          white-space: nowrap;
          min-width: 60px;
        }

        .slider-label.left {
          text-align: right;
        }

        .slider-label.right {
          text-align: left;
        }

        .slider {
          flex: 1;
          height: 8px;
          border-radius: 4px;
          appearance: none;
          -webkit-appearance: none;
          cursor: pointer;
          transition: all 0.2s;
        }

        .slider::-webkit-slider-thumb {
          appearance: none;
          -webkit-appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: white;
          border: 2px solid #667eea;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
          cursor: pointer;
          transition: all 0.2s;
        }

        .slider::-webkit-slider-thumb:hover {
          transform: scale(1.1);
          box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
        }

        .slider::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: white;
          border: 2px solid #667eea;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
          cursor: pointer;
        }

        .slider:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .slider-actions {
          display: flex;
          justify-content: flex-end;
          margin-top: 16px;
        }

        .reset-btn {
          padding: 8px 16px;
          border: 1px solid #e2e8f0;
          background: white;
          border-radius: 8px;
          font-size: 13px;
          color: #64748b;
          cursor: pointer;
          transition: all 0.2s;
        }

        .reset-btn:hover:not(:disabled) {
          border-color: #667eea;
          color: #667eea;
        }

        .reset-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}

export default FilterSliders;
