var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { s as storage, b as DEFAULT_WEBHOOK_URL, g as generateId } from "../../assets/storage-U75qeezv.js";
const STORAGE_PREFIX = "formMemory_";
const SITE_INDEX_KEY = "formMemory_siteIndex";
class FormMemory {
  constructor() {
    __publicField(this, "cache", /* @__PURE__ */ new Map());
    __publicField(this, "siteIndex", []);
    this.loadSiteIndex();
  }
  /**
   * Load the index of known sites
   */
  async loadSiteIndex() {
    try {
      const result = await chrome.storage.local.get(SITE_INDEX_KEY);
      this.siteIndex = result[SITE_INDEX_KEY] || [];
    } catch (e) {
      console.log("[FormMemory] Error loading site index:", e);
      this.siteIndex = [];
    }
  }
  /**
   * Save the site index
   */
  async saveSiteIndex() {
    try {
      await chrome.storage.local.set({ [SITE_INDEX_KEY]: this.siteIndex });
    } catch (e) {
      console.log("[FormMemory] Error saving site index:", e);
    }
  }
  /**
   * Get the domain key for a URL
   */
  getDomainKey(url) {
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace(/^www\./, "");
    } catch {
      return "unknown";
    }
  }
  /**
   * Get pattern for a site
   */
  async getPattern(url) {
    const domain = this.getDomainKey(url);
    if (this.cache.has(domain)) {
      return this.cache.get(domain);
    }
    try {
      const key = STORAGE_PREFIX + domain;
      const result = await chrome.storage.local.get(key);
      const pattern = result[key];
      if (pattern) {
        this.cache.set(domain, pattern);
        return pattern;
      }
    } catch (e) {
      console.log("[FormMemory] Error loading pattern:", e);
    }
    return null;
  }
  /**
   * Save or update pattern for a site
   */
  async savePattern(url, pattern) {
    const domain = this.getDomainKey(url);
    let existing = await this.getPattern(url);
    if (existing) {
      existing = {
        ...existing,
        ...pattern,
        fieldMappings: mergeFieldMappings(existing.fieldMappings, pattern.fieldMappings || []),
        hints: { ...existing.hints, ...pattern.hints },
        lastUpdated: Date.now()
      };
    } else {
      existing = {
        domain,
        fieldMappings: pattern.fieldMappings || [],
        hints: pattern.hints || {},
        lastUpdated: Date.now(),
        successRate: 0,
        applicationCount: 0,
        ...pattern
      };
    }
    this.cache.set(domain, existing);
    try {
      const key = STORAGE_PREFIX + domain;
      await chrome.storage.local.set({ [key]: existing });
      if (!this.siteIndex.includes(domain)) {
        this.siteIndex.push(domain);
        await this.saveSiteIndex();
      }
    } catch (e) {
      console.log("[FormMemory] Error saving pattern:", e);
    }
  }
  /**
   * Record a successful field mapping
   */
  async recordSuccess(url, selector, fieldType) {
    const pattern = await this.getPattern(url) || {
      domain: this.getDomainKey(url),
      fieldMappings: [],
      hints: {},
      lastUpdated: Date.now(),
      successRate: 0,
      applicationCount: 0
    };
    let mapping = pattern.fieldMappings.find(
      (m) => m.fieldType === fieldType && selectorMatches(m.selectors, selector)
    );
    if (mapping) {
      mapping.successCount++;
      mapping.confidence = Math.min(0.99, mapping.confidence + 0.05);
      mapping.lastUsed = Date.now();
    } else {
      mapping = {
        selectors: [selector],
        fieldType,
        confidence: 0.7,
        successCount: 1,
        lastUsed: Date.now()
      };
      pattern.fieldMappings.push(mapping);
    }
    await this.savePattern(url, pattern);
  }
  /**
   * Record a failed field mapping (reduces confidence)
   */
  async recordFailure(url, selector, fieldType) {
    const pattern = await this.getPattern(url);
    if (!pattern) return;
    const mapping = pattern.fieldMappings.find(
      (m) => m.fieldType === fieldType && selectorMatches(m.selectors, selector)
    );
    if (mapping) {
      mapping.confidence = Math.max(0.1, mapping.confidence - 0.1);
    }
    await this.savePattern(url, pattern);
  }
  /**
   * Record an application completion
   */
  async recordApplication(url, success) {
    const pattern = await this.getPattern(url);
    if (!pattern) return;
    pattern.applicationCount++;
    const alpha = 0.3;
    pattern.successRate = alpha * (success ? 1 : 0) + (1 - alpha) * pattern.successRate;
    await this.savePattern(url, pattern);
  }
  /**
   * Find field type from memory based on selector
   */
  async findFieldType(url, selector) {
    const pattern = await this.getPattern(url);
    if (!pattern) return null;
    let bestMatch = null;
    let bestScore = 0;
    for (const mapping of pattern.fieldMappings) {
      const score = calculateMatchScore(mapping.selectors, selector) * mapping.confidence;
      if (score > bestScore && score > 0.3) {
        bestScore = score;
        bestMatch = mapping;
      }
    }
    if (bestMatch) {
      return {
        type: bestMatch.fieldType,
        confidence: bestScore
      };
    }
    return null;
  }
  /**
   * Get all known sites
   */
  async getAllSites() {
    const patterns = [];
    for (const domain of this.siteIndex) {
      try {
        const key = STORAGE_PREFIX + domain;
        const result = await chrome.storage.local.get(key);
        if (result[key]) {
          patterns.push(result[key]);
        }
      } catch (e) {
      }
    }
    return patterns;
  }
  /**
   * Clear all memory
   */
  async clearAll() {
    try {
      const keysToRemove = this.siteIndex.map((d) => STORAGE_PREFIX + d);
      keysToRemove.push(SITE_INDEX_KEY);
      await chrome.storage.local.remove(keysToRemove);
      this.cache.clear();
      this.siteIndex = [];
    } catch (e) {
      console.log("[FormMemory] Error clearing memory:", e);
    }
  }
  /**
   * Export memory to JSON
   */
  async export() {
    const patterns = await this.getAllSites();
    return JSON.stringify(patterns, null, 2);
  }
  /**
   * Import memory from JSON
   */
  async import(json) {
    try {
      const patterns = JSON.parse(json);
      let imported = 0;
      for (const pattern of patterns) {
        await this.savePattern(`https://${pattern.domain}`, pattern);
        imported++;
      }
      return imported;
    } catch (e) {
      console.log("[FormMemory] Error importing:", e);
      throw e;
    }
  }
}
function mergeFieldMappings(existing, newMappings) {
  const merged = [...existing];
  for (const newMapping of newMappings) {
    const existingIdx = merged.findIndex((m) => m.fieldType === newMapping.fieldType);
    if (existingIdx >= 0) {
      const existingMapping = merged[existingIdx];
      for (const selector of newMapping.selectors) {
        if (!existingMapping.selectors.some((s) => selectorEquals(s, selector))) {
          existingMapping.selectors.push(selector);
        }
      }
      existingMapping.successCount += newMapping.successCount;
      existingMapping.confidence = Math.max(existingMapping.confidence, newMapping.confidence);
    } else {
      merged.push(newMapping);
    }
  }
  return merged;
}
function selectorEquals(a, b) {
  return a.id === b.id && a.name === b.name && a.type === b.type && a.labelPattern === b.labelPattern;
}
function selectorMatches(selectors, target) {
  return selectors.some((s) => {
    if (s.id && target.id && s.id === target.id) return true;
    if (s.name && target.name && s.name === target.name) return true;
    if (s.labelPattern && target.labelPattern) {
      try {
        const regex = new RegExp(s.labelPattern, "i");
        if (regex.test(target.labelPattern)) return true;
      } catch {
        if (s.labelPattern === target.labelPattern) return true;
      }
    }
    return false;
  });
}
function calculateMatchScore(selectors, target) {
  let maxScore = 0;
  for (const selector of selectors) {
    let score = 0;
    let factors = 0;
    if (selector.id && target.id) {
      factors++;
      if (selector.id === target.id) score += 1;
      else if (target.id.includes(selector.id) || selector.id.includes(target.id)) score += 0.5;
    }
    if (selector.name && target.name) {
      factors++;
      if (selector.name === target.name) score += 0.9;
      else if (target.name.includes(selector.name) || selector.name.includes(target.name)) score += 0.4;
    }
    if (selector.type && target.type) {
      factors++;
      if (selector.type === target.type) score += 0.7;
    }
    if (selector.labelPattern && target.labelPattern) {
      factors++;
      try {
        const regex = new RegExp(selector.labelPattern, "i");
        if (regex.test(target.labelPattern)) score += 0.8;
      } catch {
        if (target.labelPattern.toLowerCase().includes(selector.labelPattern.toLowerCase())) {
          score += 0.6;
        }
      }
    }
    if (selector.ariaLabel && target.ariaLabel) {
      factors++;
      if (selector.ariaLabel === target.ariaLabel) score += 0.8;
      else if (target.ariaLabel.toLowerCase().includes(selector.ariaLabel.toLowerCase())) score += 0.5;
    }
    if (selector.placeholder && target.placeholder) {
      factors++;
      if (selector.placeholder === target.placeholder) score += 0.7;
      else if (target.placeholder.toLowerCase().includes(selector.placeholder.toLowerCase())) score += 0.4;
    }
    if (factors > 0) {
      const normalizedScore = score / factors;
      maxScore = Math.max(maxScore, normalizedScore);
    }
  }
  return maxScore;
}
const formMemory = new FormMemory();
const BUILTIN_PATTERNS = {
  "workday.com": {
    hints: {
      atsType: "workday",
      framework: "react",
      hasMultiStep: true,
      nextButtonSelector: '[data-automation-id="bottom-navigation-next-button"]',
      submitButtonSelector: '[data-automation-id="bottom-navigation-next-button"]',
      fieldDelay: 300
    }
  },
  "myworkdayjobs.com": {
    hints: {
      atsType: "workday",
      framework: "react",
      hasMultiStep: true,
      nextButtonSelector: '[data-automation-id="bottom-navigation-next-button"]',
      submitButtonSelector: '[data-automation-id="bottom-navigation-next-button"]',
      fieldDelay: 300
    }
  },
  "greenhouse.io": {
    hints: {
      atsType: "greenhouse",
      hasMultiStep: false,
      submitButtonSelector: "#submit_app",
      fieldDelay: 100
    }
  },
  "lever.co": {
    hints: {
      atsType: "lever",
      hasMultiStep: false,
      submitButtonSelector: ".postings-btn-submit",
      fieldDelay: 100
    }
  },
  "icims.com": {
    hints: {
      atsType: "icims",
      hasMultiStep: true,
      fieldDelay: 200
    }
  },
  "taleo.net": {
    hints: {
      atsType: "taleo",
      hasMultiStep: true,
      fieldDelay: 300
    }
  },
  "jobvite.com": {
    hints: {
      atsType: "jobvite",
      hasMultiStep: false,
      fieldDelay: 150
    }
  }
};
async function initBuiltinPatterns() {
  for (const [domain, pattern] of Object.entries(BUILTIN_PATTERNS)) {
    const existing = await formMemory.getPattern(`https://${domain}`);
    if (!existing) {
      await formMemory.savePattern(`https://${domain}`, pattern);
    }
  }
}
initBuiltinPatterns().catch(console.error);
const FIELD_PATTERNS = {
  firstName: [/first\s*name/i, /given\s*name/i, /fname/i, /^first$/i],
  lastName: [/last\s*name/i, /surname/i, /family\s*name/i, /lname/i, /^last$/i],
  fullName: [/full\s*name/i, /^name$/i, /your\s*name/i, /legal\s*name/i],
  email: [/e-?mail/i, /email\s*address/i],
  phone: [/phone/i, /mobile/i, /cell/i, /telephone/i, /contact\s*number/i],
  address: [/street\s*address/i, /address\s*line/i, /^address$/i, /mailing\s*address/i],
  city: [/^city$/i, /city\s*name/i],
  state: [/^state$/i, /province/i, /region/i],
  zipCode: [/zip/i, /postal/i, /post\s*code/i],
  country: [/country/i, /nation/i],
  linkedin: [/linkedin/i, /linked-in/i],
  github: [/github/i, /git-hub/i],
  portfolio: [/portfolio/i, /website/i, /personal\s*site/i, /url/i],
  university: [/university/i, /college/i, /school/i, /institution/i, /alma\s*mater/i],
  degree: [/degree/i, /qualification/i, /diploma/i],
  major: [/major/i, /field\s*of\s*study/i, /concentration/i, /specialization/i],
  gpa: [/gpa/i, /grade\s*point/i, /cumulative\s*gpa/i],
  graduationDate: [/graduat/i, /completion\s*date/i, /expected\s*graduat/i],
  workAuthorization: [/work\s*auth/i, /visa/i, /sponsor/i, /legal.*work/i, /authorized.*work/i, /citizenship/i],
  yearsOfExperience: [/years?\s*(of)?\s*experience/i, /experience\s*level/i, /how\s*many\s*years/i],
  resume: [/resume/i, /cv/i, /curriculum/i],
  coverLetter: [/cover\s*letter/i, /letter\s*of\s*interest/i],
  openEnded: [/why/i, /describe/i, /tell\s*us/i, /explain/i, /what\s*makes/i, /how\s*would/i],
  unknown: []
};
function detectFieldType(labelText, inputType, inputName) {
  const text = `${labelText} ${inputName}`.toLowerCase();
  if (inputType === "file") {
    if (/resume|cv/i.test(text)) return { type: "resume", confidence: 0.95 };
    if (/cover/i.test(text)) return { type: "coverLetter", confidence: 0.9 };
  }
  for (const [fieldType, patterns] of Object.entries(FIELD_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        return { type: fieldType, confidence: 0.85 };
      }
    }
  }
  if (inputType === "textarea" && text.length > 20) {
    return { type: "openEnded", confidence: 0.7 };
  }
  return { type: "unknown", confidence: 0 };
}
function getLabelText(element) {
  var _a, _b, _c;
  const id = element.id;
  if (id) {
    const label = document.querySelector(`label[for="${id}"]`);
    if (label) return ((_a = label.textContent) == null ? void 0 : _a.trim()) || "";
  }
  const parentLabel = element.closest("label");
  if (parentLabel) {
    return ((_b = parentLabel.textContent) == null ? void 0 : _b.trim()) || "";
  }
  const ariaLabel = element.getAttribute("aria-label");
  if (ariaLabel) return ariaLabel;
  const placeholder = element.getAttribute("placeholder");
  if (placeholder) return placeholder;
  const parent = element.parentElement;
  if (parent) {
    const textNodes = Array.from(parent.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => {
      var _a2;
      return (_a2 = n.textContent) == null ? void 0 : _a2.trim();
    }).filter(Boolean);
    if (textNodes.length) return textNodes[0] || "";
    const labelSpan = parent.querySelector('.label, .field-label, [class*="label"]');
    if (labelSpan) return ((_c = labelSpan.textContent) == null ? void 0 : _c.trim()) || "";
  }
  return "";
}
const CUSTOM_DROPDOWN_SELECTORS = [
  "button[aria-haspopup]",
  '[role="combobox"]',
  '[role="listbox"]',
  // Greenhouse specific
  '[data-qa="dropdown"]',
  ".select__control",
  '[class*="select-dropdown"]',
  // Workday specific
  '[data-automation-id*="select"]',
  '[data-automation-id*="dropdown"]',
  '.WDFC[data-automation-widget="wd-popup"]',
  // Generic custom selects
  ".custom-select",
  '[class*="dropdown-trigger"]',
  '[class*="select-trigger"]'
].join(", ");
function detectFormFields() {
  const fields = [];
  const inputs = document.querySelectorAll(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select'
  );
  for (const input of inputs) {
    if (!isVisible(input)) continue;
    const label = getLabelText(input);
    const inputType = input.tagName.toLowerCase() === "textarea" ? "textarea" : input.type || "text";
    const inputName = input.name || input.id || "";
    const { type, confidence } = detectFieldType(label, inputType, inputName);
    if (type !== "unknown" || label) {
      fields.push({
        element: input,
        fieldType: type,
        label,
        isRequired: input.required || input.getAttribute("aria-required") === "true",
        confidence
      });
    }
  }
  const customDropdowns = document.querySelectorAll(CUSTOM_DROPDOWN_SELECTORS);
  for (const dropdown of customDropdowns) {
    if (!isVisible(dropdown)) continue;
    if (fields.some((f) => f.element === dropdown || f.element.contains(dropdown) || dropdown.contains(f.element))) continue;
    const label = getLabelText(dropdown) || getDropdownLabel(dropdown);
    const { type, confidence } = detectFieldType(label, "select", dropdown.id || "");
    if (label || type !== "unknown") {
      fields.push({
        element: dropdown,
        fieldType: type,
        label,
        isRequired: dropdown.getAttribute("aria-required") === "true" || dropdown.closest('[data-required="true"]') !== null || !!dropdown.querySelector('[class*="required"]'),
        confidence: Math.max(confidence, 0.6)
        // Custom dropdowns get at least 0.6 confidence
      });
    }
  }
  return fields;
}
function getDropdownLabel(element) {
  var _a, _b, _c;
  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy) {
    const labelEl = document.getElementById(labelledBy);
    if (labelEl) return ((_a = labelEl.textContent) == null ? void 0 : _a.trim()) || "";
  }
  let parent = element.parentElement;
  for (let i = 0; i < 3 && parent; i++) {
    const label = parent.querySelector('label, [class*="label"]');
    if (label && !element.contains(label)) {
      return ((_b = label.textContent) == null ? void 0 : _b.trim()) || "";
    }
    const prev = parent.previousElementSibling;
    if (prev && (prev.tagName === "LABEL" || prev.classList.toString().includes("label"))) {
      return ((_c = prev.textContent) == null ? void 0 : _c.trim()) || "";
    }
    parent = parent.parentElement;
  }
  return element.getAttribute("title") || element.getAttribute("data-label") || element.getAttribute("data-placeholder") || "";
}
function isVisible(el) {
  const style = window.getComputedStyle(el);
  return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0" && el.offsetParent !== null;
}
function detectJobInfo() {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x;
  const info = { company: "", title: "" };
  if (window.location.hostname.includes("linkedin.com")) {
    info.company = ((_b = (_a = document.querySelector(".jobs-unified-top-card__company-name")) == null ? void 0 : _a.textContent) == null ? void 0 : _b.trim()) || ((_d = (_c = document.querySelector(".topcard__org-name-link")) == null ? void 0 : _c.textContent) == null ? void 0 : _d.trim()) || "";
    info.title = ((_f = (_e = document.querySelector(".jobs-unified-top-card__job-title")) == null ? void 0 : _e.textContent) == null ? void 0 : _f.trim()) || ((_h = (_g = document.querySelector(".topcard__title")) == null ? void 0 : _g.textContent) == null ? void 0 : _h.trim()) || "";
  }
  if (window.location.hostname.includes("greenhouse.io")) {
    info.company = ((_j = (_i = document.querySelector(".company-name")) == null ? void 0 : _i.textContent) == null ? void 0 : _j.trim()) || ((_l = (_k = document.querySelector('[class*="company"]')) == null ? void 0 : _k.textContent) == null ? void 0 : _l.trim()) || "";
    info.title = ((_n = (_m = document.querySelector(".app-title")) == null ? void 0 : _m.textContent) == null ? void 0 : _n.trim()) || ((_p = (_o = document.querySelector("h1")) == null ? void 0 : _o.textContent) == null ? void 0 : _p.trim()) || "";
  }
  if (window.location.hostname.includes("lever.co")) {
    info.company = ((_r = (_q = document.querySelector(".posting-headline h2")) == null ? void 0 : _q.textContent) == null ? void 0 : _r.trim()) || "";
    info.title = ((_t = (_s = document.querySelector(".posting-headline h2")) == null ? void 0 : _s.textContent) == null ? void 0 : _t.trim()) || "";
  }
  if (window.location.hostname.includes("workday.com") || window.location.hostname.includes("myworkdayjobs.com")) {
    info.title = ((_v = (_u = document.querySelector('[data-automation-id="jobPostingHeader"]')) == null ? void 0 : _u.textContent) == null ? void 0 : _v.trim()) || ((_x = (_w = document.querySelector("h1")) == null ? void 0 : _w.textContent) == null ? void 0 : _x.trim()) || "";
  }
  if (!info.title && document.title) {
    info.title = document.title.split(" - ")[0].split(" | ")[0].trim();
  }
  return info;
}
const COMMON_QUESTIONS = [
  // Why this company?
  {
    patterns: [
      /why.*(this company|work here|join us|interested in.*company)/i,
      /what attracts you to/i,
      /why do you want to work/i
    ],
    generate: (profile, company, job) => {
      const skills = profile.skills.slice(0, 3).join(", ");
      return `I'm excited about the opportunity at ${company || "your company"} because it aligns perfectly with my background in ${profile.major || "technology"}. With experience in ${skills || "software development"}, I'm eager to contribute to innovative projects and grow alongside a talented team. The ${job || "role"} particularly interests me as it would allow me to apply my skills while learning from industry leaders.`;
    }
  },
  // Tell us about yourself
  {
    patterns: [
      /tell us about yourself/i,
      /describe yourself/i,
      /introduce yourself/i,
      /who are you/i
    ],
    generate: (profile) => {
      const skills = profile.skills.slice(0, 4).join(", ");
      const project = profile.projects[0];
      let response = `I'm a ${profile.major || "Computer Science"} student at ${profile.university || "university"}, expected to graduate ${profile.graduationDate || "soon"}. I have strong experience in ${skills || "programming and software development"}.`;
      if (project) {
        response += ` Recently, I worked on ${project.name}, where I ${project.description.slice(0, 100)}...`;
      }
      return response;
    }
  },
  // Describe a project
  {
    patterns: [
      /describe.*(project|work|experience)/i,
      /tell us about a project/i,
      /challenging project/i,
      /proud of/i,
      /accomplishment/i
    ],
    generate: (profile) => {
      const project = profile.projects[0];
      if (project) {
        const tech = project.technologies.join(", ");
        return `One project I'm particularly proud of is ${project.name}. ${project.description} I used ${tech || "various technologies"} to build this solution. ${project.highlights[0] || "This project taught me valuable lessons about software development and problem-solving."}`;
      }
      return `During my studies at ${profile.university || "university"}, I've worked on several projects applying ${profile.skills.slice(0, 3).join(", ") || "my technical skills"}. I enjoy tackling complex problems and building solutions that make a real impact.`;
    }
  },
  // Why this role/position?
  {
    patterns: [
      /why.*(this role|this position|interested in.*role)/i,
      /what interests you about this/i
    ],
    generate: (profile, company, job) => {
      const skills = profile.skills.slice(0, 3).join(", ");
      return `The ${job || "position"} excites me because it combines my passion for ${profile.major || "technology"} with practical application. My experience with ${skills || "relevant technologies"} has prepared me well for this role. I'm eager to contribute my skills while continuing to learn and grow in a professional environment.`;
    }
  },
  // Strengths
  {
    patterns: [
      /strength/i,
      /what are you good at/i,
      /best qualities/i
    ],
    generate: (profile) => {
      const skills = profile.skills.slice(0, 2).join(" and ");
      return `My key strengths include strong problem-solving abilities, proficiency in ${skills || "technical skills"}, and excellent collaboration skills. I'm a quick learner who adapts well to new technologies and enjoys working in team environments to deliver quality results.`;
    }
  },
  // Weaknesses
  {
    patterns: [
      /weakness/i,
      /area.*(improve|development)/i,
      /challenge.*overcome/i
    ],
    generate: () => {
      return `I sometimes focus too much on details, wanting to perfect every aspect of my work. I've learned to balance this by setting clear milestones and priorities, ensuring I deliver quality work while meeting deadlines. This attention to detail has actually become valuable in catching bugs and improving code quality.`;
    }
  },
  // Career goals / Where do you see yourself
  {
    patterns: [
      /where.*see yourself/i,
      /career goal/i,
      /5 years/i,
      /future/i,
      /long.?term/i
    ],
    generate: (profile, company) => {
      var _a;
      return `In the next few years, I aim to grow into a senior technical role where I can both contribute to impactful projects and mentor others. I'm excited about ${company ? `opportunities at ${company}` : "this opportunity"} because it aligns with my goal of working on meaningful ${((_a = profile.major) == null ? void 0 : _a.toLowerCase().includes("data")) ? "data-driven" : "software"} solutions while continuously developing my skills.`;
    }
  },
  // Availability / Start date
  {
    patterns: [
      /when can you start/i,
      /availability/i,
      /start date/i,
      /earliest.*start/i
    ],
    generate: (profile) => {
      if (profile.graduationDate) {
        return `I am available to start after my graduation in ${profile.graduationDate}. I'm flexible and excited to begin as soon as possible.`;
      }
      return `I am available to start immediately and am flexible with the start date based on your team's needs.`;
    }
  },
  // Relocation
  {
    patterns: [
      /willing to relocate/i,
      /relocation/i,
      /work location/i
    ],
    generate: () => {
      return `Yes, I am open to relocation for the right opportunity. I'm excited about new experiences and adapting to new environments.`;
    }
  }
];
function findMatchingTemplate(question) {
  for (const template of COMMON_QUESTIONS) {
    for (const pattern of template.patterns) {
      if (pattern.test(question)) {
        return template;
      }
    }
  }
  return null;
}
function generateTemplateResponse(question, profile, companyName, jobTitle) {
  const template = findMatchingTemplate(question);
  if (template) {
    return template.generate(profile, companyName, jobTitle);
  }
  return null;
}
async function generateAIResponse(request) {
  const settings = await storage.getSettings();
  const apiKey = await storage.getApiKey();
  const templateResponse = generateTemplateResponse(
    request.question,
    request.userProfile,
    request.companyName,
    request.jobTitle
  );
  if (settings.testMode) {
    const discordMessage = formatForDiscord(request);
    throw new TestModeError(discordMessage, templateResponse);
  }
  if (!apiKey || settings.noAiMode) {
    if (templateResponse) {
      return templateResponse;
    }
    throw new Error("No API key configured and no template available for this question. Please add your API key in settings or answer manually.");
  }
  if (templateResponse && settings.preferTemplates) {
    return templateResponse;
  }
  const prompt = buildPrompt(request);
  try {
    if (settings.aiProvider === "anthropic") {
      return await callAnthropic(apiKey, prompt);
    } else {
      return await callOpenAI(apiKey, prompt);
    }
  } catch (error) {
    if (templateResponse) {
      console.log("[AI Job Applier] AI failed, using template fallback");
      return templateResponse;
    }
    throw error;
  }
}
class TestModeError extends Error {
  constructor(discordMessage, templateFallback) {
    super("Test mode - check Discord");
    __publicField(this, "discordMessage");
    __publicField(this, "templateFallback");
    this.discordMessage = discordMessage;
    this.templateFallback = templateFallback;
  }
}
function formatForDiscord(request) {
  const skills = request.userProfile.skills.slice(0, 5).join(", ");
  const project = request.userProfile.projects[0];
  return `**🤖 AI Job Applier Request**

**Question:** ${request.question}

**Company:** ${request.companyName || "Unknown"}
**Role:** ${request.jobTitle || "Unknown"}

**Applicant Context:**
- Major: ${request.userProfile.major || "N/A"}
- University: ${request.userProfile.university || "N/A"}
- Skills: ${skills || "N/A"}
${project ? `- Project: ${project.name} - ${project.description.slice(0, 100)}...` : ""}

@ronald please generate a response for this application question!`;
}
function buildPrompt(request) {
  const { question, companyName, jobTitle, userProfile, maxLength } = request;
  const projectsText = userProfile.projects.map((p) => `- ${p.name}: ${p.description} (Technologies: ${p.technologies.join(", ")})`).join("\n");
  return `You are helping someone write a job application response. Be professional, enthusiastic, and specific.

APPLICANT BACKGROUND:
- Name: ${userProfile.firstName} ${userProfile.lastName}
- Education: ${userProfile.degree} in ${userProfile.major} from ${userProfile.university}
- Skills: ${userProfile.skills.join(", ")}
- Projects:
${projectsText}

JOB DETAILS:
- Company: ${companyName}
- Position: ${jobTitle}

QUESTION TO ANSWER:
"${question}"

INSTRUCTIONS:
- Write a compelling, personalized response
- Reference specific skills or projects that are relevant
- Show genuine interest in ${companyName}
- Keep it concise but impactful
${maxLength ? `- Maximum ${maxLength} characters` : "- Keep it to 3-4 sentences"}

Write the response directly, no preamble:`;
}
async function callOpenAI(apiKey, prompt) {
  var _a;
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500,
      temperature: 0.7
    })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(((_a = error.error) == null ? void 0 : _a.message) || "OpenAI API error");
  }
  const data = await response.json();
  return data.choices[0].message.content.trim();
}
async function callAnthropic(apiKey, prompt) {
  var _a;
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-3-haiku-20240307",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }]
    })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(((_a = error.error) == null ? void 0 : _a.message) || "Anthropic API error");
  }
  const data = await response.json();
  return data.content[0].text.trim();
}
function extractJobInfo() {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v;
  const info = { jobTitle: "", company: "" };
  if (window.location.hostname.includes("linkedin.com")) {
    info.company = ((_b = (_a = document.querySelector(".jobs-unified-top-card__company-name")) == null ? void 0 : _a.textContent) == null ? void 0 : _b.trim()) || ((_d = (_c = document.querySelector(".topcard__org-name-link")) == null ? void 0 : _c.textContent) == null ? void 0 : _d.trim()) || "";
    info.jobTitle = ((_f = (_e = document.querySelector(".jobs-unified-top-card__job-title")) == null ? void 0 : _e.textContent) == null ? void 0 : _f.trim()) || ((_h = (_g = document.querySelector(".topcard__title")) == null ? void 0 : _g.textContent) == null ? void 0 : _h.trim()) || "";
  }
  if (window.location.hostname.includes("greenhouse.io")) {
    info.company = ((_j = (_i = document.querySelector(".company-name")) == null ? void 0 : _i.textContent) == null ? void 0 : _j.trim()) || ((_l = (_k = document.querySelector('[class*="company"]')) == null ? void 0 : _k.textContent) == null ? void 0 : _l.trim()) || "";
    info.jobTitle = ((_n = (_m = document.querySelector(".app-title")) == null ? void 0 : _m.textContent) == null ? void 0 : _n.trim()) || ((_p = (_o = document.querySelector("h1")) == null ? void 0 : _o.textContent) == null ? void 0 : _p.trim()) || "";
  }
  if (window.location.hostname.includes("lever.co")) {
    const headline = ((_r = (_q = document.querySelector(".posting-headline h2")) == null ? void 0 : _q.textContent) == null ? void 0 : _r.trim()) || "";
    info.company = headline;
    info.jobTitle = headline;
  }
  if (window.location.hostname.includes("workday.com") || window.location.hostname.includes("myworkdayjobs.com")) {
    info.jobTitle = ((_t = (_s = document.querySelector('[data-automation-id="jobPostingHeader"]')) == null ? void 0 : _s.textContent) == null ? void 0 : _t.trim()) || ((_v = (_u = document.querySelector("h1")) == null ? void 0 : _u.textContent) == null ? void 0 : _v.trim()) || "";
  }
  if (!info.jobTitle && document.title) {
    info.jobTitle = document.title.split(" - ")[0].split(" | ")[0].trim();
  }
  return info;
}
async function sendWebhookNotification(payload, webhookUrl) {
  const url = webhookUrl || DEFAULT_WEBHOOK_URL;
  try {
    const statusEmoji = payload.status === "success" ? "✅" : payload.status === "partial" ? "⚠️" : "❌";
    const statusColor = payload.status === "success" ? 1096065 : payload.status === "partial" ? 16096779 : 15680580;
    const embed = {
      title: `${statusEmoji} Job Application Auto-Filled`,
      color: statusColor,
      fields: [
        {
          name: "💼 Job Title",
          value: payload.jobTitle || "Unknown",
          inline: true
        },
        {
          name: "🏢 Company",
          value: payload.company || "Unknown",
          inline: true
        },
        {
          name: "📝 Fields Filled",
          value: `${payload.fieldsFilledCount} / ${payload.totalFields}`,
          inline: true
        },
        {
          name: "🔗 Application URL",
          value: payload.url.length > 100 ? `[Open Application](${payload.url})` : payload.url || "N/A",
          inline: false
        }
      ],
      timestamp: payload.timestamp,
      footer: {
        text: "AI Job Applier Extension"
      }
    };
    if (payload.errorMessage) {
      embed.fields.push({
        name: "⚠️ Issues",
        value: payload.errorMessage.slice(0, 200),
        inline: false
      });
    }
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        embeds: [embed]
      })
    });
    if (!response.ok) {
      console.error("[AI Job Applier] Webhook failed:", response.status, await response.text());
      return false;
    }
    console.log("[AI Job Applier] Webhook notification sent successfully");
    return true;
  } catch (error) {
    console.error("[AI Job Applier] Webhook error:", error);
    return false;
  }
}
async function fillField(field, profile, options = { useAI: true }) {
  const value = getFieldValue(field.fieldType, profile);
  if (value !== null) {
    if (field.element instanceof HTMLSelectElement) {
      await setInputValueAsync(field.element, value, field.label);
    } else {
      setInputValue(field.element, value);
    }
    return true;
  }
  if (field.fieldType === "openEnded" && options.useAI) {
    const jobInfo = detectJobInfo();
    try {
      const response = await generateAIResponse({
        question: field.label,
        companyName: jobInfo.company,
        jobTitle: jobInfo.title,
        userProfile: profile
      });
      setInputValue(field.element, response);
      return true;
    } catch (error) {
      if (error instanceof TestModeError) {
        showTestModeDialog(error, field.element);
        return false;
      }
      console.error("AI response error:", error);
      return false;
    }
  }
  return false;
}
function showTestModeDialog(error, targetElement) {
  var _a, _b, _c, _d;
  const existing = document.getElementById("ai-job-applier-test-dialog");
  if (existing) existing.remove();
  const dialog = document.createElement("div");
  dialog.id = "ai-job-applier-test-dialog";
  dialog.innerHTML = `
    <div class="test-dialog-content">
      <h3>🧪 Test Mode - Discord AI</h3>
      <p>Copy this to Discord <strong>#job-applier-ai</strong> channel:</p>
      <textarea id="discord-request" readonly>${error.discordMessage}</textarea>
      <button id="copy-discord-btn" class="ai-btn primary">📋 Copy to Clipboard</button>
      
      <hr>
      
      <p>Then paste Ronald's response here:</p>
      <textarea id="ai-response-input" placeholder="Paste the AI response here..."></textarea>
      <button id="use-response-btn" class="ai-btn primary">✅ Use This Response</button>
      
      ${error.templateFallback ? `
        <hr>
        <p>Or use the template response:</p>
        <button id="use-template-btn" class="ai-btn secondary">📝 Use Template Instead</button>
      ` : ""}
      
      <button id="close-dialog-btn" class="ai-btn secondary">❌ Cancel</button>
    </div>
  `;
  const style = document.createElement("style");
  style.textContent = `
    #ai-job-applier-test-dialog {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .test-dialog-content {
      background: white;
      padding: 24px;
      border-radius: 16px;
      max-width: 600px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
    }
    .test-dialog-content h3 {
      margin: 0 0 16px;
      color: #667eea;
    }
    .test-dialog-content p {
      margin: 8px 0;
      color: #475569;
      font-size: 14px;
    }
    .test-dialog-content textarea {
      width: 100%;
      min-height: 100px;
      padding: 12px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font-size: 13px;
      margin: 8px 0;
      resize: vertical;
    }
    .test-dialog-content hr {
      border: none;
      border-top: 1px solid #e2e8f0;
      margin: 16px 0;
    }
    .test-dialog-content .ai-btn {
      display: block;
      width: 100%;
      padding: 12px;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      cursor: pointer;
      margin: 8px 0;
    }
    .test-dialog-content .ai-btn.primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .test-dialog-content .ai-btn.secondary {
      background: #f1f5f9;
      color: #475569;
    }
  `;
  dialog.appendChild(style);
  document.body.appendChild(dialog);
  (_a = dialog.querySelector("#copy-discord-btn")) == null ? void 0 : _a.addEventListener("click", () => {
    navigator.clipboard.writeText(error.discordMessage);
    dialog.querySelector("#copy-discord-btn").textContent = "✅ Copied!";
  });
  (_b = dialog.querySelector("#use-response-btn")) == null ? void 0 : _b.addEventListener("click", () => {
    const response = dialog.querySelector("#ai-response-input").value;
    if (response.trim()) {
      setInputValue(targetElement, response.trim());
      highlightField(targetElement, "success");
      dialog.remove();
    }
  });
  (_c = dialog.querySelector("#use-template-btn")) == null ? void 0 : _c.addEventListener("click", () => {
    if (error.templateFallback) {
      setInputValue(targetElement, error.templateFallback);
      highlightField(targetElement, "success");
      dialog.remove();
    }
  });
  (_d = dialog.querySelector("#close-dialog-btn")) == null ? void 0 : _d.addEventListener("click", () => {
    dialog.remove();
  });
}
function getFieldValue(fieldType, profile) {
  const mapping = {
    firstName: profile.firstName,
    lastName: profile.lastName,
    fullName: `${profile.firstName} ${profile.lastName}`.trim(),
    email: profile.email,
    phone: profile.phone,
    address: profile.address,
    city: profile.city,
    state: profile.state,
    zipCode: profile.zipCode,
    country: profile.country,
    linkedin: profile.linkedinUrl,
    github: profile.githubUrl,
    portfolio: profile.portfolioUrl,
    university: profile.university,
    degree: profile.degree,
    major: profile.major,
    gpa: profile.gpa,
    graduationDate: profile.graduationDate,
    yearsOfExperience: profile.yearsOfExperience
  };
  return mapping[fieldType] || null;
}
async function findBestOptionWithAI(options, targetValue, fieldLabel) {
  const target = targetValue.toLowerCase().trim();
  let match = options.find(
    (opt) => opt.value.toLowerCase() === target || opt.text.toLowerCase() === target
  );
  if (match) return match;
  match = options.find(
    (opt) => opt.value.toLowerCase().includes(target) || opt.text.toLowerCase().includes(target) || target.includes(opt.value.toLowerCase()) || target.includes(opt.text.toLowerCase())
  );
  if (match) return match;
  const optionTexts = options.map((opt, i) => `${i}: ${opt.text}`).join("\n");
  try {
    const settings = await storage.getSettings();
    const apiKey = await storage.getApiKey();
    if (!apiKey && !settings.testMode) {
      return fuzzyMatch(options, target);
    }
    const prompt = `You are helping fill a job application form.

Field: "${fieldLabel}"
User's value: "${targetValue}"

Available dropdown options:
${optionTexts}

Which option number (0-${options.length - 1}) is the BEST match for the user's value? 
Consider semantic similarity - e.g., "Computer Engineering" could match "Computer Science" or "Electrical Engineering".
For yes/no questions, match appropriately.

Reply with ONLY the option number, nothing else. If no good match exists, reply "NONE".`;
    const response = await callAIForDropdown(apiKey, prompt, settings.aiProvider);
    const trimmed = response.trim();
    if (trimmed === "NONE") {
      return fuzzyMatch(options, target);
    }
    const index = parseInt(trimmed, 10);
    if (!isNaN(index) && index >= 0 && index < options.length) {
      console.log(`[AI Job Applier] AI selected option ${index}: "${options[index].text}" for value "${targetValue}"`);
      return options[index];
    }
  } catch (error) {
    console.log("[AI Job Applier] AI dropdown selection failed, using fuzzy match:", error);
  }
  return fuzzyMatch(options, target);
}
function fuzzyMatch(options, target) {
  const targetWords = target.toLowerCase().split(/\s+/);
  let bestMatch = null;
  let bestScore = 0;
  for (const opt of options) {
    const optText = (opt.value + " " + opt.text).toLowerCase();
    const optWords = optText.split(/\s+/);
    const overlap = targetWords.filter((w) => optWords.some((ow) => ow.includes(w) || w.includes(ow))).length;
    if (overlap > bestScore) {
      bestScore = overlap;
      bestMatch = opt;
    }
  }
  return bestScore > 0 ? bestMatch : null;
}
async function callAIForDropdown(apiKey, prompt, provider) {
  if (provider === "anthropic") {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 10,
        messages: [{ role: "user", content: prompt }]
      })
    });
    const data = await response.json();
    return data.content[0].text;
  } else {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 10
      })
    });
    const data = await response.json();
    return data.choices[0].message.content;
  }
}
function findBestOption(options, targetValue) {
  const target = targetValue.toLowerCase().trim();
  let match = options.find(
    (opt) => opt.value.toLowerCase() === target || opt.text.toLowerCase() === target
  );
  if (match) return match;
  match = options.find(
    (opt) => opt.value.toLowerCase().includes(target) || opt.text.toLowerCase().includes(target) || target.includes(opt.value.toLowerCase()) || target.includes(opt.text.toLowerCase())
  );
  if (match) return match;
  return fuzzyMatch(options, target);
}
async function setInputValueAsync(element, value, fieldLabel = "") {
  var _a;
  const inputEvent = new Event("input", { bubbles: true });
  const changeEvent = new Event("change", { bubbles: true });
  if (element instanceof HTMLSelectElement) {
    const options = Array.from(element.options).filter((opt) => opt.value);
    const match = await findBestOptionWithAI(options, value, fieldLabel);
    if (match) {
      element.value = match.value;
      console.log(`[AI Job Applier] Selected "${match.text}" for value "${value}"`);
    } else {
      console.log(`[AI Job Applier] No match found for "${value}" in dropdown`);
    }
  } else {
    element.value = value;
  }
  element.dispatchEvent(inputEvent);
  element.dispatchEvent(changeEvent);
  if (!(element instanceof HTMLSelectElement)) {
    const nativeInputValueSetter = (_a = Object.getOwnPropertyDescriptor(
      element.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
      "value"
    )) == null ? void 0 : _a.set;
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(element, value);
      element.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }
}
function setInputValue(element, value) {
  const inputEvent = new Event("input", { bubbles: true });
  const changeEvent = new Event("change", { bubbles: true });
  if (element instanceof HTMLSelectElement) {
    const options = Array.from(element.options).filter((opt) => opt.value);
    const match = findBestOption(options, value);
    if (match) {
      element.value = match.value;
    }
  } else {
    element.value = value;
  }
  element.dispatchEvent(inputEvent);
  element.dispatchEvent(changeEvent);
}
async function fillAllFields(fields, profile, options = { useAI: true }) {
  var _a;
  let filled = 0;
  const failed = [];
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    if (field.fieldType === "unknown") continue;
    if (field.element.type === "file") continue;
    const success = await fillField(field, profile, options);
    if (success) {
      filled++;
      highlightField(field.element, "success");
    } else {
      failed.push(field.label || field.fieldType);
      highlightField(field.element, "error");
    }
    (_a = options.onProgress) == null ? void 0 : _a.call(options, i + 1, fields.length);
    await sleep(100);
  }
  try {
    const settings = await storage.getSettings();
    if (settings.webhookEnabled) {
      const jobInfo = extractJobInfo();
      const totalFields = fields.filter((f) => f.fieldType !== "unknown" && f.element.type !== "file").length;
      await sendWebhookNotification({
        jobTitle: jobInfo.jobTitle || "Unknown Position",
        company: jobInfo.company || "Unknown Company",
        url: window.location.href,
        fieldsFilledCount: filled,
        totalFields,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        status: failed.length === 0 ? "success" : filled > 0 ? "partial" : "error",
        errorMessage: failed.length > 0 ? `Failed fields: ${failed.join(", ")}` : void 0
      }, settings.webhookUrl || void 0);
    }
  } catch (error) {
    console.log("[AI Job Applier] Webhook notification error:", error);
  }
  return { filled, failed };
}
function highlightField(element, status) {
  const colors = {
    success: "#10b981",
    // green
    error: "#ef4444",
    // red
    pending: "#f59e0b"
    // yellow
  };
  element.style.boxShadow = `0 0 0 2px ${colors[status]}`;
  element.style.transition = "box-shadow 0.3s ease";
  setTimeout(() => {
    element.style.boxShadow = "";
  }, 3e3);
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function previewFill(fields, profile) {
  return fields.filter((f) => f.fieldType !== "unknown").map((field) => {
    const value = getFieldValue(field.fieldType, profile);
    return {
      label: field.label || field.fieldType,
      value: value || (field.fieldType === "openEnded" ? "[AI Generated]" : "[Unknown]"),
      fieldType: field.fieldType
    };
  });
}
const APPLICATIONS_LOG_KEY = "applicationsLog";
const MAX_LOG_ENTRIES = 500;
async function logApplication(entry) {
  const logs = await getApplicationLogs();
  if (!entry.source) {
    entry.source = {
      platform: detectPlatform(entry.jobUrl),
      pageTitle: typeof document !== "undefined" ? document.title : "",
      domain: new URL(entry.jobUrl).hostname
    };
  }
  if (!entry.id) {
    entry.id = generateId();
  }
  logs.unshift(entry);
  if (logs.length > MAX_LOG_ENTRIES) {
    logs.length = MAX_LOG_ENTRIES;
  }
  await chrome.storage.local.set({ [APPLICATIONS_LOG_KEY]: logs });
  await sendLogWebhook(entry);
  console.log("[AI Job Applier] Application logged:", entry.jobTitle, "@", entry.company);
}
async function getApplicationLogs() {
  const result = await chrome.storage.local.get(APPLICATIONS_LOG_KEY);
  return result[APPLICATIONS_LOG_KEY] || [];
}
function detectPlatform(url) {
  const hostname = new URL(url).hostname.toLowerCase();
  if (hostname.includes("linkedin.com")) return "linkedin";
  if (hostname.includes("greenhouse.io")) return "greenhouse";
  if (hostname.includes("lever.co")) return "lever";
  if (hostname.includes("workday.com") || hostname.includes("myworkdayjobs.com")) return "workday";
  return "other";
}
async function sendLogWebhook(entry) {
  var _a;
  try {
    const result = await chrome.storage.local.get("settings");
    const settings = result.settings || {};
    if (!settings.webhookEnabled || !settings.webhookUrl) {
      return;
    }
    const statusEmoji = {
      "filled": "✅",
      "submitted": "🚀",
      "error": "❌",
      "partial": "⚠️",
      "review-stopped": "📋"
    };
    const statusColor = {
      "filled": 1096065,
      "submitted": 3900150,
      "error": 15680580,
      "partial": 16096779,
      "review-stopped": 9133302
    };
    const embed = {
      title: `${statusEmoji[entry.status]} ${entry.status.toUpperCase()}: ${entry.jobTitle}`,
      color: statusColor[entry.status],
      fields: [
        { name: "🏢 Company", value: entry.company, inline: true },
        { name: "📊 Mode", value: entry.mode, inline: true },
        { name: "📝 Fields", value: `${entry.fieldsFilled}/${entry.fieldsDetected}`, inline: true },
        { name: "🔗 URL", value: entry.jobUrl.slice(0, 100), inline: false }
      ],
      timestamp: entry.timestamp,
      footer: { text: `Platform: ${((_a = entry.source) == null ? void 0 : _a.platform) || "unknown"}` }
    };
    if (entry.errors.length > 0) {
      embed.fields.push({
        name: "⚠️ Errors",
        value: entry.errors.slice(0, 3).join("\n").slice(0, 200),
        inline: false
      });
    }
    await fetch(settings.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] })
    });
  } catch (error) {
    console.log("[AI Job Applier] Log webhook error:", error);
  }
}
let detectedFields = [];
let floatingButton = null;
async function init() {
  console.log("[AI Job Applier] Content script loaded");
  if (document.readyState !== "complete") {
    await new Promise((resolve) => window.addEventListener("load", resolve));
  }
  detectedFields = detectFormFields();
  console.log(`[AI Job Applier] Detected ${detectedFields.length} form fields`);
  createFloatingButton();
  chrome.runtime.onMessage.addListener(handleMessage);
}
function createFloatingButton() {
  if (floatingButton) return;
  floatingButton = document.createElement("div");
  floatingButton.id = "ai-job-applier-fab";
  floatingButton.innerHTML = `
    <div class="ai-job-applier-fab-content">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/>
      </svg>
      <span class="ai-job-applier-fab-badge">${detectedFields.length}</span>
    </div>
  `;
  floatingButton.addEventListener("click", () => {
    showQuickMenu();
  });
  document.body.appendChild(floatingButton);
}
function showQuickMenu() {
  var _a, _b, _c, _d;
  const existing = document.getElementById("ai-job-applier-menu");
  if (existing) {
    existing.remove();
    return;
  }
  const jobInfo = detectJobInfo();
  const menu = document.createElement("div");
  menu.id = "ai-job-applier-menu";
  menu.innerHTML = `
    <div class="ai-job-applier-menu-header">
      <h3>AI Job Applier</h3>
      ${jobInfo.company ? `<p>${jobInfo.title} at ${jobInfo.company}</p>` : ""}
    </div>
    <div class="ai-job-applier-menu-stats">
      <span>${detectedFields.length} fields detected</span>
    </div>
    <div class="ai-job-applier-menu-actions">
      <button id="ai-fill-all" class="ai-btn primary">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 11 12 14 22 4"></polyline>
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
        </svg>
        Auto-Fill All
      </button>
      <button id="ai-preview" class="ai-btn secondary">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
        Preview
      </button>
      <button id="ai-settings" class="ai-btn secondary">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
        Settings
      </button>
    </div>
    <button class="ai-job-applier-menu-close">×</button>
  `;
  document.body.appendChild(menu);
  (_a = menu.querySelector("#ai-fill-all")) == null ? void 0 : _a.addEventListener("click", handleFillAll);
  (_b = menu.querySelector("#ai-preview")) == null ? void 0 : _b.addEventListener("click", handlePreview);
  (_c = menu.querySelector("#ai-settings")) == null ? void 0 : _c.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });
  (_d = menu.querySelector(".ai-job-applier-menu-close")) == null ? void 0 : _d.addEventListener("click", () => {
    menu.remove();
  });
}
async function handleFillAll() {
  const profile = await storage.getProfile();
  if (!profile.firstName || !profile.email) {
    alert("Please set up your profile first! Click the Settings button.");
    return;
  }
  const statusEl = document.querySelector(".ai-job-applier-menu-stats");
  if (statusEl) {
    statusEl.innerHTML = '<span class="loading">Filling forms...</span>';
  }
  const { filled, failed } = await fillAllFields(detectedFields, profile, {
    useAI: true,
    onProgress: (current, total) => {
      if (statusEl) {
        statusEl.innerHTML = `<span>Filled ${current}/${total} fields...</span>`;
      }
    }
  });
  if (statusEl) {
    statusEl.innerHTML = `<span class="success">✓ Filled ${filled} fields</span>`;
    if (failed.length > 0) {
      statusEl.innerHTML += `<br><span class="error">Could not fill: ${failed.join(", ")}</span>`;
    }
  }
}
async function handlePreview() {
  var _a, _b;
  const profile = await storage.getProfile();
  const preview = previewFill(detectedFields, profile);
  const previewHtml = preview.map((p) => `
    <div class="preview-item">
      <strong>${p.label}</strong>
      <span>${p.value || "(empty)"}</span>
    </div>
  `).join("");
  const modal = document.createElement("div");
  modal.id = "ai-job-applier-preview";
  modal.innerHTML = `
    <div class="preview-content">
      <h3>Preview Auto-Fill</h3>
      <div class="preview-list">${previewHtml}</div>
      <button class="ai-btn primary" id="confirm-fill">Fill Now</button>
      <button class="ai-btn secondary" id="cancel-fill">Cancel</button>
    </div>
  `;
  document.body.appendChild(modal);
  (_a = modal.querySelector("#confirm-fill")) == null ? void 0 : _a.addEventListener("click", async () => {
    modal.remove();
    await handleFillAll();
  });
  (_b = modal.querySelector("#cancel-fill")) == null ? void 0 : _b.addEventListener("click", () => {
    modal.remove();
  });
}
function handleMessage(message, sender, sendResponse) {
  switch (message.type) {
    case "GET_FIELDS":
      sendResponse({
        fields: detectedFields.map((f) => ({
          fieldType: f.fieldType,
          label: f.label,
          isRequired: f.isRequired
        })),
        jobInfo: detectJobInfo()
      });
      break;
    case "FILL_ALL":
      handleFillAll().then(() => sendResponse({ success: true }));
      return true;
    case "FILL_FIELD":
      storage.getProfile().then((profile) => {
        const field = detectedFields.find((f) => f.label === message.label);
        if (field) {
          fillField(field, profile).then((success) => sendResponse({ success }));
        }
      });
      return true;
    case "REFRESH_DETECTION":
      detectedFields = detectFormFields();
      sendResponse({ count: detectedFields.length });
      break;
    case "AUTO_APPLY":
      handleAutoApply(message.config).then((result) => {
        sendResponse({ result });
      });
      return true;
  }
}
async function handleAutoApply(config) {
  const profile = await storage.getProfile();
  const jobInfo = detectJobInfo();
  detectedFields = detectFormFields();
  const result = {
    success: false,
    jobUrl: window.location.href,
    jobTitle: jobInfo.title || "Unknown Position",
    company: jobInfo.company || "Unknown Company",
    fieldsFilled: 0,
    totalFields: detectedFields.length,
    stoppedAtReview: false,
    submitted: false,
    errors: [],
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
  if (!profile.firstName || !profile.email) {
    result.errors.push("Profile incomplete");
    return result;
  }
  if (detectedFields.length === 0) {
    result.errors.push("No form fields detected");
    return result;
  }
  try {
    const { filled, failed } = await fillAllFields(detectedFields, profile, {
      useAI: true
    });
    result.fieldsFilled = filled;
    result.errors = failed;
    result.success = filled > 0;
    await logApplication({
      id: generateId(),
      jobUrl: result.jobUrl,
      jobTitle: result.jobTitle,
      company: result.company,
      fieldsDetected: result.totalFields,
      fieldsFilled: result.fieldsFilled,
      fieldsSkipped: failed.length,
      status: result.success ? "filled" : "error",
      mode: (config == null ? void 0 : config.submitAutomatically) ? "full-auto" : "one-click",
      stoppedAtReview: false,
      timestamp: result.timestamp,
      errors: result.errors,
      fieldDetails: detectedFields.map((f) => ({
        fieldType: f.fieldType,
        label: f.label,
        filled: !failed.includes(f.label || f.fieldType)
      }))
    });
    if (config == null ? void 0 : config.submitAutomatically) {
      const submitBtn = findSubmitButton();
      if (submitBtn) {
        submitBtn.click();
        result.submitted = true;
      }
    } else {
      if (isReviewPage()) {
        result.stoppedAtReview = true;
        showReviewNotification(result);
      }
    }
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : "Unknown error");
  }
  return result;
}
function findSubmitButton() {
  const selectors = [
    'button[type="submit"]',
    'input[type="submit"]',
    'button[data-qa="submit-button"]',
    'button[data-automation-id="submit"]',
    "#submit-btn",
    ".submit-button",
    "button.btn-submit"
  ];
  for (const selector of selectors) {
    const btn = document.querySelector(selector);
    if (btn) return btn;
  }
  return null;
}
function isReviewPage() {
  const pageText = document.body.innerText.toLowerCase();
  const reviewIndicators = [
    "review your application",
    "review application",
    "submit application",
    "confirm submission",
    "review and submit",
    "application summary"
  ];
  return reviewIndicators.some((indicator) => pageText.includes(indicator));
}
function showReviewNotification(result) {
  const notification = document.createElement("div");
  notification.id = "ai-apply-review-notification";
  notification.innerHTML = `
    <div style="
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      z-index: 9999999;
      max-width: 350px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    ">
      <h3 style="margin: 0 0 10px; font-size: 16px;">📋 Ready for Review</h3>
      <p style="margin: 5px 0; font-size: 14px;"><strong>${result.jobTitle}</strong></p>
      <p style="margin: 5px 0; font-size: 14px;">${result.company}</p>
      <p style="margin: 10px 0 0; font-size: 13px; opacity: 0.9;">
        Filled ${result.fieldsFilled}/${result.totalFields} fields
      </p>
      <button onclick="this.parentElement.parentElement.remove()" style="
        margin-top: 12px;
        padding: 8px 16px;
        background: white;
        color: #667eea;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 600;
      ">Got it</button>
    </div>
  `;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 1e4);
}
init();
//# sourceMappingURL=index.js.map
