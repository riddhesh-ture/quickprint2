// src/utils/localJobStorage.js
/**
 * IndexedDB storage engine for merchant PC local file persistence.
 * Stores streamed binary Blobs securely in local storage so files are never lost
 * on browser refresh and do not incur cloud storage fees.
 */

const DB_NAME = 'quickprint_db';
const DB_VERSION = 1;
const STORE_NAME = 'job_blobs';

let dbInstancePromise = null;

function getDB() {
  if (dbInstancePromise) return dbInstancePromise;

  dbInstancePromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('jobId', 'jobId', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      console.error('IndexedDB open error:', event.target.error);
      dbInstancePromise = null;
      reject(event.target.error);
    };
  });

  return dbInstancePromise;
}

/**
 * Save a file Blob for a specific print job and file index.
 * @param {string} jobId
 * @param {number|string} fileIndex
 * @param {Blob} blob
 * @returns {Promise<boolean>}
 */
export async function saveJobBlob(jobId, fileIndex, blob) {
  try {
    const db = await getDB();
    const id = `${jobId}_${fileIndex}`;

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      const record = {
        id,
        jobId,
        fileIndex: Number(fileIndex),
        blob,
        createdAt: Date.now(),
      };

      const req = store.put(record);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error(`Failed to save Blob for job ${jobId}, file ${fileIndex}:`, err);
    throw err;
  }
}

/**
 * Retrieve a single file Blob by jobId and fileIndex.
 * @param {string} jobId
 * @param {number|string} fileIndex
 * @returns {Promise<Blob|null>}
 */
export async function getJobBlob(jobId, fileIndex) {
  try {
    const db = await getDB();
    const id = `${jobId}_${fileIndex}`;

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);

      const req = store.get(id);
      req.onsuccess = () => {
        if (req.result && req.result.blob) {
          resolve(req.result.blob);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error(`Failed to get Blob for job ${jobId}, file ${fileIndex}:`, err);
    return null;
  }
}

/**
 * Retrieve all file Blobs for a given jobId as an array ordered by fileIndex.
 * @param {string} jobId
 * @returns {Promise<Array<{ fileIndex: number, blob: Blob }>>}
 */
export async function getAllJobBlobs(jobId) {
  try {
    const db = await getDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('jobId');

      const req = index.getAll(jobId);
      req.onsuccess = () => {
        const results = req.result || [];
        results.sort((a, b) => a.fileIndex - b.fileIndex);
        resolve(results.map(r => ({ fileIndex: r.fileIndex, blob: r.blob })));
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error(`Failed to get all Blobs for job ${jobId}:`, err);
    return [];
  }
}

/**
 * Delete all locally stored Blobs for a given print job when completed or canceled.
 * @param {string} jobId
 * @returns {Promise<number>} Number of deleted blobs
 */
export async function deleteJobBlobs(jobId) {
  try {
    const db = await getDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('jobId');

      const req = index.getAllKeys(jobId);
      req.onsuccess = () => {
        const keys = req.result || [];
        if (keys.length === 0) {
          resolve(0);
          return;
        }

        let completedDeletions = 0;
        keys.forEach((key) => {
          const delReq = store.delete(key);
          delReq.onsuccess = () => {
            completedDeletions++;
          };
        });

        tx.oncomplete = () => resolve(completedDeletions);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error(`Failed to delete Blobs for job ${jobId}:`, err);
    return 0;
  }
}

/**
 * Check if a backup of the original Blob exists for this job & file.
 * @param {string} jobId
 * @param {number|string} fileIndex
 * @returns {Promise<boolean>}
 */
export async function hasOriginalJobBlob(jobId, fileIndex) {
  try {
    const db = await getDB();
    const id = `original_${jobId}_${fileIndex}`;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve(Boolean(req.result && req.result.blob));
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/**
 * Save an edited blob, preserving the original version in a separate backup record.
 * @param {string} jobId
 * @param {number|string} fileIndex
 * @param {Blob} updatedBlob
 * @returns {Promise<boolean>}
 */
export async function saveEditedJobBlob(jobId, fileIndex, updatedBlob) {
  try {
    const db = await getDB();
    const backupId = `original_${jobId}_${fileIndex}`;

    // 1. Fetch current blob to store as backup if no backup exists yet
    const existingOriginal = await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(backupId);
      req.onsuccess = () => resolve(req.result?.blob || null);
      req.onerror = () => resolve(null);
    });

    if (!existingOriginal) {
      const currentBlob = await getJobBlob(jobId, fileIndex);
      if (currentBlob) {
        await new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const req = store.put({
            id: backupId,
            jobId,
            fileIndex: Number(fileIndex),
            blob: currentBlob,
            isBackup: true,
            createdAt: Date.now(),
          });
          req.onsuccess = () => resolve(true);
          req.onerror = () => reject(req.error);
        });
      }
    }

    // 2. Put updatedBlob into main slot
    await saveJobBlob(jobId, fileIndex, updatedBlob);
    return true;
  } catch (err) {
    console.error(`Failed to save edited blob for ${jobId}_${fileIndex}:`, err);
    throw err;
  }
}

/**
 * Revert an edited file back to its original backup.
 * @param {string} jobId
 * @param {number|string} fileIndex
 * @returns {Promise<Blob|null>}
 */
export async function revertJobBlob(jobId, fileIndex) {
  try {
    const db = await getDB();
    const backupId = `original_${jobId}_${fileIndex}`;

    const originalRecord = await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(backupId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });

    if (!originalRecord || !originalRecord.blob) {
      return null;
    }

    // Restore to main slot and delete backup
    await saveJobBlob(jobId, fileIndex, originalRecord.blob);

    await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(backupId);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });

    return originalRecord.blob;
  } catch (err) {
    console.error(`Failed to revert job blob for ${jobId}_${fileIndex}:`, err);
    return null;
  }
}

