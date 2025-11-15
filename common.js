// common.js — shared Firebase + helpers (modular v12)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getFirestore, collection, doc, setDoc, addDoc, getDoc, getDocs,
  updateDoc, onSnapshot, serverTimestamp, query, where
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAYVQdYQnBVA9yFRHpnpYUZTEESszunUGI",
  authDomain: "trash2cash-cu.firebaseapp.com",
  projectId: "trash2cash-cu",
  storageBucket: "trash2cash-cu.firebasestorage.app",
  messagingSenderId: "630127672722",
  appId: "1:630127672722:web:7c0b83248f13b4a23f154b"
};

let app = null, db = null;

export function initApp(){
  if(db) return db;
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  console.log("Firebase initialized (modular v12)");
  return db;
}

/* Type & status helpers for UI */
export function fullTypeName(code){
  return {
    P: "Plastic",
    A: "Paper",
    M: "Metal",
    G: "Glass",
    E: "E-waste",
    C: "Cardboard",
    X: "Mixed"
  }[code] || code;
}

export function fullStatusName(code){
  return {
    PEN: "Pending Pickup",
    COL: "Collected by Govt Worker",
    SCN: "Sorted at Center",
    ASG: "Assigned to Lot",
    FUL: "Lot Full",
    SLD: "Sold to Company"
  }[code] || code;
}

/* Timeline renderer (returns simple HTML) */
export function formatTimeline(arr = []){
  if(!Array.isArray(arr) || arr.length === 0) return `<div class="small">No timeline available</div>`;
  return arr.map(t => `
    <div class="timeline-step" role="listitem">
      <div style="flex:1">
        <b>${fullStatusName(t.code)}</b>
        <div class="meta">${t.worker ? t.worker + ' • ' : ''}${t.lot ? 'Lot: ' + t.lot + ' • ' : ''}${new Date(t.at).toLocaleString()}</div>
      </div>
    </div>
  `).join("");
}

/* Ref generator (keeps previous behaviour) */
export function generateRefID(type = "X", city = "D"){
  const d = new Date();
  return (
    type +
    city +
    d.getDate().toString(36).toUpperCase() +
    d.getHours().toString(36).toUpperCase() +
    d.getMinutes().toString(36).toUpperCase() +
    Math.random().toString(36).slice(2, 6).toUpperCase()
  );
}

/* Seed demo data (idempotent) */
export async function seedIfEmpty(){
  initApp();
  try {
    // users
    const uCol = collection(db, "users");
    const uDocs = await getDocs(uCol);
    if (uDocs.empty) {
      const users = [
        { id: "user1", name: "Anita", wallet: 0 },
        { id: "user2", name: "Rahul", wallet: 0 },
        { id: "user3", name: "Neha", wallet: 0 },
        { id: "user4", name: "Sandeep", wallet: 0 },
        { id: "user5", name: "Priya", wallet: 0 }
      ];
      for (const u of users) await setDoc(doc(db, "users", u.id), u);
      console.log("common.js: seeded users");
    }

    // trucks
    const tc = collection(db, "trucks");
    const tDocs = await getDocs(tc);
    if (tDocs.empty) {
      const base = [30.737, 76.768]; // default area if you want
      for (let i = 1; i <= 5; i++) {
        await addDoc(tc, {
          id: `T${i}`,
          lat: base[0] + (Math.random() - 0.5) * 0.01,
          lon: base[1] + (Math.random() - 0.5) * 0.01,
          updated: new Date().toISOString()
        });
      }
      console.log("common.js: seeded trucks");
    }

    // some trash sample
    const trashCol = collection(db, "trash");
    const trashDocs = await getDocs(trashCol);
    if (trashDocs.empty) {
      const samples = [
        { ref: generateRefID("P","D"), owner:"user1", type:"P", qty:3, city:"D", status:"PEN", timeline:[{code:"PEN", at:new Date().toISOString()}], createdAt:new Date().toISOString() },
        { ref: generateRefID("A","D"), owner:"user2", type:"A", qty:1.5, city:"D", status:"PEN", timeline:[{code:"PEN", at:new Date().toISOString()}], createdAt:new Date().toISOString() },
        { ref: generateRefID("M","D"), owner:"user3", type:"M", qty:2.2, city:"D", status:"PEN", timeline:[{code:"PEN", at:new Date().toISOString()}], createdAt:new Date().toISOString() }
      ];
      for(const s of samples) await setDoc(doc(db, "trash", s.ref), s);
      console.log("common.js: seeded trash samples");
    }

    // lots default empty (optional)
  } catch (err) {
    console.error("common.js: seedIfEmpty error", err);
    throw err;
  }
}

/* Realtime listener helper: callback gets array of docs */
export function onRealtimeCollection(name, cb, onError){
  initApp();
  try {
    const unsub = onSnapshot(
      collection(db, name),
      snap => { const arr=[]; snap.forEach(d=>arr.push({ id:d.id, ...d.data() })); cb(arr); },
      err => { console.error(`common.js: listener ${name} error`, err); if(onError) onError(err); }
    );
    return unsub;
  } catch(err) {
    console.error("common.js: onRealtimeCollection error", err);
    throw err;
  }
}

/* Simple reads */
export async function getUser(id){
  initApp();
  const d = await getDoc(doc(db, "users", id));
  return d.exists() ? { id:d.id, ...d.data() } : null;
}
export async function getAll(collectionName){
  initApp();
  const snap = await getDocs(collection(db, collectionName));
  return snap.docs.map(d=>({ id:d.id, ...d.data() }));
}

/* Create trash doc */
export async function createTrash(ref, payload){
  initApp();
  const dref = doc(db, "trash", ref);
  const data = { ...payload, createdAt: (payload.createdAt || new Date().toISOString()), updatedAt: new Date().toISOString() };
  await setDoc(dref, data);
  return data;
}

/* Create a lot (admin) */
export async function createLot({ type="X", city="D", target=500 }){
  initApp();
  const col = collection(db, "lots");
  const docRef = await addDoc(col, {
    type, city, target, weight:0, items:[], isFull:false, createdAt: new Date().toISOString(), status: "OPEN", bids:[]
  });
  return docRef.id;
}

/* Assign a single trash item to a lot (updates lot and trash) */
export async function assignToLot(lotID, trashRef){
  initApp();
  const lotRef = doc(db, "lots", lotID);
  const lotSnap = await getDoc(lotRef);
  if(!lotSnap.exists()) throw new Error("Lot not found");

  const lot = lotSnap.data();
  const trashRefDoc = doc(db, "trash", trashRef);
  const trashSnap = await getDoc(trashRefDoc);
  if(!trashSnap.exists()) throw new Error("Trash not found");

  const t = trashSnap.data();
  const newItems = [...(lot.items || []), t.ref || trashSnap.id];
  const newWeight = (lot.weight || 0) + (t.qty || 0);
  const isFull = newWeight >= (lot.target || 999999);

  await updateDoc(lotRef, { items: newItems, weight: newWeight, isFull, status: isFull ? "FUL" : (lot.status || "OPEN") });

  // update trash
  const tl = t.timeline || [];
  tl.push({ code: "ASG", lot: lotID, at: new Date().toISOString() });
  await updateDoc(trashRefDoc, { status: "ASG", timeline: tl, assignedLot: lotID, updatedAt: new Date().toISOString() });

  // if lot just became full, set fullAt
  if(isFull) {
    await updateDoc(lotRef, { fullAt: new Date().toISOString() });
  }

  return true;
}

/* Quick metrics snapshot (counts + by type) */
export async function metricsSnapshot(){
  initApp();
  const out = {};
  const colNames = ["users","trash","lots","trucks","companies"];
  for(const name of colNames){
    const snap = await getDocs(collection(db, name));
    out[name] = snap.size;
  }

  // trash by type
  const trashDocs = await getDocs(collection(db, "trash"));
  const byType = {};
  trashDocs.forEach(d => {
    const t = d.data().type || "X";
    byType[t] = (byType[t] || 0) + 1;
  });
  out.trashByType = byType;

  return out;
}

/* simple update wrapper */
export async function updateDocSimple(collectionName, docId, payload){
  initApp();
  const dref = doc(db, collectionName, docId);
  await updateDoc(dref, { ...payload, updatedAt: new Date().toISOString() });
  return true;
}

/* default export convenience */
export default {
  initApp, seedIfEmpty, onRealtimeCollection,
  getUser, getAll, createTrash, createLot, assignToLot,
  generateRefID, fullTypeName, fullStatusName, formatTimeline,
  metricsSnapshot, updateDocSimple
};
