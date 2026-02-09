import {
  ResumeVariant,
  ResumeVariantMetadata,
  ResumeCollection,
  ResumeFormat,
  STORAGE_KEYS,
} from './types';
import { generateId } from './storage';

// IndexedDB configuration
const DB_NAME = 'JobApplierResumes';
const DB_VERSION = 1;
const STORE_NAME = 'resumeFiles';

// Default empty collection
const DEFAULT_COLLECTION: ResumeCollection = {
  variants: [],
  defaultId: null,
  oneOffSlots: {},
};

// ============================================================================
// IndexedDB Setup
// ============================================================================

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });

  return dbPromise;
}

// ============================================================================
// IndexedDB File Operations
// ============================================================================

async function saveFileToIDB(id: string, fileData: ArrayBuffer): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put({ id, fileData });
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

async function getFileFromIDB(id: string): Promise<ArrayBuffer | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      resolve(request.result?.fileData || null);
    };
  });
}

async function deleteFileFromIDB(id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// ============================================================================
// Chrome Storage Metadata Operations
// ============================================================================

async function getCollection(): Promise<ResumeCollection> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.RESUME_COLLECTION);
  return result[STORAGE_KEYS.RESUME_COLLECTION] || DEFAULT_COLLECTION;
}

async function saveCollection(collection: ResumeCollection): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.RESUME_COLLECTION]: collection });
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Detect resume format from file extension
 */
export function detectFormat(fileName: string): ResumeFormat {
  const ext = fileName.toLowerCase().split('.').pop();
  switch (ext) {
    case 'docx':
    case 'doc':
      return 'docx';
    case 'tex':
    case 'latex':
      return 'latex';
    case 'pdf':
      return 'pdf';
    default:
      return 'docx';
  }
}

/**
 * Generate output filename: FIRST_LAST_RESUME.pdf
 */
export function generateOutputFilename(firstName: string, lastName: string): string {
  const first = firstName.trim().toUpperCase().replace(/\s+/g, '_');
  const last = lastName.trim().toUpperCase().replace(/\s+/g, '_');
  return `${first}_${last}_RESUME.pdf`;
}

/**
 * Read a File as ArrayBuffer
 */
export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

// ============================================================================
// Resume Storage API
// ============================================================================

export const resumeStorage = {
  // -------------------------------------------------------------------------
  // CRUD Operations
  // -------------------------------------------------------------------------

  /**
   * Create a new resume variant
   */
  async create(
    name: string,
    file: File,
    tags: string[] = [],
    options: { isOneOff?: boolean; oneOffSlot?: string; format?: ResumeFormat } = {}
  ): Promise<ResumeVariantMetadata> {
    const id = generateId();
    const now = new Date().toISOString();
    const fileData = await readFileAsArrayBuffer(file);
    const format = options.format || detectFormat(file.name);

    const metadata: ResumeVariantMetadata = {
      id,
      name,
      tags,
      format,
      fileName: file.name,
      fileSize: file.size,
      createdAt: now,
      updatedAt: now,
      isDefault: false,
      isOneOff: options.isOneOff || false,
      oneOffSlot: options.oneOffSlot,
    };

    // Save file to IndexedDB
    await saveFileToIDB(id, fileData);

    // Update metadata collection
    const collection = await getCollection();
    collection.variants.push(metadata);

    // Track one-off slot
    if (options.isOneOff && options.oneOffSlot) {
      // If slot exists, delete the old resume first
      const oldId = collection.oneOffSlots[options.oneOffSlot];
      if (oldId) {
        await this.delete(oldId);
        // Refresh collection after delete
        const refreshed = await getCollection();
        refreshed.variants.push(metadata);
        refreshed.oneOffSlots[options.oneOffSlot] = id;
        await saveCollection(refreshed);
        return metadata;
      }
      collection.oneOffSlots[options.oneOffSlot] = id;
    }

    // Set as default if first resume
    if (collection.variants.length === 1) {
      metadata.isDefault = true;
      collection.defaultId = id;
    }

    await saveCollection(collection);
    return metadata;
  },

  /**
   * Get resume metadata by ID
   */
  async getMetadata(id: string): Promise<ResumeVariantMetadata | null> {
    const collection = await getCollection();
    return collection.variants.find(v => v.id === id) || null;
  },

  /**
   * Get full resume including file data
   */
  async get(id: string): Promise<ResumeVariant | null> {
    const metadata = await this.getMetadata(id);
    if (!metadata) return null;

    const fileData = await getFileFromIDB(id);
    if (!fileData) return null;

    return { ...metadata, fileData };
  },

  /**
   * Get all resume metadata
   */
  async getAll(): Promise<ResumeVariantMetadata[]> {
    const collection = await getCollection();
    return collection.variants;
  },

  /**
   * Update resume metadata (not file)
   */
  async updateMetadata(
    id: string,
    updates: Partial<Pick<ResumeVariantMetadata, 'name' | 'tags'>>
  ): Promise<ResumeVariantMetadata | null> {
    const collection = await getCollection();
    const index = collection.variants.findIndex(v => v.id === id);
    if (index === -1) return null;

    collection.variants[index] = {
      ...collection.variants[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await saveCollection(collection);
    return collection.variants[index];
  },

  /**
   * Replace resume file (keeps metadata, updates file)
   */
  async updateFile(id: string, file: File): Promise<ResumeVariantMetadata | null> {
    const collection = await getCollection();
    const index = collection.variants.findIndex(v => v.id === id);
    if (index === -1) return null;

    const fileData = await readFileAsArrayBuffer(file);
    await saveFileToIDB(id, fileData);

    collection.variants[index] = {
      ...collection.variants[index],
      fileName: file.name,
      fileSize: file.size,
      format: detectFormat(file.name),
      updatedAt: new Date().toISOString(),
    };

    await saveCollection(collection);
    return collection.variants[index];
  },

  /**
   * Delete a resume
   */
  async delete(id: string): Promise<boolean> {
    const collection = await getCollection();
    const index = collection.variants.findIndex(v => v.id === id);
    if (index === -1) return false;

    const variant = collection.variants[index];

    // Remove from IndexedDB
    await deleteFileFromIDB(id);

    // Remove from collection
    collection.variants.splice(index, 1);

    // Clear default if deleted
    if (collection.defaultId === id) {
      collection.defaultId = collection.variants[0]?.id || null;
      if (collection.defaultId) {
        const newDefault = collection.variants.find(v => v.id === collection.defaultId);
        if (newDefault) newDefault.isDefault = true;
      }
    }

    // Clear one-off slot if applicable
    if (variant.isOneOff && variant.oneOffSlot) {
      delete collection.oneOffSlots[variant.oneOffSlot];
    }

    await saveCollection(collection);
    return true;
  },

  // -------------------------------------------------------------------------
  // Default Resume Management
  // -------------------------------------------------------------------------

  /**
   * Set a resume as the default
   */
  async setDefault(id: string): Promise<boolean> {
    const collection = await getCollection();
    const variant = collection.variants.find(v => v.id === id);
    if (!variant) return false;

    // Clear old default
    for (const v of collection.variants) {
      v.isDefault = v.id === id;
    }
    collection.defaultId = id;

    await saveCollection(collection);
    return true;
  },

  /**
   * Get the default resume metadata
   */
  async getDefault(): Promise<ResumeVariantMetadata | null> {
    const collection = await getCollection();
    if (!collection.defaultId) return null;
    return collection.variants.find(v => v.id === collection.defaultId) || null;
  },

  /**
   * Get the default resume with file data
   */
  async getDefaultFull(): Promise<ResumeVariant | null> {
    const metadata = await this.getDefault();
    if (!metadata) return null;
    return this.get(metadata.id);
  },

  // -------------------------------------------------------------------------
  // Tag Management
  // -------------------------------------------------------------------------

  /**
   * Add tags to a resume
   */
  async addTags(id: string, tags: string[]): Promise<ResumeVariantMetadata | null> {
    const collection = await getCollection();
    const variant = collection.variants.find(v => v.id === id);
    if (!variant) return null;

    const uniqueTags = [...new Set([...variant.tags, ...tags])];
    return this.updateMetadata(id, { tags: uniqueTags });
  },

  /**
   * Remove tags from a resume
   */
  async removeTags(id: string, tags: string[]): Promise<ResumeVariantMetadata | null> {
    const collection = await getCollection();
    const variant = collection.variants.find(v => v.id === id);
    if (!variant) return null;

    const tagSet = new Set(tags);
    const filteredTags = variant.tags.filter(t => !tagSet.has(t));
    return this.updateMetadata(id, { tags: filteredTags });
  },

  /**
   * Search resumes by tags (match any)
   */
  async searchByTags(tags: string[]): Promise<ResumeVariantMetadata[]> {
    const collection = await getCollection();
    const tagSet = new Set(tags.map(t => t.toLowerCase()));
    return collection.variants.filter(v =>
      v.tags.some(t => tagSet.has(t.toLowerCase()))
    );
  },

  /**
   * Get all unique tags across all resumes
   */
  async getAllTags(): Promise<string[]> {
    const collection = await getCollection();
    const tagSet = new Set<string>();
    for (const v of collection.variants) {
      for (const tag of v.tags) {
        tagSet.add(tag);
      }
    }
    return [...tagSet].sort();
  },

  // -------------------------------------------------------------------------
  // One-Off Slot Management
  // -------------------------------------------------------------------------

  /**
   * Create or overwrite a one-off resume slot
   */
  async setOneOff(slotName: string, name: string, file: File): Promise<ResumeVariantMetadata> {
    return this.create(name, file, [], {
      isOneOff: true,
      oneOffSlot: slotName,
    });
  },

  /**
   * Get resume from a one-off slot
   */
  async getOneOff(slotName: string): Promise<ResumeVariant | null> {
    const collection = await getCollection();
    const id = collection.oneOffSlots[slotName];
    if (!id) return null;
    return this.get(id);
  },

  /**
   * List all one-off slot names
   */
  async getOneOffSlots(): Promise<string[]> {
    const collection = await getCollection();
    return Object.keys(collection.oneOffSlots);
  },

  /**
   * Clear a one-off slot (deletes the resume)
   */
  async clearOneOff(slotName: string): Promise<boolean> {
    const collection = await getCollection();
    const id = collection.oneOffSlots[slotName];
    if (!id) return false;
    return this.delete(id);
  },

  // -------------------------------------------------------------------------
  // Utility
  // -------------------------------------------------------------------------

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{
    totalResumes: number;
    totalSize: number;
    defaultId: string | null;
    oneOffSlots: number;
  }> {
    const collection = await getCollection();
    const totalSize = collection.variants.reduce((sum, v) => sum + v.fileSize, 0);
    return {
      totalResumes: collection.variants.length,
      totalSize,
      defaultId: collection.defaultId,
      oneOffSlots: Object.keys(collection.oneOffSlots).length,
    };
  },

  /**
   * Export all resume data (for backup)
   */
  async exportAll(): Promise<ResumeVariant[]> {
    const collection = await getCollection();
    const resumes: ResumeVariant[] = [];
    for (const metadata of collection.variants) {
      const full = await this.get(metadata.id);
      if (full) resumes.push(full);
    }
    return resumes;
  },

  /**
   * Clear all resumes
   */
  async clearAll(): Promise<void> {
    const collection = await getCollection();
    for (const v of collection.variants) {
      await deleteFileFromIDB(v.id);
    }
    await saveCollection(DEFAULT_COLLECTION);
  },
};

// Export type for external use
export type { ResumeVariant, ResumeVariantMetadata, ResumeCollection, ResumeFormat };
