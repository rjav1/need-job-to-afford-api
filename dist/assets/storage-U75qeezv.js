const STORAGE_KEYS = {
  USER_PROFILE: "userProfile",
  APPLICATIONS: "applications",
  API_KEY: "apiKey",
  SETTINGS: "settings"
};
const DEFAULT_WEBHOOK_URL = "https://discord.com/api/webhooks/1470479336296419419/j4NJFVqVzBq9OScJC5YVdJn9k8GlmvzEWUOajYOSrQal3kga2afu_PiH9eyqv8oDD9iC";
const DEFAULT_SETTINGS = {
  aiProvider: "openai",
  autoFillEnabled: true,
  showPreviewBeforeFill: true,
  darkMode: false,
  noAiMode: false,
  preferTemplates: true,
  testMode: false,
  webhookEnabled: true,
  webhookUrl: DEFAULT_WEBHOOK_URL
};
const DEFAULT_PROFILE = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  zipCode: "",
  country: "United States",
  linkedinUrl: "",
  githubUrl: "",
  portfolioUrl: "",
  university: "",
  degree: "",
  major: "",
  gpa: "",
  graduationDate: "",
  workAuthorization: "us_citizen",
  yearsOfExperience: "",
  resumeText: "",
  resumeFileName: "",
  skills: [],
  projects: []
};
const storage = {
  // User Profile
  async getProfile() {
    const result = await chrome.storage.local.get(STORAGE_KEYS.USER_PROFILE);
    return result[STORAGE_KEYS.USER_PROFILE] || DEFAULT_PROFILE;
  },
  async saveProfile(profile) {
    await chrome.storage.local.set({ [STORAGE_KEYS.USER_PROFILE]: profile });
  },
  // API Key
  async getApiKey() {
    const result = await chrome.storage.local.get(STORAGE_KEYS.API_KEY);
    return result[STORAGE_KEYS.API_KEY] || "";
  },
  async saveApiKey(key) {
    await chrome.storage.local.set({ [STORAGE_KEYS.API_KEY]: key });
  },
  // Settings
  async getSettings() {
    const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
    return { ...DEFAULT_SETTINGS, ...result[STORAGE_KEYS.SETTINGS] };
  },
  async saveSettings(settings) {
    await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings });
  },
  // Applications
  async getApplications() {
    const result = await chrome.storage.local.get(STORAGE_KEYS.APPLICATIONS);
    return result[STORAGE_KEYS.APPLICATIONS] || [];
  },
  async saveApplication(app) {
    const apps = await this.getApplications();
    const existing = apps.findIndex((a) => a.id === app.id);
    if (existing >= 0) {
      apps[existing] = app;
    } else {
      apps.unshift(app);
    }
    await chrome.storage.local.set({ [STORAGE_KEYS.APPLICATIONS]: apps });
  },
  async deleteApplication(id) {
    const apps = await this.getApplications();
    const filtered = apps.filter((a) => a.id !== id);
    await chrome.storage.local.set({ [STORAGE_KEYS.APPLICATIONS]: filtered });
  },
  // Clear all data
  async clearAll() {
    await chrome.storage.local.clear();
  }
};
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
export {
  DEFAULT_PROFILE as D,
  DEFAULT_SETTINGS as a,
  DEFAULT_WEBHOOK_URL as b,
  generateId as g,
  storage as s
};
//# sourceMappingURL=storage-U75qeezv.js.map
