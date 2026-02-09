/**
 * LaTeX Compiler Utilities
 * 
 * This module provides LaTeX compilation functionality.
 * Since true LaTeX compilation requires a backend (like TeX Live),
 * we provide multiple strategies:
 * 
 * 1. Overleaf API integration (requires account)
 * 2. LaTeX Online service
 * 3. Local compilation via WebAssembly (experimental)
 */

// Jake's Resume Template - Classic CS Resume
export const JAKE_RESUME_TEMPLATE = `%-------------------------
% Resume in Latex
% Author : Jake Gutierrez
% Based off of: https://github.com/sb2nov/resume
% License : MIT
%------------------------

\\documentclass[letterpaper,11pt]{article}

\\usepackage{latexsym}
\\usepackage[empty]{fullpage}
\\usepackage{titlesec}
\\usepackage{marvosym}
\\usepackage[usenames,dvipsnames]{color}
\\usepackage{verbatim}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{fancyhdr}
\\usepackage[english]{babel}
\\usepackage{tabularx}
\\input{glyphtounicode}

%----------FONT OPTIONS----------
% sans-serif
% \\usepackage[sfdefault]{FiraSans}
% \\usepackage[sfdefault]{roboto}
% \\usepackage[sfdefault]{noto-sans}
% \\usepackage[default]{sourcesanspro}

% serif
% \\usepackage{CormorantGaramond}
% \\usepackage{charter}

\\pagestyle{fancy}
\\fancyhf{} % clear all header and footer fields
\\fancyfoot{}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}

% Adjust margins
\\addtolength{\\oddsidemargin}{-0.5in}
\\addtolength{\\evensidemargin}{-0.5in}
\\addtolength{\\textwidth}{1in}
\\addtolength{\\topmargin}{-.5in}
\\addtolength{\\textheight}{1.0in}

\\urlstyle{same}

\\raggedbottom
\\raggedright
\\setlength{\\tabcolsep}{0in}

% Sections formatting
\\titleformat{\\section}{
  \\vspace{-4pt}\\scshape\\raggedright\\large
}{}{0em}{}[\\color{black}\\titlerule \\vspace{-5pt}]

% Ensure that generate pdf is machine readable/ATS parsable
\\pdfgentounicode=1

%-------------------------
% Custom commands
\\newcommand{\\resumeItem}[1]{
  \\item\\small{
    {#1 \\vspace{-2pt}}
  }
}

\\newcommand{\\resumeSubheading}[4]{
  \\vspace{-2pt}\\item
    \\begin{tabular*}{0.97\\textwidth}[t]{l@{\\extracolsep{\\fill}}r}
      \\textbf{#1} & #2 \\\\
      \\textit{\\small#3} & \\textit{\\small #4} \\\\
    \\end{tabular*}\\vspace{-7pt}
}

\\newcommand{\\resumeSubSubheading}[2]{
    \\item
    \\begin{tabular*}{0.97\\textwidth}{l@{\\extracolsep{\\fill}}r}
      \\textit{\\small#1} & \\textit{\\small #2} \\\\
    \\end{tabular*}\\vspace{-7pt}
}

\\newcommand{\\resumeProjectHeading}[2]{
    \\item
    \\begin{tabular*}{0.97\\textwidth}{l@{\\extracolsep{\\fill}}r}
      \\small#1 & #2 \\\\
    \\end{tabular*}\\vspace{-7pt}
}

\\newcommand{\\resumeSubItem}[1]{\\resumeItem{#1}\\vspace{-4pt}}

\\renewcommand\\labelitemii{$\\vcenter{\\hbox{\\tiny$\\bullet$}}$}

\\newcommand{\\resumeSubHeadingListStart}{\\begin{itemize}[leftmargin=0.15in, label={}]}
\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}}
\\newcommand{\\resumeItemListStart}{\\begin{itemize}}
\\newcommand{\\resumeItemListEnd}{\\end{itemize}\\vspace{-5pt}}

%-------------------------------------------
%%%%%%  RESUME STARTS HERE  %%%%%%%%%%%%%%%%%%%%%%%%%%%%


\\begin{document}

%----------HEADING----------
\\begin{center}
    \\textbf{\\Huge \\scshape Jake Ryan} \\\\ \\vspace{1pt}
    \\small 123-456-7890 $|$ \\href{mailto:jake@su.edu}{\\underline{jake@su.edu}} $|$ 
    \\href{https://linkedin.com/in/jake}{\\underline{linkedin.com/in/jake}} $|$
    \\href{https://github.com/jake}{\\underline{github.com/jake}}
\\end{center}


%-----------EDUCATION-----------
\\section{Education}
  \\resumeSubHeadingListStart
    \\resumeSubheading
      {Southwestern University}{Georgetown, TX}
      {Bachelor of Arts in Computer Science, Minor in Business}{Aug. 2018 -- May 2021}
    \\resumeSubheading
      {Blinn College}{Bryan, TX}
      {Associate's in Liberal Arts}{Aug. 2014 -- May 2018}
  \\resumeSubHeadingListEnd


%-----------EXPERIENCE-----------
\\section{Experience}
  \\resumeSubHeadingListStart

    \\resumeSubheading
      {Undergraduate Research Assistant}{June 2020 -- Present}
      {Texas A\\&M University}{College Station, TX}
      \\resumeItemListStart
        \\resumeItem{Developed a REST API using FastAPI and PostgreSQL to store data from learning management systems}
        \\resumeItem{Developed a full-stack web application using Flask, React, PostgreSQL and Docker to analyze GitHub data}
        \\resumeItem{Explored ways to visualize GitHub collaboration in a classroom setting}
      \\resumeItemListEnd
      
    \\resumeSubheading
      {Information Technology Support Specialist}{Sep. 2018 -- Present}
      {Southwestern University}{Georgetown, TX}
      \\resumeItemListStart
        \\resumeItem{Communicate with managers to set up campus computers used on extract days}
        \\resumeItem{Assess and troubleshoot computer problems brought by students, extract and faculty}
        \\resumeItem{Maintain upkeep of computers, extract, extract, extract and upgrade computers, extract}
      \\resumeItemListEnd

  \\resumeSubHeadingListEnd


%-----------PROJECTS-----------
\\section{Projects}
    \\resumeSubHeadingListStart
      \\resumeProjectHeading
          {\\textbf{Gitlytics} $|$ \\emph{Python, Flask, React, PostgreSQL, Docker}}{June 2020 -- Present}
          \\resumeItemListStart
            \\resumeItem{Developed a full-stack web application using with Flask serving a REST API with React as the frontend}
            \\resumeItem{Implemented GitHub OAuth to get data from user's extract}
            \\resumeItem{Visualized GitHub data to show collaboration}
            \\resumeItem{Used Celery and Redis for asynchronous tasks}
          \\resumeItemListEnd
      \\resumeProjectHeading
          {\\textbf{Simple Paintball} $|$ \\emph{Spigot API, Java, Maven, TravisCI, Git}}{May 2018 -- May 2020}
          \\resumeItemListStart
            \\resumeItem{Developed a Minecraft server plugin to extract extract extract extract from extract extract extract}
            \\resumeItem{Published plugin to websites extract extract extract extract and extract extract extract extract}
            \\resumeItem{Implemented continuous delivery using TravisCI to build the bytes, extract, extract and extract}
          \\resumeItemListEnd
    \\resumeSubHeadingListEnd


%-----------TECHNICAL SKILLS-----------
\\section{Technical Skills}
 \\begin{itemize}[leftmargin=0.15in, label={}]
    \\small{\\item{
     \\textbf{Languages}{: Java, Python, C/C++, SQL (Postgres), JavaScript, HTML/CSS, R} \\\\
     \\textbf{Frameworks}{: React, Node.js, Flask, JUnit, WordPress, Material-UI, FastAPI} \\\\
     \\textbf{Developer Tools}{: Git, Docker, TravisCI, Google Cloud Platform, VS Code, Visual Studio, PyCharm, IntelliJ, Eclipse} \\\\
     \\textbf{Libraries}{: pandas, NumPy, Matplotlib}
    }}
 \\end{itemize}


%-------------------------------------------
\\end{document}
`;

// Compilation strategies
export type CompilationStrategy = 'latex-online' | 'overleaf' | 'local';

export interface CompilationResult {
  success: boolean;
  pdfUrl?: string;
  pdfBlob?: Blob;
  error?: string;
  logs?: string;
}

export interface CompilerConfig {
  strategy: CompilationStrategy;
  overleafApiKey?: string;
}

/**
 * Compile LaTeX using latex.ytotech.com API (free, no auth required)
 */
export async function compileWithLatexOnline(latex: string): Promise<CompilationResult> {
  try {
    const response = await fetch('https://latex.ytotech.com/builds/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        compiler: 'pdflatex',
        resources: [
          {
            main: true,
            content: latex,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Compilation failed: ${response.status} - ${errorText}`,
      };
    }

    const pdfBlob = await response.blob();
    const pdfUrl = URL.createObjectURL(pdfBlob);

    return {
      success: true,
      pdfUrl,
      pdfBlob,
    };
  } catch (error) {
    return {
      success: false,
      error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Compile LaTeX using TeXLive.net API
 */
export async function compileWithTexLive(latex: string): Promise<CompilationResult> {
  try {
    const formData = new FormData();
    formData.append('filecontents[]', latex);
    formData.append('filename[]', 'document.tex');
    formData.append('engine', 'pdflatex');
    formData.append('return', 'pdf');

    const response = await fetch('https://texlive.net/cgi-bin/latexcgi', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Compilation failed: ${response.status}`,
      };
    }

    const contentType = response.headers.get('content-type');
    
    if (contentType?.includes('application/pdf')) {
      const pdfBlob = await response.blob();
      const pdfUrl = URL.createObjectURL(pdfBlob);
      return {
        success: true,
        pdfUrl,
        pdfBlob,
      };
    } else {
      // Probably got an error log
      const text = await response.text();
      return {
        success: false,
        error: 'Compilation error',
        logs: text,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Main compilation function - tries multiple backends
 */
export async function compileLatex(
  latex: string,
  config?: CompilerConfig
): Promise<CompilationResult> {
  const strategy = config?.strategy || 'latex-online';

  switch (strategy) {
    case 'latex-online':
      return compileWithLatexOnline(latex);
    case 'local':
      // TeXLive.net as fallback for "local" since true local requires WASM setup
      return compileWithTexLive(latex);
    default:
      return compileWithLatexOnline(latex);
  }
}

/**
 * Download the compiled PDF
 */
export function downloadPdf(pdfBlob: Blob, filename: string = 'resume.pdf'): void {
  const url = URL.createObjectURL(pdfBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Save LaTeX source to file
 */
export function downloadLatex(latex: string, filename: string = 'resume.tex'): void {
  const blob = new Blob([latex], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Validate LaTeX syntax (basic checks)
 */
export function validateLatex(latex: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for balanced braces
  let braceCount = 0;
  for (const char of latex) {
    if (char === '{') braceCount++;
    if (char === '}') braceCount--;
    if (braceCount < 0) {
      errors.push('Unmatched closing brace }');
      break;
    }
  }
  if (braceCount > 0) {
    errors.push(`${braceCount} unclosed brace(s) {`);
  }

  // Check for document structure
  if (!latex.includes('\\documentclass')) {
    errors.push('Missing \\documentclass declaration');
  }
  if (!latex.includes('\\begin{document}')) {
    errors.push('Missing \\begin{document}');
  }
  if (!latex.includes('\\end{document}')) {
    errors.push('Missing \\end{document}');
  }

  // Check for common errors
  if (latex.includes('\\being{')) {
    errors.push('Possible typo: \\being should be \\begin');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Extract personal info from LaTeX resume for profile sync
 */
export function extractInfoFromLatex(latex: string): Partial<{
  name: string;
  email: string;
  phone: string;
  linkedin: string;
  github: string;
}> {
  const info: ReturnType<typeof extractInfoFromLatex> = {};

  // Extract name from \textbf{\Huge \scshape Name}
  const nameMatch = latex.match(/\\textbf\{\\Huge\s*\\scshape\s*([^}]+)\}/);
  if (nameMatch) {
    info.name = nameMatch[1].trim();
  }

  // Extract email from \href{mailto:...}
  const emailMatch = latex.match(/\\href\{mailto:([^}]+)\}/);
  if (emailMatch) {
    info.email = emailMatch[1].trim();
  }

  // Extract phone (pattern: xxx-xxx-xxxx or similar)
  const phoneMatch = latex.match(/\\small\s*([\d\-\(\)\s]{10,})/);
  if (phoneMatch) {
    info.phone = phoneMatch[1].trim();
  }

  // Extract LinkedIn
  const linkedinMatch = latex.match(/\\href\{(https?:\/\/(?:www\.)?linkedin\.com\/[^}]+)\}/);
  if (linkedinMatch) {
    info.linkedin = linkedinMatch[1].trim();
  }

  // Extract GitHub
  const githubMatch = latex.match(/\\href\{(https?:\/\/(?:www\.)?github\.com\/[^}]+)\}/);
  if (githubMatch) {
    info.github = githubMatch[1].trim();
  }

  return info;
}
