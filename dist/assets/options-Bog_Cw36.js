import { r as reactExports, j as jsxRuntimeExports, c as createRoot } from "./client-DBbAukrm.js";
import { D as DEFAULT_PROFILE, a as DEFAULT_SETTINGS, s as storage } from "./storage-U75qeezv.js";
const PATTERNS = {
  email: /[\w.-]+@[\w.-]+\.\w+/i,
  phone: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,
  linkedin: /linkedin\.com\/in\/[\w-]+/i,
  github: /github\.com\/[\w-]+/i,
  gpa: /(?:GPA|G\.P\.A\.?)[\s:]*(\d\.\d{1,2})(?:\s*\/\s*4\.0)?/i,
  // Education patterns
  university: /(?:University|College|Institute|School)\s+of\s+[\w\s]+|[\w\s]+(?:University|College|Institute|Tech|State)/gi,
  degree: /(?:Bachelor|Master|PhD|Ph\.D\.|B\.S\.|B\.A\.|M\.S\.|M\.A\.|B\.Sc\.|M\.Sc\.)[\w\s.,]*/gi,
  graduation: /(?:Expected\s+)?(?:Graduation|Graduate|Class of)[\s:]*(?:May|June|December|Spring|Fall|Summer)?\s*\d{4}/gi,
  // Skills patterns
  skills: /(?:Skills|Technologies|Technical Skills|Programming Languages)[\s:]*([^\n]+(?:\n(?![A-Z])[^\n]+)*)/i
};
function extractFromResume(resumeText) {
  resumeText.toLowerCase();
  const originalText = resumeText;
  const extracted = {};
  const emailMatch = originalText.match(PATTERNS.email);
  if (emailMatch) {
    extracted.email = emailMatch[0];
  }
  const phoneMatch = originalText.match(PATTERNS.phone);
  if (phoneMatch) {
    extracted.phone = phoneMatch[0].replace(/[^\d+]/g, "").replace(/^1/, "");
    if (extracted.phone.length === 10) {
      extracted.phone = `(${extracted.phone.slice(0, 3)}) ${extracted.phone.slice(3, 6)}-${extracted.phone.slice(6)}`;
    }
  }
  const linkedinMatch = originalText.match(PATTERNS.linkedin);
  if (linkedinMatch) {
    extracted.linkedinUrl = `https://${linkedinMatch[0]}`;
  }
  const githubMatch = originalText.match(PATTERNS.github);
  if (githubMatch) {
    extracted.githubUrl = `https://${githubMatch[0]}`;
  }
  const gpaMatch = originalText.match(PATTERNS.gpa);
  if (gpaMatch) {
    extracted.gpa = gpaMatch[1];
  }
  const uniMatches = originalText.match(PATTERNS.university);
  if (uniMatches && uniMatches.length > 0) {
    extracted.university = uniMatches[0].trim();
  }
  const degreeMatches = originalText.match(PATTERNS.degree);
  if (degreeMatches && degreeMatches.length > 0) {
    const degree = degreeMatches[0].trim();
    if (degree.toLowerCase().includes(" in ")) {
      const parts = degree.split(/\s+in\s+/i);
      extracted.degree = parts[0].trim();
      if (parts[1]) {
        extracted.major = parts[1].trim();
      }
    } else {
      extracted.degree = degree;
    }
  }
  const gradMatches = originalText.match(PATTERNS.graduation);
  if (gradMatches && gradMatches.length > 0) {
    extracted.graduationDate = gradMatches[0].replace(/(?:Expected\s+)?(?:Graduation|Graduate|Class of)[\s:]*/i, "").trim();
  }
  const skillsMatch = originalText.match(PATTERNS.skills);
  if (skillsMatch) {
    const skillsText = skillsMatch[1];
    const skills = skillsText.split(/[,;•|]|\n/).map((s) => s.trim()).filter((s) => s.length > 1 && s.length < 30).slice(0, 20);
    if (skills.length > 0) {
      extracted.skills = skills;
    }
  }
  const lines = originalText.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length > 0) {
    const firstLine = lines[0];
    if (/^[A-Z][a-z]+\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)?$/.test(firstLine)) {
      const nameParts = firstLine.split(/\s+/);
      extracted.firstName = nameParts[0];
      extracted.lastName = nameParts[nameParts.length - 1];
    }
  }
  return extracted;
}
function mergeWithProfile(profile, extracted) {
  const merged = { ...profile };
  for (const [key, value] of Object.entries(extracted)) {
    if (value && !profile[key]) {
      merged[key] = value;
    }
  }
  return merged;
}
function App() {
  const [profile, setProfile] = reactExports.useState(DEFAULT_PROFILE);
  const [settings, setSettings] = reactExports.useState(DEFAULT_SETTINGS);
  const [apiKey, setApiKey] = reactExports.useState("");
  const [applications, setApplications] = reactExports.useState([]);
  const [activeSection, setActiveSection] = reactExports.useState("profile");
  const [saved, setSaved] = reactExports.useState(false);
  const [newProject, setNewProject] = reactExports.useState({
    name: "",
    description: "",
    technologies: [],
    highlights: []
  });
  reactExports.useEffect(() => {
    Promise.all([
      storage.getProfile(),
      storage.getSettings(),
      storage.getApiKey(),
      storage.getApplications()
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
    setTimeout(() => setSaved(false), 2e3);
  };
  const handleProfileChange = (field, value) => {
    setProfile({ ...profile, [field]: value });
  };
  const handleAddProject = () => {
    if (newProject.name && newProject.description) {
      const updatedProfile = {
        ...profile,
        projects: [...profile.projects, newProject]
      };
      setProfile(updatedProfile);
      setNewProject({ name: "", description: "", technologies: [], highlights: [] });
    }
  };
  const handleRemoveProject = (index) => {
    const projects = profile.projects.filter((_, i) => i !== index);
    setProfile({ ...profile, projects });
  };
  const handleResumeUpload = (e) => {
    var _a;
    const file = (_a = e.target.files) == null ? void 0 : _a[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        var _a2;
        const resumeText = (_a2 = event.target) == null ? void 0 : _a2.result;
        setProfile({
          ...profile,
          resumeText,
          resumeFileName: file.name
        });
      };
      reader.readAsText(file);
    }
  };
  const handleParseResume = () => {
    if (!profile.resumeText) {
      alert("Please upload or paste your resume first!");
      return;
    }
    const extracted = extractFromResume(profile.resumeText);
    const merged = mergeWithProfile(profile, extracted);
    setProfile(merged);
    alert(`Extracted ${Object.keys(extracted).length} fields from your resume! Review and save your profile.`);
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "options-page", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("aside", { className: "sidebar", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "logo", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { width: "32", height: "32", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { children: "AI Job Applier" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("nav", { className: "nav", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            className: activeSection === "profile" ? "active" : "",
            onClick: () => setActiveSection("profile"),
            children: "👤 Profile"
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            className: activeSection === "projects" ? "active" : "",
            onClick: () => setActiveSection("projects"),
            children: "📁 Projects"
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            className: activeSection === "settings" ? "active" : "",
            onClick: () => setActiveSection("settings"),
            children: "⚙️ Settings"
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            className: activeSection === "history" ? "active" : "",
            onClick: () => setActiveSection("history"),
            children: "📋 History"
          }
        )
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: `save-btn ${saved ? "saved" : ""}`, onClick: handleSave, children: saved ? "✓ Saved!" : "Save Changes" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("main", { className: "main-content", children: [
      activeSection === "profile" && /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { children: "Personal Information" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "description", children: "This information will be used to auto-fill job applications." }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "form-grid", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "form-group", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("label", { children: "First Name *" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "input",
              {
                type: "text",
                value: profile.firstName,
                onChange: (e) => handleProfileChange("firstName", e.target.value)
              }
            )
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "form-group", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("label", { children: "Last Name *" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "input",
              {
                type: "text",
                value: profile.lastName,
                onChange: (e) => handleProfileChange("lastName", e.target.value)
              }
            )
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "form-group", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("label", { children: "Email *" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "input",
              {
                type: "email",
                value: profile.email,
                onChange: (e) => handleProfileChange("email", e.target.value)
              }
            )
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "form-group", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("label", { children: "Phone" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "input",
              {
                type: "tel",
                value: profile.phone,
                onChange: (e) => handleProfileChange("phone", e.target.value)
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "Address" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "form-grid", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "form-group full", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("label", { children: "Street Address" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "input",
              {
                type: "text",
                value: profile.address,
                onChange: (e) => handleProfileChange("address", e.target.value)
              }
            )
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "form-group", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("label", { children: "City" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "input",
              {
                type: "text",
                value: profile.city,
                onChange: (e) => handleProfileChange("city", e.target.value)
              }
            )
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "form-group", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("label", { children: "State" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "input",
              {
                type: "text",
                value: profile.state,
                onChange: (e) => handleProfileChange("state", e.target.value)
              }
            )
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "form-group", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("label", { children: "ZIP Code" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "input",
              {
                type: "text",
                value: profile.zipCode,
                onChange: (e) => handleProfileChange("zipCode", e.target.value)
              }
            )
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "form-group", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("label", { children: "Country" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "input",
              {
                type: "text",
                value: profile.country,
                onChange: (e) => handleProfileChange("country", e.target.value)
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "Links" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "form-grid", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "form-group", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("label", { children: "LinkedIn URL" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "input",
              {
                type: "url",
                value: profile.linkedinUrl,
                onChange: (e) => handleProfileChange("linkedinUrl", e.target.value),
                placeholder: "https://linkedin.com/in/..."
              }
            )
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "form-group", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("label", { children: "GitHub URL" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "input",
              {
                type: "url",
                value: profile.githubUrl,
                onChange: (e) => handleProfileChange("githubUrl", e.target.value),
                placeholder: "https://github.com/..."
              }
            )
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "form-group full", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("label", { children: "Portfolio / Website" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "input",
              {
                type: "url",
                value: profile.portfolioUrl,
                onChange: (e) => handleProfileChange("portfolioUrl", e.target.value)
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "Education" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "form-grid", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "form-group", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("label", { children: "University *" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "input",
              {
                type: "text",
                value: profile.university,
                onChange: (e) => handleProfileChange("university", e.target.value)
              }
            )
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "form-group", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("label", { children: "Degree" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "input",
              {
                type: "text",
                value: profile.degree,
                onChange: (e) => handleProfileChange("degree", e.target.value),
                placeholder: "Bachelor of Science"
              }
            )
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "form-group", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("label", { children: "Major" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "input",
              {
                type: "text",
                value: profile.major,
                onChange: (e) => handleProfileChange("major", e.target.value)
              }
            )
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "form-group", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("label", { children: "GPA" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "input",
              {
                type: "text",
                value: profile.gpa,
                onChange: (e) => handleProfileChange("gpa", e.target.value)
              }
            )
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "form-group", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("label", { children: "Graduation Date" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "input",
              {
                type: "text",
                value: profile.graduationDate,
                onChange: (e) => handleProfileChange("graduationDate", e.target.value),
                placeholder: "May 2026"
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "Work Authorization" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "form-grid", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "form-group", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("label", { children: "Work Authorization" }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs(
              "select",
              {
                value: profile.workAuthorization,
                onChange: (e) => handleProfileChange("workAuthorization", e.target.value),
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "us_citizen", children: "US Citizen" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "permanent_resident", children: "Permanent Resident" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "visa", children: "Visa Holder (requires sponsorship)" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "other", children: "Other" })
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "form-group", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("label", { children: "Years of Experience" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "input",
              {
                type: "text",
                value: profile.yearsOfExperience,
                onChange: (e) => handleProfileChange("yearsOfExperience", e.target.value)
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "Skills" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "form-group full", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { children: "Skills (comma separated)" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "textarea",
            {
              value: profile.skills.join(", "),
              onChange: (e) => handleProfileChange("skills", e.target.value.split(",").map((s) => s.trim()).filter(Boolean)),
              rows: 3,
              placeholder: "Python, JavaScript, React, Node.js, SQL, Git..."
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "Resume" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "form-group full", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { children: "Upload Resume (TXT or paste below)" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "file", accept: ".txt,.pdf", onChange: handleResumeUpload }),
          profile.resumeFileName && /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "file-name", children: [
            "📄 ",
            profile.resumeFileName
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "textarea",
            {
              value: profile.resumeText,
              onChange: (e) => handleProfileChange("resumeText", e.target.value),
              rows: 8,
              placeholder: "Paste your resume text here for AI to reference..."
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              className: "add-btn",
              onClick: handleParseResume,
              style: { marginTop: "12px" },
              children: "🔍 Extract Info from Resume"
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "hint", children: "Click to auto-fill your profile fields from your resume. Works best with plain text resumes." })
        ] })
      ] }),
      activeSection === "projects" && /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { children: "Projects" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "description", children: 'Add projects for the AI to reference when answering "describe a project" questions.' }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "projects-list", children: profile.projects.map((project, index) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "project-card", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "project-header", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("h4", { children: project.name }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "remove-btn", onClick: () => handleRemoveProject(index), children: "×" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: project.description }),
          project.technologies.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "tags", children: project.technologies.map((tech, i) => /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "tag", children: tech }, i)) })
        ] }, index)) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "add-project", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "Add New Project" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "form-grid", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "form-group", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("label", { children: "Project Name *" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "input",
                {
                  type: "text",
                  value: newProject.name,
                  onChange: (e) => setNewProject({ ...newProject, name: e.target.value })
                }
              )
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "form-group full", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("label", { children: "Description *" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "textarea",
                {
                  value: newProject.description,
                  onChange: (e) => setNewProject({ ...newProject, description: e.target.value }),
                  rows: 3
                }
              )
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "form-group full", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("label", { children: "Technologies (comma separated)" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "input",
                {
                  type: "text",
                  value: newProject.technologies.join(", "),
                  onChange: (e) => setNewProject({
                    ...newProject,
                    technologies: e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                  }),
                  placeholder: "React, Python, TensorFlow..."
                }
              )
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "add-btn", onClick: handleAddProject, children: "+ Add Project" })
        ] })
      ] }),
      activeSection === "settings" && /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { children: "Settings" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "AI Configuration" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "form-grid", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "form-group", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("label", { children: "AI Provider" }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs(
              "select",
              {
                value: settings.aiProvider,
                onChange: (e) => setSettings({ ...settings, aiProvider: e.target.value }),
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "openai", children: "OpenAI (GPT-4)" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "anthropic", children: "Anthropic (Claude)" })
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "form-group", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("label", { children: "API Key *" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "input",
              {
                type: "password",
                value: apiKey,
                onChange: (e) => setApiKey(e.target.value),
                placeholder: "sk-... or sk-ant-..."
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "hint", children: "Your API key is stored locally and never sent to our servers." })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "AI Mode" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "form-group checkbox", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "input",
            {
              type: "checkbox",
              id: "testMode",
              checked: settings.testMode,
              onChange: (e) => setSettings({ ...settings, testMode: e.target.checked })
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { htmlFor: "testMode", children: "🧪 Test Mode (Discord AI via Ronald)" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "hint", style: { marginBottom: "12px", marginLeft: "28px" }, children: "Routes AI requests to Discord #job-applier-ai channel. Ronald will respond with AI-generated answers." }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "form-group checkbox", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "input",
            {
              type: "checkbox",
              id: "noAiMode",
              checked: settings.noAiMode,
              onChange: (e) => setSettings({ ...settings, noAiMode: e.target.checked })
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { htmlFor: "noAiMode", children: "No AI Mode (use templates only, no API key needed)" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "form-group checkbox", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "input",
            {
              type: "checkbox",
              id: "preferTemplates",
              checked: settings.preferTemplates,
              onChange: (e) => setSettings({ ...settings, preferTemplates: e.target.checked })
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { htmlFor: "preferTemplates", children: "Prefer templates over AI (saves API costs)" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "hint", style: { marginBottom: "16px" }, children: `Templates work for common questions like "Why this company?", "Tell us about yourself", etc. Enable "No AI Mode" if you don't have an API key.` }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "Behavior" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "form-group checkbox", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "input",
            {
              type: "checkbox",
              id: "autoFill",
              checked: settings.autoFillEnabled,
              onChange: (e) => setSettings({ ...settings, autoFillEnabled: e.target.checked })
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { htmlFor: "autoFill", children: "Auto-fill forms when page loads" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "form-group checkbox", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "input",
            {
              type: "checkbox",
              id: "preview",
              checked: settings.showPreviewBeforeFill,
              onChange: (e) => setSettings({ ...settings, showPreviewBeforeFill: e.target.checked })
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { htmlFor: "preview", children: "Show preview before filling" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "form-group checkbox", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "input",
            {
              type: "checkbox",
              id: "darkMode",
              checked: settings.darkMode,
              onChange: (e) => setSettings({ ...settings, darkMode: e.target.checked })
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { htmlFor: "darkMode", children: "Dark mode" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "Notifications" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "form-group checkbox", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "input",
            {
              type: "checkbox",
              id: "webhookEnabled",
              checked: settings.webhookEnabled,
              onChange: (e) => setSettings({ ...settings, webhookEnabled: e.target.checked })
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { htmlFor: "webhookEnabled", children: "🔔 Discord Webhook Notifications" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "hint", style: { marginBottom: "12px", marginLeft: "28px" }, children: "Get notified in Discord when you successfully fill a job application." }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { htmlFor: "webhookUrl", children: "Custom Webhook URL (optional)" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "input",
            {
              type: "text",
              id: "webhookUrl",
              value: settings.webhookUrl || "",
              onChange: (e) => setSettings({ ...settings, webhookUrl: e.target.value }),
              placeholder: "https://discord.com/api/webhooks/..."
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "hint", children: "Leave empty to use the default webhook." })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "Data" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            className: "danger-btn",
            onClick: async () => {
              if (confirm("Are you sure? This will delete all your data.")) {
                await storage.clearAll();
                window.location.reload();
              }
            },
            children: "Clear All Data"
          }
        )
      ] }),
      activeSection === "history" && /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { children: "Application History" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "description", children: "Track jobs you've applied to." }),
        applications.length === 0 ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "empty-state", children: /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: "No applications yet. Start applying to jobs!" }) }) : /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "applications-list", children: applications.map((app) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "application-card", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "app-info", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("h4", { children: app.jobTitle }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: app.companyName }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: `status ${app.status}`, children: app.status })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "app-meta", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: new Date(app.appliedAt).toLocaleDateString() }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("a", { href: app.jobUrl, target: "_blank", children: "View Job" })
          ] })
        ] }, app.id)) })
      ] })
    ] })
  ] });
}
const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(/* @__PURE__ */ jsxRuntimeExports.jsx(App, {}));
}
//# sourceMappingURL=options-Bog_Cw36.js.map
