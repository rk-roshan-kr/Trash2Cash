// common.js
// Put this file in the same folder as your html files.
// Usage: import { initApp, generateRefID, seedIfEmpty, onRealtimeCollection, createTrash, getUser } from './common.js';

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  // getFirestore,
  initializeFirestore,
  collection,
  doc,
  setDoc,
  addDoc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAYVQdYQnBVA9yFRHpnpYUZTEESszunUGI",
  authDomain: "trash2cash-cu.firebaseapp.com",
  projectId: "trash2cash-cu",
  storageBucket: "trash2cash-cu.firebasestorage.app",
  messagingSenderId: "630127672722",
  appId: "1:630127672722:web:7c0b83248f13b4a23f154b"
};

let db = null;
// Realtime mode control: 'stream' | 'poll' | 'hybrid'
let REALTIME_MODE = 'hybrid';
try {
  const p = new URLSearchParams(location.search);
  const rt = (p.get('rt') || '').toLowerCase();
  if (rt === 'poll' || rt === 'stream' || rt === 'hybrid') REALTIME_MODE = rt;
} catch {}

export function setRealtimeMode(mode) {
  if (['stream','poll','hybrid'].includes(mode)) REALTIME_MODE = mode;
}
export function initApp() {
  if (db) return db;
  const app = initializeApp(firebaseConfig);
  // Use long polling and disable fetch streams for environments that block streaming
  db = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
    useFetchStreams: false
  });
  console.log("Firebase initialized");
  return db;
}

export function generateRefID(type = "X", city = "D") {
  const d = new Date();
  return `${type}${city}${d.getDate().toString(36).toUpperCase()}${d.getHours().toString(36).toUpperCase()}${d.getMinutes().toString(36).toUpperCase()}${Math.random().toString(36).slice(2,6).toUpperCase()}`;
}

// Seed minimal demo data — safe to run repeatedly
export async function seedIfEmpty() {
  initApp();
  const col = (n) => collection(db, n);

  const u = await getDocs(col("users"));
  if (u.empty) {
    const arr = [
      { id: "user1", name: "Anita", wallet: 0 },
      { id: "user2", name: "Rahul", wallet: 0 },
      { id: "user3", name: "Neha", wallet: 0 },
      { id: "user4", name: "Sandeep", wallet: 0 },
      { id: "user5", name: "Priya", wallet: 0 }
    ];
    for (const x of arr) await setDoc(doc(db, "users", x.id), x);
    console.log("Seeded users");
  }

  const g = await getDocs(col("gov"));
  if (g.empty) {
    const arr = [
      { id: "gov1", name: "Collector A" },
      { id: "gov2", name: "Collector B" }
    ];
    for (const x of arr) await setDoc(doc(db, "gov", x.id), x);
    console.log("Seeded gov");
  }

  const c = await getDocs(col("companies"));
  if (c.empty) {
    const arr = [
      { id: "co1", name: "GreenRecycle" },
      { id: "co2", name: "EcoBuyers" }
    ];
    for (const x of arr) await setDoc(doc(db, "companies", x.id), x);
    console.log("Seeded companies");
  }

  const t = await getDocs(col("trucks"));
  if (t.empty) {
    const base = [23.7953, 86.4304];
    for (let i = 1; i <= 5; i++) {
      await addDoc(col("trucks"), {
        id: `T${i}`,
        lat: base[0] + (Math.random() - 0.5) * 0.02,
        lon: base[1] + (Math.random() - 0.5) * 0.02,
        updated: new Date().toISOString()
      });
    }
    console.log("Seeded trucks");
  }

  // Seed demo lots for company view
  const l = await getDocs(col("lots"));
  if (l.empty) {
    const arr = [
      { id: "LOT-P-DHN-1", type: "P", city: "DHN", weight: 120, target: 500, isFull: false, bids: [] },
      { id: "LOT-M-DHN-1", type: "M", city: "DHN", weight: 320, target: 700, isFull: false, bids: [] },
      { id: "LOT-A-DHN-1", type: "A", city: "DHN", weight: 450, target: 900, isFull: false, bids: [] }
    ];
    for (const x of arr) await setDoc(doc(db, "lots", x.id), { ...x, createdAt: new Date().toISOString() });
    console.log("Seeded lots");
  }
}

// Lightweight real-time listener helper
export function onRealtimeCollection(name, cb) {
  initApp();

  // Primary: realtime listener
  let lastHash = "";
  const makeHash = (arr) => arr.map(x => x.id).join("|");
  let unsub = null;
  if (REALTIME_MODE !== 'poll') {
    unsub = onSnapshot(
      collection(db, name),
      snap => {
        const arr = [];
        snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
        lastHash = makeHash(arr);
        cb(arr);
      },
      err => {
        console.error("Realtime error", name, err);
      }
    );
  }

  // Fallback: periodic polling to ensure UI stays updated if streaming is blocked
  const pollMs = 6000;
  const timer = setInterval(async () => {
    try {
      const s = await getDocs(collection(db, name));
      const arr = s.docs.map(d => ({ id: d.id, ...d.data() }));
      const h = makeHash(arr);
      if (REALTIME_MODE === 'poll' || h !== lastHash) {
        lastHash = h;
        cb(arr);
      }
    } catch (e) {
      console.warn("Polling error", name, e?.message || e);
    }
  }, pollMs);

  // Return unified unsubscribe
  return () => {
    try { unsub && unsub(); } catch {}
    clearInterval(timer);
  };
}

export async function getDocsFromCol(name) {
  initApp();
  const s = await getDocs(collection(db, name));
  return s.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getUser(id) {
  initApp();
  const r = await getDoc(doc(db, "users", id));
  return r.exists() ? { id: r.id, ...r.data() } : null;
}

// create a trash listing with the chosen ref (uses setDoc so id is our ref)
export async function createTrash(ref, data) {
  initApp();
  await setDoc(doc(db, "trash", ref), {
    ...data,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

// utility to credit user wallet (atomic-ish single update pattern)
export async function creditUser(userId, amount) {
  initApp();
  const uRef = doc(db, "users", userId);
  const snap = await getDoc(uRef);
  if (!snap.exists()) {
    throw new Error("User not found");
  }
  const current = snap.data().wallet || 0;
  await setDoc(uRef, { ...snap.data(), wallet: current + amount });
}

// Update a document by reading it, mutating its data, and writing back
export async function updateDocField(colName, id, mutateFn) {
  initApp();
  const ref = doc(db, colName, id);
  const snap = await getDoc(ref);
  const current = snap.exists() ? snap.data() : null;
  const updated = await mutateFn(current);
  if (updated == null) throw new Error("Mutation returned null/undefined");
  // ensure updatedAt maintained if applicable
  const payload = { ...updated, updatedAt: new Date().toISOString() };
  await setDoc(ref, payload);
  return payload;
}

// Add a new doc or set by id; returns the document id
export async function addOrSetDoc(colName, idOrData, maybeData) {
  initApp();
  if (typeof idOrData === "string") {
    const id = idOrData;
    const data = { ...maybeData, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await setDoc(doc(db, colName, id), data);
    return id;
  } else {
    const data = { ...idOrData, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const r = await addDoc(collection(db, colName), data);
    return r.id;
  }
}
