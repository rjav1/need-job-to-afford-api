import { 
  UserProfile, 
  ApplicationRecord, 
  Settings, 
  STORAGE_KEYS,
  DEFAULT_SETTINGS,
  DEFAULT_PROFILE 
} from './types';

// Chrome storage wrapper with type safety
export const storage = {
  // User Profile
  async getProfile(): Promise<UserProfile> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.USER_PROFILE);
    return result[STORAGE_KEYS.USER_PROFILE] || DEFAULT_PROFILE;
  },

  async saveProfile(profile: UserProfile): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEYS.USER_PROFILE]: profile });
  },

  // API Key
  async getApiKey(): Promise<string> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.API_KEY);
    return result[STORAGE_KEYS.API_KEY] || '';
  },

  async saveApiKey(key: string): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEYS.API_KEY]: key });
  },

  // Settings
  async getSettings(): Promise<Settings> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
    return { ...DEFAULT_SETTINGS, ...result[STORAGE_KEYS.SETTINGS] };
  },

  async saveSettings(settings: Settings): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings });
  },

  // Applications
  async getApplications(): Promise<ApplicationRecord[]> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.APPLICATIONS);
    return result[STORAGE_KEYS.APPLICATIONS] || [];
  },

  async saveApplication(app: ApplicationRecord): Promise<void> {
    const apps = await this.getApplications();
    const existing = apps.findIndex(a => a.id === app.id);
    if (existing >= 0) {
      apps[existing] = app;
    } else {
      apps.unshift(app);
    }
    await chrome.storage.local.set({ [STORAGE_KEYS.APPLICATIONS]: apps });
  },

  async deleteApplication(id: string): Promise<void> {
    const apps = await this.getApplications();
    const filtered = apps.filter(a => a.id !== id);
    await chrome.storage.local.set({ [STORAGE_KEYS.APPLICATIONS]: filtered });
  },

  // Clear all data
  async clearAll(): Promise<void> {
    await chrome.storage.local.clear();
  },
};

// Generate unique ID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
