import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  JAKE_RESUME_TEMPLATE,
  compileLatex,
  validateLatex,
  downloadPdf,
  downloadLatex,
  CompilationResult,
} from '../lib/latex-compiler';

// Styles for the editor component
const styles = `
.latex-editor-container {
  display: flex;
  height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #1e1e1e;
  color: #d4d4d4;
}

.editor-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #333;
  min-width: 0;
}

.preview-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #252526;
  min-width: 0;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #2d2d2d;
  border-bottom: 1px solid #333;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  display: flex;
  align-items: center;
  gap: 8px;
}

.panel-actions {
  display: flex;
  gap: 8px;
}

.btn {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.15s ease;
}

.btn-primary {
  background: #0078d4;
  color: #fff;
}

.btn-primary:hover {
  background: #106ebe;
}

.btn-primary:disabled {
  background: #4a4a4a;
  cursor: not-allowed;
}

.btn-secondary {
  background: #3c3c3c;
  color: #d4d4d4;
}

.btn-secondary:hover {
  background: #4a4a4a;
}

.btn-success {
  background: #28a745;
  color: #fff;
}

.btn-success:hover {
  background: #218838;
}

.editor-wrapper {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.latex-textarea {
  width: 100%;
  height: 100%;
  background: #1e1e1e;
  color: #d4d4d4;
  border: none;
  outline: none;
  resize: none;
  padding: 16px;
  font-family: 'Fira Code', 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  line-height: 1.6;
  tab-size: 2;
}

.latex-textarea::selection {
  background: #264f78;
}

/* Syntax highlighting overlay - using CSS for basic coloring */
.latex-textarea {
  /* LaTeX commands will be colored via JavaScript highlighting */
}

.preview-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
  padding: 20px;
}

.preview-iframe {
  width: 100%;
  height: 100%;
  border: none;
  background: #fff;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.preview-placeholder {
  text-align: center;
  color: #888;
}

.preview-placeholder svg {
  width: 64px;
  height: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.preview-placeholder h3 {
  margin: 0 0 8px;
  font-size: 16px;
  color: #ccc;
}

.preview-placeholder p {
  margin: 0;
  font-size: 13px;
}

.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 16px;
  background: #007acc;
  font-size: 12px;
  color: #fff;
}

.status-bar.error {
  background: #dc3545;
}

.status-bar.success {
  background: #28a745;
}

.status-bar.compiling {
  background: #ffc107;
  color: #333;
}

.status-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.validation-errors {
  position: absolute;
  bottom: 40px;
  left: 16px;
  right: 16px;
  background: #3c1f1f;
  border: 1px solid #5a3030;
  border-radius: 4px;
  padding: 12px;
  max-height: 150px;
  overflow-y: auto;
}

.validation-errors h4 {
  margin: 0 0 8px;
  font-size: 12px;
  color: #ff6b6b;
}

.validation-errors ul {
  margin: 0;
  padding: 0 0 0 20px;
  font-size: 12px;
  color: #ff9999;
}

.validation-errors li {
  margin-bottom: 4px;
}

.loading-spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid #fff;
  border-radius: 50%;
  border-top-color: transparent;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.toolbar {
  display: flex;
  gap: 4px;
  padding: 8px 16px;
  background: #252526;
  border-bottom: 1px solid #333;
  flex-wrap: wrap;
}

.toolbar-btn {
  padding: 4px 8px;
  background: transparent;
  border: 1px solid #444;
  border-radius: 3px;
  color: #d4d4d4;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.toolbar-btn:hover {
  background: #3c3c3c;
  border-color: #555;
}

.toolbar-separator {
  width: 1px;
  background: #444;
  margin: 0 8px;
}

/* Split resize handle */
.resize-handle {
  width: 4px;
  background: #333;
  cursor: col-resize;
  transition: background 0.15s ease;
}

.resize-handle:hover {
  background: #0078d4;
}
`;

interface LatexEditorProps {
  initialContent?: string;
  onSave?: (content: string) => void;
  onCompile?: (result: CompilationResult) => void;
}

export default function LatexEditor({
  initialContent = JAKE_RESUME_TEMPLATE,
  onSave,
  onCompile,
}: LatexEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [status, setStatus] = useState<'idle' | 'compiling' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('Ready');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showValidation, setShowValidation] = useState(false);
  const [autoCompile, setAutoCompile] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const compileTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Inject styles
  useEffect(() => {
    const styleId = 'latex-editor-styles';
    if (!document.getElementById(styleId)) {
      const styleElement = document.createElement('style');
      styleElement.id = styleId;
      styleElement.textContent = styles;
      document.head.appendChild(styleElement);
    }
    return () => {
      const el = document.getElementById(styleId);
      if (el) el.remove();
    };
  }, []);

  // Validate on content change
  useEffect(() => {
    const result = validateLatex(content);
    setValidationErrors(result.errors);
    setShowValidation(result.errors.length > 0);
  }, [content]);

  // Auto-compile with debounce
  useEffect(() => {
    if (!autoCompile) return;

    if (compileTimeoutRef.current) {
      clearTimeout(compileTimeoutRef.current);
    }

    compileTimeoutRef.current = setTimeout(() => {
      handleCompile();
    }, 2000);

    return () => {
      if (compileTimeoutRef.current) {
        clearTimeout(compileTimeoutRef.current);
      }
    };
  }, [content, autoCompile]);

  const handleCompile = useCallback(async () => {
    if (isCompiling) return;

    setIsCompiling(true);
    setStatus('compiling');
    setStatusMessage('Compiling LaTeX...');

    try {
      const result = await compileLatex(content);

      if (result.success && result.pdfUrl) {
        // Revoke old URL if exists
        if (pdfUrl) {
          URL.revokeObjectURL(pdfUrl);
        }
        setPdfUrl(result.pdfUrl);
        setPdfBlob(result.pdfBlob || null);
        setStatus('success');
        setStatusMessage('Compilation successful!');
      } else {
        setStatus('error');
        setStatusMessage(result.error || 'Compilation failed');
        console.error('Compilation error:', result.error, result.logs);
      }

      onCompile?.(result);
    } catch (error) {
      setStatus('error');
      setStatusMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsCompiling(false);
    }
  }, [content, isCompiling, pdfUrl, onCompile]);

  const handleDownloadPdf = useCallback(() => {
    if (pdfBlob) {
      downloadPdf(pdfBlob, 'resume.pdf');
    }
  }, [pdfBlob]);

  const handleDownloadTex = useCallback(() => {
    downloadLatex(content, 'resume.tex');
  }, [content]);

  const handleSave = useCallback(() => {
    onSave?.(content);
    // Also save to localStorage
    localStorage.setItem('latex-resume-content', content);
    setStatusMessage('Saved!');
    setTimeout(() => setStatusMessage('Ready'), 1500);
  }, [content, onSave]);

  const handleReset = useCallback(() => {
    if (confirm('Reset to default Jake\'s Resume template? Your changes will be lost.')) {
      setContent(JAKE_RESUME_TEMPLATE);
      setPdfUrl(null);
      setPdfBlob(null);
    }
  }, []);

  const insertSnippet = useCallback((snippet: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newContent = content.substring(0, start) + snippet + content.substring(end);
    setContent(newContent);

    // Set cursor position after snippet
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + snippet.length, start + snippet.length);
    }, 0);
  }, [content]);

  // Toolbar snippets
  const snippets = {
    section: '\\section{Section Title}\n',
    subsection: '\\subsection{Subsection Title}\n',
    itemize: '\\begin{itemize}\n  \\item Item 1\n  \\item Item 2\n\\end{itemize}\n',
    enumerate: '\\begin{enumerate}\n  \\item Item 1\n  \\item Item 2\n\\end{enumerate}\n',
    bold: '\\textbf{bold text}',
    italic: '\\textit{italic text}',
    href: '\\href{https://url.com}{\\underline{link text}}',
    resumeItem: '\\resumeItem{Description of accomplishment}',
    resumeSubheading: '\\resumeSubheading\n  {Title}{Date Range}\n  {Subtitle}{Location}',
    resumeProject: '\\resumeProjectHeading\n  {\\textbf{Project Name} $|$ \\emph{Technologies}}{Date}',
  };

  // Load saved content on mount
  useEffect(() => {
    const saved = localStorage.getItem('latex-resume-content');
    if (saved) {
      setContent(saved);
    }
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleCompile();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, handleCompile]);

  const lineCount = content.split('\n').length;
  const charCount = content.length;

  return (
    <div className="latex-editor-container">
      {/* Editor Panel */}
      <div className="editor-panel">
        <div className="panel-header">
          <div className="panel-title">
            <span>📝</span>
            LaTeX Editor
          </div>
          <div className="panel-actions">
            <button className="btn btn-secondary" onClick={handleReset}>
              Reset
            </button>
            <button className="btn btn-secondary" onClick={handleDownloadTex}>
              ↓ .tex
            </button>
            <button className="btn btn-secondary" onClick={handleSave}>
              💾 Save
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="toolbar">
          <button className="toolbar-btn" onClick={() => insertSnippet(snippets.section)}>
            Section
          </button>
          <button className="toolbar-btn" onClick={() => insertSnippet(snippets.subsection)}>
            Subsection
          </button>
          <div className="toolbar-separator" />
          <button className="toolbar-btn" onClick={() => insertSnippet(snippets.bold)}>
            <b>B</b>
          </button>
          <button className="toolbar-btn" onClick={() => insertSnippet(snippets.italic)}>
            <i>I</i>
          </button>
          <button className="toolbar-btn" onClick={() => insertSnippet(snippets.href)}>
            🔗 Link
          </button>
          <div className="toolbar-separator" />
          <button className="toolbar-btn" onClick={() => insertSnippet(snippets.itemize)}>
            • List
          </button>
          <button className="toolbar-btn" onClick={() => insertSnippet(snippets.enumerate)}>
            1. List
          </button>
          <div className="toolbar-separator" />
          <button className="toolbar-btn" onClick={() => insertSnippet(snippets.resumeItem)}>
            + Item
          </button>
          <button className="toolbar-btn" onClick={() => insertSnippet(snippets.resumeSubheading)}>
            + Heading
          </button>
          <button className="toolbar-btn" onClick={() => insertSnippet(snippets.resumeProject)}>
            + Project
          </button>
        </div>

        {/* Editor Area */}
        <div className="editor-wrapper">
          <textarea
            ref={textareaRef}
            className="latex-textarea"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            spellCheck={false}
            placeholder="Enter your LaTeX code here..."
          />

          {showValidation && validationErrors.length > 0 && (
            <div className="validation-errors">
              <h4>⚠️ Validation Warnings</h4>
              <ul>
                {validationErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Preview Panel */}
      <div className="preview-panel">
        <div className="panel-header">
          <div className="panel-title">
            <span>📄</span>
            PDF Preview
          </div>
          <div className="panel-actions">
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
              <input
                type="checkbox"
                checked={autoCompile}
                onChange={(e) => setAutoCompile(e.target.checked)}
              />
              Auto-compile
            </label>
            <button
              className="btn btn-primary"
              onClick={handleCompile}
              disabled={isCompiling}
            >
              {isCompiling ? (
                <>
                  <span className="loading-spinner" />
                  Compiling...
                </>
              ) : (
                '▶ Compile'
              )}
            </button>
            {pdfBlob && (
              <button className="btn btn-success" onClick={handleDownloadPdf}>
                ↓ PDF
              </button>
            )}
          </div>
        </div>

        <div className="preview-content">
          {pdfUrl ? (
            <iframe
              className="preview-iframe"
              src={pdfUrl}
              title="PDF Preview"
            />
          ) : (
            <div className="preview-placeholder">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3>No Preview Yet</h3>
              <p>Click "Compile" or press Ctrl+Enter to generate PDF</p>
            </div>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div className={`status-bar ${status}`}>
        <div className="status-info">
          <span>{statusMessage}</span>
          <span>Lines: {lineCount}</span>
          <span>Chars: {charCount}</span>
        </div>
        <div>
          <span>Ctrl+S to save • Ctrl+Enter to compile</span>
        </div>
      </div>
    </div>
  );
}

// Also export a simpler textarea-only version for embedding
export function SimpleLatexTextarea({
  value,
  onChange,
  className = '',
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <textarea
      className={`latex-simple-textarea ${className}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      spellCheck={false}
      style={{
        fontFamily: "'Fira Code', 'Monaco', 'Menlo', monospace",
        fontSize: '13px',
        lineHeight: '1.6',
        tabSize: 2,
      }}
    />
  );
}
