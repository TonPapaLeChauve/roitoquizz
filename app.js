// Import the functions you need from the Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-app.js";
import { getDatabase, ref, set, onValue, push } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-database.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAwi1VHv7jaaPPyanv90CCheM1mZ-xNr58",
  authDomain: "roidestocards-d0084.firebaseapp.com",
  databaseURL: "https://roidestocards-d0084-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "roidestocards-d0084",
  storageBucket: "roidestocards-d0084.appspot.com",
  messagingSenderId: "120053524190",
  appId: "1:120053524190:web:c68520412faff06836044f",
  measurementId: "G-YVH6BWKZGZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Global variables
let playerId = null;
let playerData = { pseudo: null, role: null };

// DOM Elements
const stepPseudo = document.getElementById("stepPseudo");
const pseudoInput = document.getElementById("pseudoInput");
const btnPseudo = document.getElementById("btnPseudo");

const stepRole = document.getElementById("stepRole");
const roleSelect = document.getElementById("roleSelect");
const adminPassword = document.getElementById("adminPassword");
const btnValiderRole = document.getElementById("btnValiderRole");

const lobby = document.getElementById("lobby");
const lobbyList = document.getElementById("lobbyList");

// Step 1: Choose pseudo
btnPseudo.onclick = () => {
  const pseudo = pseudoInput.value.trim();
  if (!pseudo) {
    alert("Entrez un pseudo");
    return;
  }
  playerData.pseudo = pseudo;
  stepPseudo.classList.add("hidden");
  stepRole.classList.remove("hidden");
};

// Show/hide admin password field based on role
roleSelect.addEventListener("change", () => {
  if (roleSelect.value === "admin") {
    adminPassword.classList.remove("hidden");
  } else {
    adminPassword.classList.add("hidden");
    adminPassword.value = "";
  }
});

// Step 2: Validate role + admin password if needed + register in Firebase
btnValiderRole.onclick = () => {
  const role = roleSelect.value;
  const pwd = adminPassword.value;
  if (!role) {
    alert("Choisissez un rôle");
    return;
  }
  if (role === "admin" && pwd !== "tocard") {
    alert("Mot de passe admin incorrect");
    return;
  }

  playerData.role = role;
  const playersRef = ref(database, "players");
  playerId = push(playersRef).key;
  const playerRef = ref(database, `players/${playerId}`);
  set(playerRef, { pseudo: playerData.pseudo, role: playerData.role });

  stepRole.classList.add("hidden");
  lobby.classList.remove("hidden");
  startLobbyListener();
};

// Listen for real-time updates on players list
function startLobbyListener() {
  const playersRef = ref(database, "players");
  onValue(playersRef, (snapshot) => {
    const players = snapshot.val() || {};
    lobbyList.innerHTML = "";
    for (const id in players) {
      const p = players[id];
      const span = document.createElement("div");
      span.textContent = p.pseudo + (p.role === "admin" ? " (Admin)" : "");
      if (id === playerId) span.style.fontWeight = "bold";
      lobbyList.appendChild(span);
    }
  });
}
