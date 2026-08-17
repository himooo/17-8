"use client";

// ====================================================================
//  HelperAssets Storage - تخزين محلي بـ IndexedDB
//  لا يحتاج أي قاعدة بيانات خارجية - كل التخزين في المتصفح
//  كل أداة مساعدة مرتبطة بـ lessonId معين
// ====================================================================

const DB_NAME = "bisalasa-helper-assets";
const DB_VERSION = 1;
const STORE_NAME = "assets";

export type HelperAssetType = "pdf" | "image" | "video" | "iframe";

export interface HelperAsset {
  id: string;
  lessonId: string;
  name: string;
  type: HelperAssetType;
  // للملفات: data URL (base64)
  // لـ iframe: URL
  data: string;
  createdAt: string;
}

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      dbInstance = req.result;
      resolve(dbInstance);
    };
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("lessonId", "lessonId", { unique: false });
      }
    };
  });
}

export async function saveHelperAsset(asset: HelperAsset): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(asset);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getHelperAssets(lessonId: string): Promise<HelperAsset[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index("lessonId");
    const req = index.getAll(lessonId);
    req.onsuccess = () => resolve(req.result as HelperAsset[]);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteHelperAsset(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function getAssetType(fileName: string): HelperAssetType {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "pdf";
  if (["jpg", "jpeg", "png", "gif", "svg", "webp", "bmp"].includes(ext || "")) return "image";
  if (["mp4", "webm", "ogg", "mov", "avi", "mkv"].includes(ext || "")) return "video";
  return "image"; // default
}
