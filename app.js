import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  onValue,
  push,
  onDisconnect,
  update,
  get,
  remove,
} from "https://www.gstatic.com/firebasejs/9.6.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAwi1VHv7jaaPPyanv90CCheM1mZ-xNr58",
  authDomain: "roidestocards-d0084.firebaseapp.com",
  databaseURL:
    "https://roidestocards-d0084-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "roidestocards-d0084",
  storageBucket: "roidestocards-d0084.appspot.com",
  messagingSenderId: "120053524190",
  appId: "1:120053524190:web:c68520412faff06836044f",
  measurementId: "G-YVH6BWKZGZ",
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
const lobbyListAdmin = document.getElementById("lobbyListAdmin");
const lobbyListPlayers = document.getElementById("lobbyListPlayers");

// Empêche que le rôle soit mémorisé (supprime la valeur au chargement)
window.addEventListener("load", () => {
  roleSelect.value = "";
  adminPassword.value = "";
  adminPassword.classList.add("hidden");
});

// Étape 1 : Choix du pseudo
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

// Affichage conditionnel du champ mot de passe admin
roleSelect.addEventListener("change", () => {
  if (roleSelect.value === "admin") {
    adminPassword.classList.remove("hidden");
  } else {
    adminPassword.classList.add("hidden");
    adminPassword.value = "";
  }
});

// Étape 2 : Validation rôle + connexion Firebase
btnValiderRole.onclick = async () => {
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

  if (role === "admin") {
    // Vérifier s'il y a déjà un admin en ligne
    const playersSnapshot = await get(ref(database, "players"));
    const players = playersSnapshot.val() || {};
    const adminOnline = Object.values(players).some(
      (p) => p.role === "admin" && p.online === true
    );
    if (adminOnline) {
      alert(
        "Un administrateur est déjà connecté. Impossible de vous connecter en admin."
      );
      return;
    }
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

  await set(playerRef, playerObject);

  // On met à jour l'état online et timestamp déconnexion à la déconnexion
  onDisconnect(playerRef).update({ online: false, disconnectedAt: Date.now() });

  stepRole.classList.add("hidden");
  lobby.classList.remove("hidden");

  startLobbyListener();
  startAdminWatcher();
};

// Affichage de la liste et mise à jour en temps réel
function startLobbyListener() {
  const playersRef = ref(database, "players");
  onValue(playersRef, (snapshot) => {
    const players = snapshot.val() || {};

    lobbyListAdmin.innerHTML = "";
    lobbyListPlayers.innerHTML = "";

    for (const [id, p] of Object.entries(players)) {
      if (!p || !p.pseudo || !p.role) continue;

      const el = document.createElement("div");
      el.textContent = p.pseudo + (p.online === false ? " [hors ligne]" : "");
      if (id === playerId) el.classList.add("bold");

      if (p.role === "admin") {
        lobbyListAdmin.appendChild(el);
      } else {
        lobbyListPlayers.appendChild(el);
      }
    }
  });
}

// Surveille l'état de l'admin : si plus d'admin en ligne => annule la partie
let gameCancelled = false;
function startAdminWatcher() {
  const playersRef = ref(database, "players");
  onValue(playersRef, (snapshot) => {
    const players = snapshot.val() || {};
    const adminOnline = Object.values(players).some(
      (p) => p.role === "admin" && p.online === true
    );

    if (!adminOnline && !gameCancelled) {
      gameCancelled = true;
      cancelGame();
    }
  });
}

// Annule la partie : alert, reset base et UI
async function cancelGame() {
  alert("La partie est annulée car l'administrateur s'est déconnecté.");

  await remove(ref(database, "players"));

  // Reset variables
