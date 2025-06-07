import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-app.js";
import { getDatabase, ref, set, onValue, push, onDisconnect, update } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-database.js";

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

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

let playerId = null;
let playerData = { pseudo: null, role: null };

const stepPseudo = document.getElementById("stepPseudo");
const pseudoInput = document.getElementById("pseudoInput");
const btnPseudo = document.getElementById("btnPseudo");

const stepRole = document.getElementById("stepRole");
const roleSelect = document.getElementById("roleSelect");
const adminPassword = document.getElementById("adminPassword");
const btnValiderRole = document.getElementById("btnValiderRole");

const lobby = document.getElementById("lobby");
const adminList = document.getElementById("adminList");
const playerList = document.getElementById("playerList");

// Reset du select role au chargement de la page (évite mémorisation navigateur)
roleSelect.value = "";
adminPassword.classList.add("hidden");
adminPassword.value = "";

btnPseudo.onclick = () => {
  const pseudo = pseudoInput.value.trim();
  if (!pseudo) {
    alert("Entre un pseudo");
    return;
  }
  playerData.pseudo = pseudo;
  stepPseudo.classList.add("hidden");
  stepRole.classList.remove("hidden");
};

roleSelect.addEventListener("change", () => {
  if (roleSelect.value === "admin") {
    adminPassword.classList.remove("hidden");
  } else {
    adminPassword.classList.add("hidden");
    adminPassword.value = "";
  }
});

btnValiderRole.onclick = () => {
  const role = roleSelect.value;
  const pwd = adminPassword.value;
  if (!role) {
    alert("Choisis un rôle");
    return;
  }
  if (role === "admin" && pwd !== "tocard") {
    alert("Mot de passe admin incorrect");
    return;
  }

  playerData.role = role;
  playerId = push(ref(database, "players")).key;
  const playerRef = ref(database, `players/${playerId}`);

  const playerObject = {
    pseudo: playerData.pseudo,
    role: playerData.role,
    online: true,
    points: 0,
    disconnectedAt: null,
  };

  set(playerRef, playerObject);

  // Sur déconnexion, online passe à false + on stocke le timestamp
  onDisconnect(playerRef).update({ online: false, disconnectedAt: Date.now() });

  stepRole.classList.add("hidden");
  lobby.classList.remove("hidden");

  startLobbyListener();
};

function startLobbyListener() {
  const playersRef = ref(database, "players");
  onValue(playersRef, (snapshot) => {
    const players = snapshot.val() || {};

    adminList.innerHTML = "";
    playerList.innerHTML = "";

    const now = Date.now();
    const TWO_MIN = 2 * 60 * 1000;

    for (const id in players) {
      const p = players[id];
      if (!p || !p.pseudo || !p.role) continue;

      // Ignorer joueurs hors ligne depuis plus de 2 minutes
      const offlineTooLong =
        p.online === false &&
        p.disconnectedAt &&
        now - p.disconnectedAt > TWO_MIN;
      if (offlineTooLong) continue;

      const el = document.createElement("div");
      el.textContent = p.pseudo + (p.online === false ? " [hors ligne]" : "");

      // Tous les noms en gras
      el.style.fontWeight = "bold";

      // Classe CSS pour différencier les offline (optionnel)
      if (p.online === false) el.classList.add("offline");

      if (p.role === "admin") {
        adminList.appendChild(el);
      } else {
        playerList.appendChild(el);
      }
    }
  });
}
