// common.js — shared Firebase + helpers (modular v12)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getFirestore, collection, doc, setDoc, addDoc, getDoc, getDocs,
  updateDoc, deleteDoc, 
  onSnapshot, serverTimestamp, query, where
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

// --- NEW: Pricing Chart ---
// This is now the "base value" of trash
export const PRICING_CHART = {
  P: 10, A: 5, M: 50, G: 8, E: 15, X: 2 
};

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
    P: "Plastic", A: "Paper", M: "Metal", G: "Glass",
    E: "E-waste", C: "Cardboard", X: "Mixed",
    PET: "Plastic", PPR: "Paper", MET: "Metal", GLS: "Glass", ORG: "Organic" // Aliases
  }[code] || code;
}

export function fullStatusName(code){
  return {
    PEN: "Pending Pickup", COL: "Collected by Govt Worker", SCN: "Sorted at Center",
    ASG: "Assigned to Lot", FUL: "Lot Full", SLD: "Sold to Company"
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
    type + city +
    d.getDate().toString(36).toUpperCase() +
    d.getHours().toString(36).toUpperCase() +
    d.getMinutes().toString(36).toUpperCase() +
    Math.random().toString(36).slice(2, 6).toUpperCase()
  );
}

/* Seed demo data (idempotent) */
export async function seedIfEmpty(){
  initApp();
  // ... (Seeding logic is unchanged)
  // users
  const uCol = collection(db, "users");
  const uDocs = await getDocs(uCol);
  if (uDocs.empty) {
    const users = [
      { id: "user1", name: "Anita", email: "user1@demo.com", role: "user", wallet: 0 },
      { id: "user2", name: "Rahul", email: "user2@demo.com", role: "user", wallet: 0 },
      { id: "user3", name: "Neha", email: "user3@demo.com", role: "user", wallet: 0 },
      { id: "gov1", name: "Govt. Worker", email: "gov1@demo.com", role: "gov", wallet: 0 },
      { id: "co1", name: "Recycle Inc.", email: "co1@demo.com", role: "company", wallet: 0 }
    ];
    for (const u of users) await setDoc(doc(db, "users", u.id), u);
    console.log("common.js: seeded users");
  }
  // trucks
  const tc = collection(db, "trucks");
  const tDocs = await getDocs(tc);
  if (tDocs.empty) {
    console.log("common.js: Seeding trucks...");
    const hubs = {
      CHD: [30.737, 76.768], KHA: [30.74, 76.65],
      DEL: [28.613, 77.209], MUM: [19.076, 72.877]
    };
    let truckCounter = 1;
    for (const [hubName, baseCoords] of Object.entries(hubs)) {
      for (let i = 1; i <= 3; i++) {
        const truckId = `${hubName}-T${i}`;
        await setDoc(doc(db, "trucks", truckId), {
          id: truckId, 
          lat: baseCoords[0] + (Math.random() - 0.5) * 0.05,
          lon: baseCoords[1] + (Math.random() - 0.5) * 0.05,
          updated: new Date().toISOString()
        });
        truckCounter++;
      }
    }
    console.log(`common.js: seeded ${truckCounter - 1} trucks`);
  }
  // trash
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

/* Creates or overwrites a doc with a specific ID (for auth.html sign-up) */
export async function setDocument(collectionName, docId, data) {
  initApp();
  try {
    const docRef = doc(db, collectionName, docId);
    await setDoc(docRef, data, { merge: true });
    return true;
  } catch (e) {
    console.error("Error setting document: ", e);
    throw e;
  }
}

/* Deletes a document by its ID (for admin.html) */
export async function deleteDocument(collectionName, docId) {
  initApp();
  const docRef = doc(db, collectionName, docId);
  await deleteDoc(docRef);
}

/* --- UPDATED: createLot (Now includes bidding timer) --- */
export async function createLot(payload){
  initApp();
  const { id, type = "X", city = "D", target = 500, biddingDurationDays = 1 } = payload;
  
  // Calculate the bidding end time
  const createdAt = new Date();
  const biddingEndsAt = new Date(createdAt.getTime() + (biddingDurationDays * 24 * 60 * 60 * 1000));
  
  const data = {
    type, city, target, 
    weight: 0, items: [], isFull: false, 
    createdAt: createdAt.toISOString(), 
    biddingEndsAt: biddingEndsAt.toISOString(), // NEW FIELD
    status: "OPEN", bids: []
  };

  if (id) {
    const docRef = doc(db, "lots", id);
    await setDoc(docRef, { ...data, id: id });
    return id;
  } else {
    const col = collection(db, "lots");
    const docRef = await addDoc(col, data);
    return docRef.id;
  }
}

/* --- UPDATED: assignToLot (Now pays remaining 90%) --- */
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
  
  // --- 1. PAYOUT LOGIC (Remaining 90%) ---
  if (t.owner && t.status === 'SCN') { // Only pay if it was just sorted
    const itemBaseValue = (PRICING_CHART[t.type] || 0) * (t.qty || 0);
    const remainingPayout = itemBaseValue * 0.90; // Pay the other 90%
    
    if (remainingPayout > 0) {
      const userRef = doc(db, "users", t.owner);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        await updateDoc(userRef, {
          wallet: (userData.wallet || 0) + remainingPayout
        });
      } else {
        console.warn(`Cannot pay 90% to ${t.owner}: user not found.`);
      }
    }
  }
  
  // --- 2. Update Lot ---
  const newItems = [...(lot.items || []), t.ref || trashSnap.id];
  const newWeight = (lot.weight || 0) + (t.qty || 0);
  const isFull = newWeight >= (lot.target || 999999);
  await updateDoc(lotRef, { items: newItems, weight: newWeight, isFull, status: isFull ? "FUL" : (lot.status || "OPEN") });

  // --- 3. Update Trash Item ---
  const tl = t.timeline || [];
  tl.push({ code: "ASG", lot: lotID, at: new Date().toISOString() });
  await updateDoc(trashRefDoc, { status: "ASG", timeline: tl, assignedLot: lotID, updatedAt: new Date().toISOString() });

  if(isFull) {
    await updateDoc(lotRef, { fullAt: new Date().toISOString() });
  }
  return true;
}

/* --- NEW: dissolveLot --- */
export async function dissolveLot(lotId) {
  initApp();
  const lotRef = doc(db, "lots", lotId);
  const lotSnap = await getDoc(lotRef);
  if (!lotSnap.exists()) throw new Error("Lot not found");
  
  const lot = lotSnap.data();
  const itemsToReturn = lot.items || [];
  
  if (lot.status === 'SLD') throw new Error("Cannot dissolve a lot that is already sold.");

  // Create all promises to update trash items
  const updatePromises = itemsToReturn.map(refId => {
    const trashRef = doc(db, "trash", refId);
    return updateDocField("trash", refId, (data) => {
      if (!data) return; // Item was deleted, skip
      data.status = "SCN"; // Set status back to "Sorted"
      data.assignedLot = "";
      // Remove the "Assigned to Lot" (ASG) timeline entry
      if (data.timeline) {
        data.timeline = data.timeline.filter(t => t.code !== "ASG");
      }
      return data;
    });
  });
  
  // Wait for all trash items to be updated
  await Promise.all(updatePromises);
  
  // After all items are returned, delete the lot
  await deleteDoc(lotRef);
  
  return itemsToReturn.length; // Return how many items were returned
}

// ADD THIS FUNCTION TO common.js

/**
 * Finalizes the sale of a lot after bidding has ended.
 * 1. Finds the highest bidder.
 * 2. Marks the lot as 'SLD' (Sold).
 * 3. Stamps the lot with the 'winner' and 'soldPrice'.
 * 4. Updates all trash items in the lot to 'SLD'.
 * (Note: Payouts already happened at SCN and ASG steps).
 * @param {string} lotId - The ID of the lot to sell.
 * @returns {Promise<object>} An object with the winner and winning bid.
 */
export async function sellLot(lotId) {
  initApp();
  
  const lotRef = doc(db, "lots", lotId);
  const lotSnap = await getDoc(lotRef);

  if (!lotSnap.exists()) {
    throw new Error(`Lot not found: ${lotId}`);
  }

  const lot = lotSnap.data();

  if (lot.status === 'SLD') {
    throw new Error("This lot has already been sold.");
  }

  if (!lot.isFull) {
    throw new Error("This lot is not full yet.");
  }

  // Check if bidding is over
  const bidEndTime = new Date(lot.biddingEndsAt || 0).getTime();
  if (new Date().getTime() < bidEndTime) {
    throw new Error("Bidding has not ended for this lot.");
  }

  // Find the winner
  if (!lot.bids || lot.bids.length === 0) {
    throw new Error("Cannot sell lot: No bids have been placed.");
  }

  const winningBid = lot.bids.sort((a, b) => b.price - a.price)[0];
  const winnerId = winningBid.company;
  const winningPrice = winningBid.price;

  // 1. Update the Lot document
  await updateDoc(lotRef, {
    status: "SLD",
    winner: winnerId,
    soldPrice: winningPrice
  });

  // 2. Update all associated trash items to 'SLD'
  const itemsToUpdate = lot.items || [];
  const updatePromises = itemsToUpdate.map(refId => {
    return updateDocField("trash", refId, (data) => {
      if (data) {
        data.status = "SLD";
        data.timeline.push({
          code: "SLD",
          at: new Date().toISOString(),
          soldTo: winnerId,
          price: winningPrice
        });
      }
      return data;
    });
  });

  await Promise.all(updatePromises);

  return { winner: winnerId, winningBid: winningPrice, usersPaid: 0 }; // 0 users paid, as they were paid on SCN and ASG
}
/* Quick metrics snapshot (counts + by type) */
export async function metricsSnapshot(){
  initApp();
  // ... (Unchanged)
  const out = {};
  const colNames = ["users","trash","lots","trucks","companies", "facilities"]; // Added facilities
  for(const name of colNames){
    const snap = await getDocs(collection(db, name));
    out[name] = snap.size;
  }
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

/* Fetches documents from a collection, with an optional query. */
export async function getDocsFromCol(collectionName, queryFn = null) {
  initApp();
  const colRef = collection(db, collectionName);
  const q = queryFn ? queryFn(query(colRef)) : colRef;
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/* Safely updates a doc by reading it, modifying, and writing back. */
export async function updateDocField(collectionName, docId, modifyCallback) {
  initApp();
  const docRef = doc(db, collectionName, docId);
  try {
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      throw new Error(`Document not found: ${collectionName}/${docId}`);
    }
    let data = docSnap.data();
    let newData = modifyCallback(data);
    if (newData) { // Only update if callback returns data
      await updateDoc(docRef, newData);
    }
    return true;
  } catch (e) {
    console.error("updateDocField failed: ", e);
    throw e;
  }
}


/* --- UPDATED default export convenience --- */
export default {
  initApp, seedIfEmpty, onRealtimeCollection,
  getUser, getAll, createTrash, createLot, assignToLot,
  generateRefID, fullTypeName, fullStatusName, formatTimeline,
  metricsSnapshot, updateDocSimple,
  setDocument, sellLot , deleteDocument,
  getDocsFromCol, updateDocField,
  dissolveLot, // <-- NEW EXPORT
  PRICING_CHART // <-- NEW EXPORT
};