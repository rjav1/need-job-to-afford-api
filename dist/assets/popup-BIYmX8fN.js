import { r as reactExports, j as jsxRuntimeExports, c as createRoot } from "./client-DBbAukrm.js";
import { D as DEFAULT_PROFILE, a as DEFAULT_SETTINGS, s as storage } from "./storage-U75qeezv.js";
function App() {
  const [profile, setProfile] = reactExports.useState(DEFAULT_PROFILE);
  const [settings, setSettings] = reactExports.useState(DEFAULT_SETTINGS);
  const [pageInfo, setPageInfo] = reactExports.useState(null);
  const [status, setStatus] = reactExports.useState("idle");
  const [message, setMessage] = reactExports.useState("");
  const [activeTab, setActiveTab] = reactExports.useState("fill");
  reactExports.useEffect(() => {
    Promise.all([storage.getProfile(), storage.getSettings()]).then(([p, s]) => {
      setProfile(p);
      setSettings(s);
    });
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      var _a;
      if ((_a = tabs[0]) == null ? void 0 : _a.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "GET_FIELDS" }, (response) => {
          if (response) {
            setPageInfo(response);
          }
        });
      }
    });
  }, []);
  const handleFillAll = async () => {
    if (!profile.firstName || !profile.email) {
      setStatus("error");
      setMessage("Please complete your profile first!");
      setActiveTab("profile");
      return;
    }
    setStatus("loading");
    setMessage("Filling forms...");
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      var _a;
      if ((_a = tabs[0]) == null ? void 0 : _a.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "FILL_ALL" }, (response) => {
          if (response == null ? void 0 : response.success) {
            setStatus("success");
            setMessage("Forms filled successfully!");
          } else {
            setStatus("error");
            setMessage("Some fields could not be filled.");
          }
        });
      }
    });
  };
  const handleRefresh = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      var _a;
      if ((_a = tabs[0]) == null ? void 0 : _a.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "REFRESH_DETECTION" }, (response) => {
          if (response) {
            setMessage(`Found ${response.count} fields`);
          }
        });
      }
    });
  };
  const handleProfileChange = (field, value) => {
    const newProfile = { ...profile, [field]: value };
    setProfile(newProfile);
    storage.saveProfile(newProfile);
  };
  const handleSkillsChange = (value) => {
    const skills = value.split(",").map((s) => s.trim()).filter(Boolean);
    const newProfile = { ...profile, skills };
    setProfile(newProfile);
    storage.saveProfile(newProfile);
  };
  const profileComplete = profile.firstName && profile.email && profile.university;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "popup", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("header", { className: "header", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "logo", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "AI Job Applier" })
      ] }),
      !profileComplete && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "badge warning", children: "Setup needed" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("nav", { className: "tabs", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          className: activeTab === "fill" ? "active" : "",
          onClick: () => setActiveTab("fill"),
          children: "Fill"
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          className: activeTab === "profile" ? "active" : "",
          onClick: () => setActiveTab("profile"),
          children: "Profile"
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          className: activeTab === "settings" ? "active" : "",
          onClick: () => setActiveTab("settings"),
          children: "Settings"
        }
      )
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("main", { className: "content", children: [
      activeTab === "fill" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "fill-tab", children: [
        pageInfo && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "job-info", children: [
          pageInfo.jobInfo.company && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: pageInfo.jobInfo.title || "Job Application" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: pageInfo.jobInfo.company })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "field-count", children: [
            pageInfo.fields.length,
            " fields detected"
          ] })
        ] }),
        message && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: `message ${status}`, children: message }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            className: "btn primary",
            onClick: handleFillAll,
            disabled: status === "loading",
            children: status === "loading" ? "Filling..." : "⚡ Auto-Fill All Fields"
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn secondary", onClick: handleRefresh, children: "🔄 Refresh Detection" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            className: "btn secondary",
            onClick: () => chrome.runtime.openOptionsPage(),
            children: "⚙️ Full Settings"
          }
        )
      ] }),
      activeTab === "profile" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "profile-tab", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { children: "First Name *" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "input",
            {
              type: "text",
              value: profile.firstName,
              onChange: (e) => handleProfileChange("firstName", e.target.value),
              placeholder: "John"
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
              onChange: (e) => handleProfileChange("lastName", e.target.value),
              placeholder: "Doe"
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
              onChange: (e) => handleProfileChange("email", e.target.value),
              placeholder: "john@example.com"
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
              onChange: (e) => handleProfileChange("phone", e.target.value),
              placeholder: "(555) 123-4567"
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { children: "University *" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "input",
            {
              type: "text",
              value: profile.university,
              onChange: (e) => handleProfileChange("university", e.target.value),
              placeholder: "Georgia Tech"
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
              onChange: (e) => handleProfileChange("major", e.target.value),
              placeholder: "Computer Science"
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
              onChange: (e) => handleProfileChange("gpa", e.target.value),
              placeholder: "3.8"
            }
          )
        ] }),
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
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { children: "Skills (comma separated)" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "input",
            {
              type: "text",
              value: profile.skills.join(", "),
              onChange: (e) => handleSkillsChange(e.target.value),
              placeholder: "Python, JavaScript, React, ..."
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "hint", children: [
          "For full profile setup including resume, ",
          /* @__PURE__ */ jsxRuntimeExports.jsx("a", { href: "#", onClick: () => chrome.runtime.openOptionsPage(), children: "open settings page" })
        ] })
      ] }),
      activeTab === "settings" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "settings-tab", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { children: "AI Provider" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "select",
            {
              value: settings.aiProvider,
              onChange: (e) => {
                const newSettings = { ...settings, aiProvider: e.target.value };
                setSettings(newSettings);
                storage.saveSettings(newSettings);
              },
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "openai", children: "OpenAI (GPT-4)" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "anthropic", children: "Anthropic (Claude)" })
              ]
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "form-group checkbox", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "input",
            {
              type: "checkbox",
              id: "autoFill",
              checked: settings.autoFillEnabled,
              onChange: (e) => {
                const newSettings = { ...settings, autoFillEnabled: e.target.checked };
                setSettings(newSettings);
                storage.saveSettings(newSettings);
              }
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { htmlFor: "autoFill", children: "Enable auto-fill on page load" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "form-group checkbox", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "input",
            {
              type: "checkbox",
              id: "preview",
              checked: settings.showPreviewBeforeFill,
              onChange: (e) => {
                const newSettings = { ...settings, showPreviewBeforeFill: e.target.checked };
                setSettings(newSettings);
                storage.saveSettings(newSettings);
              }
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { htmlFor: "preview", children: "Show preview before filling" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            className: "btn secondary full-width",
            onClick: () => chrome.runtime.openOptionsPage(),
            children: "Open Full Settings Page"
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("footer", { className: "footer", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("a", { href: "https://github.com/ai-job-applier", target: "_blank", children: "GitHub" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "v1.0.0" })
    ] })
  ] });
}
console.log('Popup script loading...');

function mountApp() {
  const container = document.getElementById("root");
  console.log('Mounting app, container:', container);
  
  if (container) {
    try {
      const root = createRoot(container);
      console.log('Root created, rendering App...');
      root.render(/* @__PURE__ */ jsxRuntimeExports.jsx(App, {}));
      console.log('App rendered successfully');
    } catch (error) {
      console.error('Error rendering app:', error);
      container.innerHTML = '<div style="padding: 16px; color: red;">Error loading extension: ' + error.message + '</div>';
    }
  } else {
    console.error('Root container not found!');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountApp);
} else {
  mountApp();
}
//# sourceMappingURL=popup-BIYmX8fN.js.map
