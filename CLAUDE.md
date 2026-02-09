# AI Job Applier - Chrome Extension

## Project Overview
Chrome extension that auto-fills job applications with AI-powered responses for open-ended questions.

## Tech Stack
- Chrome Extension (Manifest V3)
- React 18 for UI (popup + options page)
- Vite for bundling
- TypeScript
- OpenAI/Anthropic API for AI responses

## Directory Structure
```
/
├── manifest.json        # Chrome extension manifest
├── package.json         # Dependencies
├── vite.config.ts       # Vite config for extension
├── src/
│   ├── popup/           # Extension popup UI
│   │   ├── App.tsx      # Main popup component
│   │   ├── index.tsx    # Entry point
│   │   └── styles.css   # Popup styles
│   ├── options/         # Settings page
│   │   ├── App.tsx      # Options page component  
│   │   ├── index.tsx    # Entry point
│   │   └── styles.css   # Options styles
│   ├── content/         # Content scripts (injected into job pages)
│   │   ├── index.ts     # Main content script
│   │   ├── detector.ts  # Detects form fields on job pages
│   │   ├── filler.ts    # Fills form fields
│   │   └── styles.css   # Injected styles
│   ├── background/      # Service worker
│   │   └── index.ts     # Background script
│   └── lib/             # Shared utilities
│       ├── storage.ts   # Chrome storage wrapper
│       ├── ai.ts        # AI API calls
│       └── types.ts     # TypeScript types
├── public/
│   ├── popup.html
│   └── options.html
└── assets/
    └── icons
```

## Core Features
1. **Profile Setup** - User enters personal info, uploads resume
2. **Form Detection** - Content script detects input fields on job application pages
3. **Auto-Fill** - Fills standard fields (name, email, phone, etc.)
4. **AI Responses** - Generates answers for open-ended questions using GPT/Claude
5. **Application Tracker** - Tracks which jobs user has applied to

## Form Field Mappings
Standard fields to auto-detect:
- First Name / Last Name / Full Name
- Email
- Phone
- Address / City / State / Zip
- LinkedIn URL
- GitHub URL
- Portfolio/Website
- Resume upload
- University / School
- Degree / Major
- GPA
- Graduation Date
- Work Authorization
- Years of Experience

Open-ended questions (AI-generated):
- "Why do you want to work at [Company]?"
- "Tell us about yourself"
- "Describe a challenging project"
- "Why are you interested in this role?"
- "What are your strengths/weaknesses?"
- Custom questions

## UI Requirements
- Clean, modern design
- Dark mode support
- Easy profile setup flow
- One-click autofill button
- Status indicators for each field
- Preview AI-generated responses before submitting
