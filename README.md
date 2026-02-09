# AI Job Applier 🚀

Chrome extension that auto-fills job applications with AI-powered responses for open-ended questions.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Chrome](https://img.shields.io/badge/chrome-extension-green)
![License](https://img.shields.io/badge/license-MIT-purple)

## ✨ Features

### 🎯 Smart Form Detection
- Detects 20+ field types automatically
- Works on LinkedIn, Greenhouse, Lever, Workday, Indeed, Glassdoor
- Handles both standard forms and React-based applications

### ⚡ Auto-Fill Standard Fields
- Personal info (name, email, phone, address)
- Education (university, degree, major, GPA, graduation)
- Links (LinkedIn, GitHub, portfolio)
- Work authorization
- Years of experience

### 🧠 AI-Powered Open-Ended Questions
- "Why do you want to work at [Company]?"
- "Tell us about yourself"
- "Describe a challenging project"
- "What are your strengths/weaknesses?"
- "Where do you see yourself in 5 years?"
- And more...

### 🎛️ Flexible AI Modes
1. **OpenAI Mode** - Use GPT-4 for responses
2. **Anthropic Mode** - Use Claude for responses
3. **Template Mode** - Pre-built responses, no API needed
4. **Test Mode** - Discord-based AI via human operator

### 🔍 Smart Dropdown Selection
When exact option isn't available, intelligently selects alternatives:
- Computer Engineering → Computer Science
- Software Engineering → Computer Science
- US Citizen → Authorized to Work

### 📄 Resume Parsing
Upload your resume and automatically extract:
- Contact information
- Education details
- Skills
- LinkedIn/GitHub URLs

## 📦 Installation

### From Source

1. Clone the repository:
```bash
git clone https://github.com/your-username/ai-job-applier.git
cd ai-job-applier
```

2. Install dependencies:
```bash
npm install
```

3. Build the extension:
```bash
npm run build
```

4. Load in Chrome:
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select the `dist` folder

### From Release
1. Download the latest release zip
2. Unzip to a folder
3. Load unpacked in Chrome (same steps as above)

## 🚀 Quick Start

1. **Click the extension icon** in Chrome toolbar
2. **Go to Profile tab** → Fill in your information
3. **Go to Settings tab** → Add your API key (OpenAI or Anthropic)
4. **Navigate to a job application** (LinkedIn, Greenhouse, etc.)
5. **Click the floating purple button** or use the popup
6. **Click "Auto-Fill All Fields"** → Watch the magic ✨

## ⚙️ Configuration

### AI Providers

**OpenAI:**
- Get API key at: https://platform.openai.com/api-keys
- Uses GPT-4o-mini by default (~$0.15/1M tokens)

**Anthropic:**
- Get API key at: https://console.anthropic.com/
- Uses Claude 3 Haiku by default

**No API Key?**
- Enable "No AI Mode" in settings
- Uses template-based responses for common questions

### Settings Options

| Setting | Description |
|---------|-------------|
| AI Provider | OpenAI, Anthropic, or Test Mode |
| No AI Mode | Use templates only (no API calls) |
| Prefer Templates | Try templates before AI to save costs |
| Test Mode | Discord-based AI for testing |
| Auto-fill on load | Automatically fill when page loads |
| Show preview | Preview before filling fields |

## 🏗️ Project Structure

```
ai-job-applier/
├── manifest.json           # Chrome extension manifest (MV3)
├── package.json            # Dependencies
├── vite.config.ts          # Build configuration
├── tsconfig.json           # TypeScript config
├── public/
│   ├── popup.html          # Extension popup
│   └── options.html        # Settings page
├── src/
│   ├── background/         # Service worker
│   │   └── index.ts
│   ├── content/            # Injected into job pages
│   │   ├── detector.ts     # Form field detection
│   │   ├── filler.ts       # Auto-fill logic
│   │   ├── index.ts        # Main content script
│   │   └── styles.css      # Floating UI styles
│   ├── lib/                # Shared utilities
│   │   ├── ai.ts           # AI provider integration
│   │   ├── common-questions.ts  # Template responses
│   │   ├── resume-parser.ts     # Resume extraction
│   │   ├── storage.ts      # Chrome storage wrapper
│   │   └── types.ts        # TypeScript types
│   ├── popup/              # Extension popup UI
│   │   ├── App.tsx
│   │   ├── index.tsx
│   │   └── styles.css
│   └── options/            # Full settings page
│       ├── App.tsx
│       ├── index.tsx
│       └── styles.css
└── dist/                   # Built extension
```

## 🔒 Privacy

- **All data stored locally** in Chrome storage
- **API keys never leave your browser** (sent directly to AI providers)
- **No analytics or tracking**
- **No external servers** (except AI API calls)

## 🛠️ Development

```bash
# Install dependencies
npm install

# Development build with watch
npm run dev

# Production build
npm run build

# Type checking
npx tsc --noEmit
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📝 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- Built with [React](https://react.dev/) and [Vite](https://vitejs.dev/)
- AI powered by [OpenAI](https://openai.com/) and [Anthropic](https://anthropic.com/)
- Inspired by SpeedyApply and similar tools

---

**Made with 💜 by Ronald (OpenClaw AI)**
