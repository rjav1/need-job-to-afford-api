/**
 * DOCX Import/Export Utilities
 * 
 * Uses mammoth.js for DOCX → HTML import
 * Uses docx library for HTML → DOCX export
 * Uses jsPDF + html2canvas for PDF export
 */

import mammoth from 'mammoth';
import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  Packer,
  Table,
} from 'docx';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Import a DOCX file and convert to HTML
 */
export async function importDocx(file: File): Promise<{ html: string; messages: string[] }> {
  const arrayBuffer = await file.arrayBuffer();
  
  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      styleMap: [
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "p[style-name='Title'] => h1.title:fresh",
        "b => strong",
        "i => em",
        "u => u",
      ],
    }
  );

  return {
    html: result.value,
    messages: result.messages.map((m) => m.message),
  };
}

/**
 * Parse HTML content into structured document elements
 */
interface DocElement {
  type: 'heading' | 'paragraph' | 'list' | 'table';
  level?: number;
  content: string;
  children?: DocElement[];
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

function parseHtmlToElements(html: string): DocElement[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const elements: DocElement[] = [];

  const processNode = (node: Node): DocElement | null => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) {
        return { type: 'paragraph', content: text };
      }
      return null;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return null;

    const el = node as HTMLElement;
    const tagName = el.tagName.toLowerCase();

    switch (tagName) {
      case 'h1':
        return { type: 'heading', level: 1, content: el.textContent || '' };
      case 'h2':
        return { type: 'heading', level: 2, content: el.textContent || '' };
      case 'h3':
        return { type: 'heading', level: 3, content: el.textContent || '' };
      case 'h4':
        return { type: 'heading', level: 4, content: el.textContent || '' };
      case 'p':
        return { type: 'paragraph', content: el.innerHTML };
      case 'ul':
      case 'ol':
        return {
          type: 'list',
          content: '',
          children: Array.from(el.children).map((li) => ({
            type: 'paragraph' as const,
            content: li.textContent || '',
          })),
        };
      case 'table':
        return { type: 'table', content: el.outerHTML };
      default:
        if (el.textContent?.trim()) {
          return { type: 'paragraph', content: el.textContent };
        }
        return null;
    }
  };

  doc.body.childNodes.forEach((node) => {
    const element = processNode(node);
    if (element) elements.push(element);
  });

  return elements;
}

/**
 * Parse inline formatting (bold, italic, underline) from HTML content
 */
function parseInlineContent(html: string): TextRun[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<span>${html}</span>`, 'text/html');
  const runs: TextRun[] = [];

  const processInline = (node: Node, styles: { bold?: boolean; italic?: boolean; underline?: boolean }) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (text) {
        runs.push(
          new TextRun({
            text,
            bold: styles.bold,
            italics: styles.italic,
            underline: styles.underline ? {} : undefined,
          })
        );
      }
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = node as HTMLElement;
    const tagName = el.tagName.toLowerCase();

    const newStyles = { ...styles };
    if (tagName === 'strong' || tagName === 'b') newStyles.bold = true;
    if (tagName === 'em' || tagName === 'i') newStyles.italic = true;
    if (tagName === 'u') newStyles.underline = true;

    el.childNodes.forEach((child) => processInline(child, newStyles));
  };

  doc.body.firstChild?.childNodes.forEach((node) => processInline(node, {}));

  return runs.length > 0 ? runs : [new TextRun('')];
}

/**
 * Export HTML content to DOCX format
 */
export async function exportToDocx(html: string, _filename: string = 'resume.docx'): Promise<Blob> {
  const elements = parseHtmlToElements(html);
  const children: (Paragraph | Table)[] = [];

  elements.forEach((el) => {
    switch (el.type) {
      case 'heading':
        children.push(
          new Paragraph({
            text: el.content,
            heading: el.level === 1 ? HeadingLevel.HEADING_1 :
                     el.level === 2 ? HeadingLevel.HEADING_2 :
                     el.level === 3 ? HeadingLevel.HEADING_3 :
                     HeadingLevel.HEADING_4,
            spacing: { before: 240, after: 120 },
          })
        );
        break;

      case 'paragraph':
        children.push(
          new Paragraph({
            children: parseInlineContent(el.content),
            spacing: { after: 120 },
          })
        );
        break;

      case 'list':
        el.children?.forEach((item) => {
          children.push(
            new Paragraph({
              text: `• ${item.content}`,
              spacing: { after: 60 },
              indent: { left: 720 },
            })
          );
        });
        break;

      default:
        if (el.content) {
          children.push(
            new Paragraph({
              text: el.content,
              spacing: { after: 120 },
            })
          );
        }
    }
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch = 1440 twips
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  return blob;
}

/**
 * Download a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export HTML content to PDF format
 */
export async function exportToPdf(
  contentElement: HTMLElement,
  _filename: string = 'resume.pdf'
): Promise<Blob> {
  // Create a clone of the element for rendering
  const clone = contentElement.cloneNode(true) as HTMLElement;
  clone.style.width = '8.5in';
  clone.style.padding = '0.5in';
  clone.style.backgroundColor = 'white';
  clone.style.position = 'absolute';
  clone.style.left = '-9999px';
  clone.style.fontFamily = 'Arial, sans-serif';
  document.body.appendChild(clone);

  try {
    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const imgWidth = 8.5;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    const pdf = new jsPDF({
      orientation: imgHeight > 11 ? 'portrait' : 'portrait',
      unit: 'in',
      format: 'letter',
    });

    const imgData = canvas.toDataURL('image/png');
    
    // Handle multi-page PDFs
    let heightLeft = imgHeight;
    let position = 0;
    const pageHeight = 11;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    const blob = pdf.output('blob');
    return blob;
  } finally {
    document.body.removeChild(clone);
  }
}

/**
 * Create a simple HTML template for a new resume
 */
export function createResumeTemplate(): string {
  return `
<h1>Your Name</h1>
<p>email@example.com | (555) 555-5555 | City, State</p>
<p><a href="#">LinkedIn</a> | <a href="#">GitHub</a></p>

<h2>Summary</h2>
<p>Brief professional summary highlighting your key strengths and career objectives.</p>

<h2>Experience</h2>
<h3>Job Title | Company Name</h3>
<p><em>Month Year - Present | Location</em></p>
<ul>
  <li>Accomplishment or responsibility with measurable impact</li>
  <li>Another key achievement demonstrating your value</li>
  <li>Technical skills or leadership examples</li>
</ul>

<h3>Previous Job Title | Previous Company</h3>
<p><em>Month Year - Month Year | Location</em></p>
<ul>
  <li>Relevant accomplishment</li>
  <li>Another achievement</li>
</ul>

<h2>Education</h2>
<h3>Degree Name | University Name</h3>
<p><em>Graduation Year | Location</em></p>
<p>GPA: X.XX (if notable) | Relevant coursework, honors, activities</p>

<h2>Skills</h2>
<p><strong>Technical:</strong> Skill 1, Skill 2, Skill 3, Skill 4</p>
<p><strong>Tools:</strong> Tool 1, Tool 2, Tool 3</p>
<p><strong>Languages:</strong> Language 1 (proficiency), Language 2 (proficiency)</p>

<h2>Projects</h2>
<h3>Project Name</h3>
<p>Brief description of the project and your role. Technologies used: Tech1, Tech2, Tech3.</p>
`.trim();
}

/**
 * Sanitize HTML to prevent XSS while preserving formatting
 */
export function sanitizeHtml(html: string): string {
  const allowedTags = ['h1', 'h2', 'h3', 'h4', 'p', 'strong', 'b', 'em', 'i', 'u', 'a', 'ul', 'ol', 'li', 'br'];
  const allowedAttrs = ['href', 'target'];

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const sanitize = (el: Element): void => {
    const children = Array.from(el.children);
    
    children.forEach((child) => {
      const tagName = child.tagName.toLowerCase();
      
      if (!allowedTags.includes(tagName)) {
        // Replace with text content
        const text = document.createTextNode(child.textContent || '');
        child.parentNode?.replaceChild(text, child);
      } else {
        // Remove disallowed attributes
        Array.from(child.attributes).forEach((attr) => {
          if (!allowedAttrs.includes(attr.name)) {
            child.removeAttribute(attr.name);
          }
        });
        sanitize(child);
      }
    });
  };

  sanitize(doc.body);
  return doc.body.innerHTML;
}
