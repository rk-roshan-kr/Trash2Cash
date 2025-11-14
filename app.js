// ---------------------------------------------------------
// FIREBASE INIT
// ---------------------------------------------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAYVQdYQnBVA9yFRHpnpYUZTEESszunUGI",
  authDomain: "trash2cash-cu.firebaseapp.com",
  projectId: "trash2cash-cu",
  storageBucket: "trash2cash-cu.firebasestorage.app",
  messagingSenderId: "630127672722",
  appId: "1:630127672722:web:7c0b83248f13b4a23f154b"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ---------------------------------------------------------
// GLOBAL STATE
// ---------------------------------------------------------
let currentUserId = "user1";
let currentGovId = "gov1";
let currentCoId  = "co1";
let map = null;
let truckMarkers = {};

window.trashData  = {};
window.lotsData   = {};
window.trucksData = {};

let unsubscribeTrash = null;
let unsubscribeLots  = null;
let unsubscribeTruck = null;

const root = document.getElementById("app-root");

// ---------------------------------------------------------
// HELPERS
// ---------------------------------------------------------
const base36 = n => n.toString(36).toUpperCase();
const rand2 = () => Math.random().toString(36).substring(2, 4).toUpperCase();

function generateRefID(type, city) {
  const now = new Date();
  return (
    type +
    city +
    base36(now.getDate()) +
    base36(now.getHours()) +
    base36(now.getMinutes()) +
    rand2()
  );
}

// ---------------------------------------------------------
// SEED SAMPLE USERS/GOV/COMPANIES
// ---------------------------------------------------------
async function seedIfEmpty() {
  const usersCol = collection(db, "users");
  const uDocs = await getDocs(usersCol);

  if (uDocs.empty) {
    const arr = [
      { id: "user1", name: "Anita",   wallet: 0, city: "D" },
      { id: "user2", name: "Rahul",   wallet: 0, city: "D" },
      { id: "user3", name: "Neha",    wallet: 0, city: "D" },
      { id: "user4", name: "Sandeep", wallet: 0, city: "D" },
      { id: "user5", name: "Priya",   wallet: 0, city: "D" }
    ];
    for (const u of arr) await setDoc(doc(db, "users", u.id), u);
  }

  const govCol = collection(db, "gov");
  const gDocs = await getDocs(govCol);

  if (gDocs.empty) {
    const arr = [
      { id: "gov1", name: "Collector A" },
      { id: "gov2", name: "Collector B" },
      { id: "gov3", name: "Collector C" },
      { id: "gov4", name: "Collector D" },
      { id: "gov5", name: "Collector E" }
    ];
    for (const g of arr) await setDoc(doc(db, "gov", g.id), g);
  }

  const coCol = collection(db, "companies");
  const cDocs = await getDocs(coCol);

  if (cDocs.empty) {
    const arr = [
      { id: "co1", name: "GreenRecycle" },
      { id: "co2", name: "EcoBuyers" },
      { id: "co3", name: "ReLoop" },
      { id: "co4", name: "UrbanWasteCo" },
      { id: "co5", name: "CycleMetals" }
    ];
    for (const c of arr) await setDoc(doc(db, "companies", c.id), c);
  }

  // trucks
  const truckCol = collection(db, "trucks");
  const tDocs = await getDocs(truckCol);

  if (tDocs.empty) {
    const base = [23.7953, 86.4304];
    for (let i = 0; i < 5; i++) {
      const lat = base[0] + (Math.random() - 0.5) * 0.02;
      const lon = base[1] + (Math.random() - 0.5) * 0.02;
      await addDoc(truckCol, {
        id: `T${i + 1}`,
        lat,
        lon,
        updated: serverTimestamp()
      });
    }
  }
}

// ---------------------------------------------------------
// REALTIME LISTENERS
// ---------------------------------------------------------
async function initRealtime() {
  // TRASH
  unsubscribeTrash = onSnapshot(collection(db, "trash"), snap => {
    window.trashData = {};
    snap.forEach(d => (window.trashData[d.id] = d.data()));

    if (window.currentPage === "user")    renderUser();
    if (window.currentPage === "govt")    renderGovt();
    if (window.currentPage === "company") renderCompany();
  });

  // LOTS
  unsubscribeLots = onSnapshot(collection(db, "lots"), snap => {
    window.lotsData = {};
    snap.forEach(d => (window.lotsData[d.id] = d.data()));

    if (window.currentPage === "user")    renderUser();
    if (window.currentPage === "company") renderCompany();
  });

  // TRUCKS
  unsubscribeTruck = onSnapshot(collection(db, "trucks"), snap => {
    window.trucksData = {};
    snap.forEach(d => (window.trucksData[d.id] = d.data()));

    if (window.currentPage === "user" && map) updateTrucksOnMap();
  });
}

// ---------------------------------------------------------
// PAGE SWITCHER (MAKE GLOBAL)
// ---------------------------------------------------------
function showPage(name) {
  window.currentPage = name;

  // highlight nav button
  document.querySelectorAll(".nav-btn").forEach(btn =>
    btn.classList.toggle("active", btn.dataset.target === name)
  );

  if (name === "master")  return renderMaster();
  if (name === "user")    return renderUser();
  if (name === "govt")    return renderGovt();
  if (name === "company") return renderCompany();
}

window.showPage = showPage;

// ---------------------------------------------------------
// MASTER PAGE
// ---------------------------------------------------------
function renderMaster() {
  root.innerHTML = `
    <div class="page">
      <h2>Master Login</h2>
      <p>Select any role:</p>
      <button class="primary" onclick="showPage('user')">User Mode</button>
      <button class="primary" onclick="showPage('govt')">Govt Mode</button>
      <button class="primary" onclick="showPage('company')">Company Mode</button>
    </div>
  `;
}

// ---------------------------------------------------------
// USER PAGE
// ---------------------------------------------------------
async function renderUser() {
  root.innerHTML = `
    <div class="page">
      <h2>User Dashboard</h2>

      <label>User:
        <select id="user-switch"></select>
      </label>

      <div style="margin-top:10px" class="row">
        <select id="u-type" class="flex-1">
          <option value="P">Plastic</option>
          <option value="A">Paper</option>
          <option value="M">Metal</option>
          <option value="G">Glass</option>
          <option value="O">Organic</option>
          <option value="E">E-waste</option>
          <option value="C">Cardboard</option>
          <option value="X">Mixed</option>
        </select>

        <input id="u-qty" placeholder="kg" style="width:70px" />
        <input id="u-city" placeholder="City" style="width:70px" />

        <button class="primary" onclick="createListing()">+</button>
      </div>

      <h3>Your Listings</h3>
      <div id="user-listings"></div>

      <h3 style="margin-top:15px">Truck Locations</h3>
      <div id="map" style="height:300px"></div>
    </div>
  `;

  // Populate user dropdown
  const snap = await getDocs(collection(db, "users"));
  const sel = document.getElementById("user-switch");
  sel.innerHTML = "";
  snap.forEach(d => {
    const o = document.createElement("option");
    o.value = d.id;
    o.textContent = d.id + " (" + d.data().name + ")";
    sel.appendChild(o);
  });
  sel.value = currentUserId;
  sel.onchange = () => {
    currentUserId = sel.value;
    renderUser();
  };

  renderUserListings();
  initMap();
}

function renderUserListings() {
  const div = document.getElementById("user-listings");
  const items = Object.values(window.trashData).filter(t => t.owner === currentUserId);

  div.innerHTML = items
    .map(t => `
      <div class="list-item">
        <b>${t.ref}</b> — ${t.type} — ${t.qty}kg — ${t.status}
        <div class="small">${(t.timeline || [])
          .map(x => x.code + " @ " + new Date(x.at).toLocaleString())
          .join("<br>")}
        </div>
      </div>
    `)
    .join("") || "<div>No items</div>";
}

async function createListing() {
  const type = document.getElementById("u-type").value;
  const qty  = parseFloat(document.getElementById("u-qty").value) || 1;
  const city = (document.getElementById("u-city").value || "D").toUpperCase();
  const ref  = generateRefID(type, city);

  await setDoc(doc(db, "trash", ref), {
    ref,
    owner: currentUserId,
    type,
    qty,
    city,
    status: "PEN",
    createdAt: new Date().toISOString(),
    timeline: [ { code: "PEN", at: new Date().toISOString() } ]
  });

  alert("Created " + ref);
}

// ---------------------------------------------------------
// GOVT PAGE
// ---------------------------------------------------------
async function renderGovt() {
  root.innerHTML = `
    <div class="page">
      <h2>Gov Collector</h2>

      <label>Collector:
        <select id="gov-switch"></select>
      </label>

      <div style="margin-top:10px" class="row">
        <input id="gov-ref" placeholder="Ref ID" class="flex-1" />
        <button class="primary" onclick="govCollect()">COLLECT</button>
      </div>

      <h3>Collected Items</h3>
      <div id="gov-collected"></div>
    </div>
  `;

  const snap = await getDocs(collection(db, "gov"));
  const sel = document.getElementById("gov-switch");
  sel.innerHTML = "";
  snap.forEach(d => {
    const o = document.createElement("option");
    o.value = d.id;
    o.textContent = d.id + " (" + d.data().name + ")";
    sel.appendChild(o);
  });
  sel.value = currentGovId;
  sel.onchange = () => {
    currentGovId = sel.value;
    renderGovt();
  };

  renderGovtCollected();
}

function renderGovtCollected() {
  const div = document.getElementById("gov-collected");
  const items = Object.values(window.trashData).filter(t => t.status !== "PEN");

  div.innerHTML = items
    .map(t => `
      <div class="list-item">
        <b>${t.ref}</b> — ${t.type} — ${t.qty}kg — ${t.status}
      </div>
    `)
    .join("") || "<div>No items</div>";
}

async function govCollect() {
  const ref = document.getElementById("gov-ref").value.trim();
  if (!ref) return alert("Enter ref");

  const dref = doc(db, "trash", ref);
  const snap = await getDoc(dref);
  if (!snap.exists()) return alert("Invalid Ref");

  const item = snap.data();
  const timeline = item.timeline || [];

  timeline.push({ code: "COL", worker: currentGovId, at: new Date().toISOString() });

  await updateDoc(dref, { status: "COL", timeline });

  setTimeout(() => arriveAtSorting(ref), 600);
  alert("Collected!");
}

// ---------------------------------------------------------
// SORTING → LOT ASSIGNMENT
// ---------------------------------------------------------
async function arriveAtSorting(ref) {
  const dref = doc(db, "trash", ref);
  const snap = await getDoc(dref);
  if (!snap.exists()) return;

  const item = snap.data();
  const tl = item.timeline || [];
  tl.push({ code: "SCN", at: new Date().toISOString() });

  await updateDoc(dref, { status: "SCN", timeline: tl });

  await assignToLot(item);
}

async function assignToLot(item) {
  const col = collection(db, "lots");
  const q = query(col,
    where("type", "==", item.type),
    where("city", "==", item.city),
    where("isFull", "==", false)
  );

  const snap = await getDocs(q);
  let lotRef;

  if (snap.empty) {
    // create new lot
    lotRef = await addDoc(col, {
      type: item.type,
      city: item.city,
      target: 500,
      weight: 0,
      items: [],
      isFull: false,
      createdAt: new Date().toISOString(),
      bids: []
    });
  } else {
    lotRef = snap.docs[0].ref;
  }

  const lotSnap = await getDoc(lotRef);
  const lot = lotSnap.data();

  const newItems = [...(lot.items || []), item.ref];
  const newWeight = (lot.weight || 0) + item.qty;
  const isFull = newWeight >= lot.target;

  await updateDoc(lotRef, {
    items: newItems,
    weight: newWeight,
    isFull
  });

  const itemRef = doc(db, "trash", item.ref);
  const iSnap = await getDoc(itemRef);
  const data = iSnap.data();
  const tl = data.timeline || [];
  tl.push({ code: "ASG", lot: lotRef.id, at: new Date().toISOString() });

  await updateDoc(itemRef, { status: "ASG", timeline: tl });

  if (isFull) {
    await updateDoc(lotRef, {
      status: "FUL",
      fullAt: new Date().toISOString()
    });
    resolveAuction(lotRef.id);
  }
}

// ---------------------------------------------------------
// COMPANY PAGE
// ---------------------------------------------------------
async function renderCompany() {
  root.innerHTML = `
    <div class="page">
      <h2>Company Dashboard</h2>

      <label>Company:
        <select id="co-switch"></select>
      </label>

      <h3>LOTS</h3>
      <div id="lots-container">Loading...</div>

      <h3>Your Bids</h3>
      <div id="my-bids"></div>
    </div>
  `;

  const snap = await getDocs(collection(db, "companies"));
  const sel = document.getElementById("co-switch");
  sel.innerHTML = "";
  snap.forEach(d => {
    const o = document.createElement("option");
    o.value = d.id;
    o.textContent = d.id + " (" + d.data().name + ")";
    sel.appendChild(o);
  });
  sel.value = currentCoId;
  sel.onchange = () => {
    currentCoId = sel.value;
    renderCompany();
  };

  renderLotsForCompany();
}

function renderLotsForCompany() {
  const cont = document.getElementById("lots-container");

  const lots = Object.entries(window.lotsData).map(([id, l]) => ({
    id,
    ...l
  }));

  cont.innerHTML =
    lots
      .map(
        l => `
      <div class="list-item">
        <b>${l.id}</b> — ${l.type} — ${l.weight}kg / ${l.target}kg
        <br>${l.isFull ? "<b>FULL</b>" : "Open"}

        <div style="margin-top:6px">
          <input id="bid-${l.id}" placeholder="₹ price" style="width:90px"/>
          <button class="primary" onclick="placeBid('${l.id}')">Bid</button>
        </div>
      </div>`
      )
      .join("") || "<div>No lots</div>";

  const mine = [];
  for (const [id, lot] of Object.entries(window.lotsData)) {
    (lot.bids || []).forEach(b => {
      if (b.company === currentCoId)
        mine.push({
          id,
          price: b.price,
          at: b.at
        });
    });
  }

  document.getElementById("my-bids").innerHTML =
    mine
      .map(m => `<div>${m.id} — ₹${m.price} — ${m.at}</div>`)
      .join("") || "<div>No bids</div>";
}

async function placeBid(lotID) {
  const input = document.getElementById("bid-" + lotID);
  const price = parseFloat(input.value);
  if (!price) return alert("Enter amount");

  const lref = doc(db, "lots", lotID);
  const snap = await getDoc(lref);
  if (!snap.exists()) return alert("Invalid lot");

  const lot = snap.data();
  const bids = lot.bids || [];

  bids.push({
    company: currentCoId,
    price,
    at: new Date().toISOString()
  });

  await updateDoc(lref, { bids });

  alert("Bid placed");

  if (lot.isFull) resolveAuction(lotID);
}

// ---------------------------------------------------------
// AUCTION RESOLUTION
// ---------------------------------------------------------
async function resolveAuction(lotID) {
  const lref = doc(db, "lots", lotID);
  const snap = await getDoc(lref);
  if (!snap.exists()) return;

  const lot = snap.data();
  if (!lot.bids || lot.bids.length === 0) return;

  const sorted = lot.bids.sort((a, b) => b.price - a.price);
  const winner = sorted[0];

  await updateDoc(lref, {
    status: "SLD",
    soldTo: winner.company,
    soldPrice: winner.price
  });

  const total = lot.weight;

  for (const ref of lot.items) {
    const tRef = doc(db, "trash", ref);
    const tSnap = await getDoc(tRef);
    const t = tSnap.data();

    const share = (t.qty / total) * winner.price;

    // Credit wallet (90% to user)
    const uRef = doc(db, "users", t.owner);
    const uSnap = await getDoc(uRef);
    const prev = uSnap.data().wallet || 0;

    await updateDoc(uRef, { wallet: prev + share * 0.9 });

    const tl = t.timeline || [];
    tl.push({
      code: "SLD",
      at: new Date().toISOString(),
      lot: lotID,
      price: share
    });

    await updateDoc(tRef, {
      status: "SLD",
      timeline: tl
    });
  }

  alert("LOT " + lotID + " sold to " + winner.company + " for ₹" + winner.price);
}

// ---------------------------------------------------------
// MAP
// ---------------------------------------------------------
function initMap() {
  if (map) return;

  if (!window.L) return; // Leaflet not loaded

  map = L.map("map").setView([23.7953, 86.4304], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19
  }).addTo(map);

  updateTrucksOnMap();
}

function updateTrucksOnMap() {
  if (!map) return;

  Object.values(window.trucksData).forEach(t => {
    if (!truckMarkers[t.id]) {
      truckMarkers[t.id] = L.marker([t.lat, t.lon]).addTo(map);
    } else {
      truckMarkers[t.id].setLatLng([t.lat, t.lon]);
    }
  });
}

window.updateTrucksOnMap = updateTrucksOnMap;

// ---------------------------------------------------------
// DOM READY → START APP
// ---------------------------------------------------------
window.addEventListener("DOMContentLoaded", async () => {
  await seedIfEmpty();
  await initRealtime();

  // bind nav
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => showPage(btn.dataset.target));
  });

  // load first page
  showPage("master");
});
