/**
 * DOCX Resume Editor
 * 
 * Rich text editor for business users who don't know LaTeX.
 * Features:
 * - Import DOCX files
 * - Export to DOCX
 * - Export to PDF
 * - Formatting toolbar (bold, italic, headings, lists)
 */

import React, { useCallback, useRef, useState } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import {
  importDocx,
  exportToDocx,
  exportToPdf,
  downloadBlob,
  createResumeTemplate,
} from '../lib/docx-utils';

// Toolbar Button Component
interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  onClick,
  isActive,
  disabled,
  title,
  children,
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`toolbar-btn ${isActive ? 'active' : ''}`}
    style={{
      padding: '6px 10px',
      border: '1px solid #ddd',
      borderRadius: '4px',
      background: isActive ? '#e3f2fd' : 'white',
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontSize: '14px',
      opacity: disabled ? 0.5 : 1,
    }}
  >
    {children}
  </button>
);

// Toolbar Divider
const ToolbarDivider: React.FC = () => (
  <div style={{ width: '1px', height: '24px', background: '#ddd', margin: '0 8px' }} />
);

// Editor Toolbar Component
interface EditorToolbarProps {
  editor: Editor | null;
  onImport: () => void;
  onExportDocx: () => void;
  onExportPdf: () => void;
  onNewDocument: () => void;
  isExporting: boolean;
}

const EditorToolbar: React.FC<EditorToolbarProps> = ({
  editor,
  onImport,
  onExportDocx,
  onExportPdf,
  onNewDocument,
  isExporting,
}) => {
  if (!editor) return null;

  return (
    <div
      className="editor-toolbar"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '4px',
        padding: '12px',
        borderBottom: '1px solid #e0e0e0',
        background: '#f8f9fa',
        alignItems: 'center',
      }}
    >
      {/* File Operations */}
      <ToolbarButton onClick={onNewDocument} title="New Document">
        📄 New
      </ToolbarButton>
      <ToolbarButton onClick={onImport} title="Import DOCX">
        📂 Import
      </ToolbarButton>
      <ToolbarButton onClick={onExportDocx} disabled={isExporting} title="Export to DOCX">
        💾 Export DOCX
      </ToolbarButton>
      <ToolbarButton onClick={onExportPdf} disabled={isExporting} title="Export to PDF">
        📑 Export PDF
      </ToolbarButton>

      <ToolbarDivider />

      {/* Text Formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        title="Bold (Ctrl+B)"
      >
        <strong>B</strong>
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        title="Italic (Ctrl+I)"
      >
        <em>I</em>
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive('underline')}
        title="Underline (Ctrl+U)"
      >
        <u>U</u>
      </ToolbarButton>

      <ToolbarDivider />

      {/* Headings */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive('heading', { level: 1 })}
        title="Heading 1"
      >
        H1
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive('heading', { level: 2 })}
        title="Heading 2"
      >
        H2
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive('heading', { level: 3 })}
        title="Heading 3"
      >
        H3
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setParagraph().run()}
        isActive={editor.isActive('paragraph')}
        title="Normal Text"
      >
        ¶
      </ToolbarButton>

      <ToolbarDivider />

      {/* Lists */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        title="Bullet List"
      >
        • List
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        title="Numbered List"
      >
        1. List
      </ToolbarButton>

      <ToolbarDivider />

      {/* Text Alignment */}
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        isActive={editor.isActive({ textAlign: 'left' })}
        title="Align Left"
      >
        ⬅
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        isActive={editor.isActive({ textAlign: 'center' })}
        title="Align Center"
      >
        ⬌
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        isActive={editor.isActive({ textAlign: 'right' })}
        title="Align Right"
      >
        ➡
      </ToolbarButton>

      <ToolbarDivider />

      {/* Undo/Redo */}
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Undo (Ctrl+Z)"
      >
        ↩
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Redo (Ctrl+Y)"
      >
        ↪
      </ToolbarButton>
    </div>
  );
};

// Main DOCX Editor Component
interface DocxEditorProps {
  initialContent?: string;
  onChange?: (html: string) => void;
  onSave?: (html: string) => void;
}

export const DocxEditor: React.FC<DocxEditorProps> = ({
  initialContent,
  onChange,
  onSave: _onSave,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4],
        },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
    ],
    content: initialContent || createResumeTemplate(),
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'docx-editor-content',
        style: 'min-height: 500px; outline: none; padding: 40px; font-family: Arial, sans-serif; line-height: 1.6;',
      },
    },
  });

  const showStatus = useCallback((message: string, duration: number = 3000) => {
    setStatusMessage(message);
    setTimeout(() => setStatusMessage(null), duration);
  }, []);

  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !editor) return;

      try {
        setIsExporting(true);
        showStatus('Importing document...');
        
        const { html, messages } = await importDocx(file);
        editor.commands.setContent(html);
        
        if (messages.length > 0) {
          console.warn('Import warnings:', messages);
        }
        
        showStatus(`Imported: ${file.name}`);
      } catch (error) {
        console.error('Import error:', error);
        showStatus('Failed to import document. Make sure it\'s a valid DOCX file.');
      } finally {
        setIsExporting(false);
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [editor, showStatus]
  );

  const handleExportDocx = useCallback(async () => {
    if (!editor) return;

    try {
      setIsExporting(true);
      showStatus('Exporting to DOCX...');
      
      const html = editor.getHTML();
      const blob = await exportToDocx(html, 'resume.docx');
      downloadBlob(blob, 'resume.docx');
      
      showStatus('Exported to resume.docx');
    } catch (error) {
      console.error('Export error:', error);
      showStatus('Failed to export document');
    } finally {
      setIsExporting(false);
    }
  }, [editor, showStatus]);

  const handleExportPdf = useCallback(async () => {
    if (!editor || !editorContainerRef.current) return;

    try {
      setIsExporting(true);
      showStatus('Exporting to PDF...');
      
      const editorElement = editorContainerRef.current.querySelector('.ProseMirror');
      if (!editorElement) {
        throw new Error('Editor content not found');
      }
      
      const blob = await exportToPdf(editorElement as HTMLElement, 'resume.pdf');
      downloadBlob(blob, 'resume.pdf');
      
      showStatus('Exported to resume.pdf');
    } catch (error) {
      console.error('PDF export error:', error);
      showStatus('Failed to export PDF');
    } finally {
      setIsExporting(false);
    }
  }, [editor, showStatus]);

  const handleNewDocument = useCallback(() => {
    if (!editor) return;
    
    if (confirm('Create a new document? Any unsaved changes will be lost.')) {
      editor.commands.setContent(createResumeTemplate());
      showStatus('Created new document from template');
    }
  }, [editor, showStatus]);

  return (
    <div
      className="docx-editor"
      style={{
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        overflow: 'hidden',
        background: 'white',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}
    >
      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {/* Toolbar */}
      <EditorToolbar
        editor={editor}
        onImport={handleImport}
        onExportDocx={handleExportDocx}
        onExportPdf={handleExportPdf}
        onNewDocument={handleNewDocument}
        isExporting={isExporting}
      />

      {/* Status Message */}
      {statusMessage && (
        <div
          style={{
            padding: '8px 16px',
            background: '#e8f5e9',
            color: '#2e7d32',
            fontSize: '14px',
            borderBottom: '1px solid #c8e6c9',
          }}
        >
          {statusMessage}
        </div>
      )}

      {/* Editor Content */}
      <div
        ref={editorContainerRef}
        className="editor-container"
        style={{
          background: '#fafafa',
          padding: '20px',
          minHeight: '600px',
        }}
      >
        <div
          style={{
            background: 'white',
            boxShadow: '0 0 10px rgba(0,0,0,0.1)',
            maxWidth: '8.5in',
            margin: '0 auto',
            minHeight: '11in',
          }}
        >
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Editor Styles */}
      <style>{`
        .docx-editor-content h1 {
          font-size: 24px;
          font-weight: bold;
          margin: 0 0 8px 0;
          color: #1a1a1a;
        }
        
        .docx-editor-content h2 {
          font-size: 18px;
          font-weight: bold;
          margin: 16px 0 8px 0;
          color: #333;
          border-bottom: 1px solid #ddd;
          padding-bottom: 4px;
        }
        
        .docx-editor-content h3 {
          font-size: 16px;
          font-weight: bold;
          margin: 12px 0 4px 0;
          color: #444;
        }
        
        .docx-editor-content h4 {
          font-size: 14px;
          font-weight: bold;
          margin: 10px 0 4px 0;
          color: #555;
        }
        
        .docx-editor-content p {
          margin: 0 0 8px 0;
          color: #333;
        }
        
        .docx-editor-content ul,
        .docx-editor-content ol {
          margin: 4px 0 8px 20px;
          padding: 0;
        }
        
        .docx-editor-content li {
          margin: 2px 0;
        }
        
        .docx-editor-content a {
          color: #1976d2;
          text-decoration: none;
        }
        
        .docx-editor-content a:hover {
          text-decoration: underline;
        }
        
        .docx-editor-content em {
          font-style: italic;
        }
        
        .docx-editor-content strong {
          font-weight: bold;
        }
        
        .docx-editor-content u {
          text-decoration: underline;
        }
        
        .toolbar-btn:hover:not(:disabled) {
          background: #e8e8e8 !important;
        }
        
        .toolbar-btn.active {
          background: #e3f2fd !important;
          border-color: #90caf9 !important;
        }
        
        .ProseMirror:focus {
          outline: none;
        }
        
        .ProseMirror p.is-editor-empty:first-child::before {
          content: 'Start typing your resume...';
          color: #adb5bd;
          pointer-events: none;
          float: left;
          height: 0;
        }
      `}</style>
    </div>
  );
};

export default DocxEditor;
