import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  onValue,
  push,
  onDisconnect,
  update,
  remove,
  get,
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
const adminList = document.getElementById("adminList");
const playerList = document.getElementById("playerList");

const messageBox = document.getElementById("messageBox");

// Helper : retrouver playerId par pseudo (retourne null si absent)
async function findPlayerIdByPseudo(pseudo) {
  const playersRef = ref(database, "players");
  const snapshot = await get(playersRef);
  const players = snapshot.val() || {};
  for (const id in players) {
    if (players[id].pseudo === pseudo) return id;
  }
  return null;
}

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

btnValiderRole.onclick = async () => {
  const role = roleSelect.value;
  const pwd = adminPassword.value;

  if (!role) {
    alert("Choisis un rôle");
    return;
  }

  if (role === "admin") {
    if (pwd !== "tocard") {
      alert("Mot de passe admin incorrect");
      return;
    }

    // Vérifier s'il y a déjà un admin connecté
    const playersRef = ref(database, "players");
    const snapshot = await get(playersRef);
    const players = snapshot.val() || {};

    const adminConnected = Object.values(players).some(
      (p) => p.role === "admin" && p.online === true
    );
    if (adminConnected) {
      alert("Un administrateur est déjà connecté.");
      return;
    }
  } else {
    // Pour joueur, vérifier que pseudo unique (online=true)
    const playersRef = ref(database, "players");
    const snapshot = await get(playersRef);
    const players = snapshot.val() || {};

    const pseudoTakenOnline = Object.values(players).some(
      (p) => p.pseudo === playerData.pseudo && p.online === true
    );
    if (pseudoTakenOnline) {
      alert(
        "Ce pseudo est déjà utilisé par un joueur actuellement en ligne. Choisis-en un autre."
      );
      return;
    }
  }

  playerData.role = role;

  // Essayer de récupérer un ancien playerId avec ce pseudo (ex joueur reconnecte)
  const existingId = await findPlayerIdByPseudo(playerData.pseudo);

  if (existingId) {
    // Récupérer les données existantes et les mettre à jour online=true, role etc
    playerId = existingId;
    const playerRef = ref(database, `players/${playerId}`);

    const snapshot = await get(playerRef);
    const oldData = snapshot.val() || {};

    const updatedData = {
      ...oldData,
      role: playerData.role,
      online: true,
    };

    await set(playerRef, updatedData);
    onDisconnect(playerRef).update({ online: false });
  } else {
    // Créer nouveau joueur
    playerId = push(ref(database, "players")).key;
    const playerRef = ref(database, `players/${playerId}`);

    const playerObject = {
      pseudo: playerData.pseudo,
      role: playerData.role,
      online: true,
      points: 0,
    };

    await set(playerRef, playerObject);
    onDisconnect(playerRef).update({ online: false });
  }

  stepRole.classList.add("hidden");
  lobby.classList.remove("hidden");

  startLobbyListener();
  monitorAdminStatus();
};

function startLobbyListener() {
  const playersRef = ref(database, "players");
  onValue(playersRef, (snapshot) => {
    const players = snapshot.val() || {};

    adminList.innerHTML = "";
    playerList.innerHTML = "";
    messageBox.textContent = "";

    for (const id in players) {
      const p = players[id];
      if (!p || !p.pseudo || !p.role) continue;

      const el = document.createElement("div");

      // Ajout emoji selon rôle
      const emoji = p.role === "admin" ? "👑" : "🎮";

      el.textContent = `${emoji} ${p.pseudo}`;
      if (p.online === false) el.textContent += " [hors ligne]";
      if (id === playerId) el.style.fontWeight = "bold";

      if (p.role === "admin") {
        adminList.appendChild(el);
      } else {
        playerList.appendChild(el);
      }
    }
  });
}

function monitorAdminStatus() {
  const playersRef = ref(database, "players");

  onValue(playersRef, (snapshot) => {
    const players = snapshot.val() || {};

    // Chercher un admin connecté
    const adminOnline = Object.entries(players).find(
      ([id, p]) => p.role === "admin" && p.online === true
    );

    if (!adminOnline) {
      // Admin déconnecté, afficher message et réinitialiser la base
      messageBox.textContent =
        "L'administrateur s'est déconnecté. La partie est annulée.";

      // Supprimer tous les joueurs (réinitialiser la base)
      remove(ref(database, "players"));

      // Remettre l'interface au début
      lobby.classList.add("hidden");
      stepRole.classList.add("hidden");
      stepPseudo.classList.remove("hidden");

      // Nettoyer les listes
      adminList.innerHTML = "";
      playerList.innerHTML = "";

      // Réinitialiser variables locales
      playerId = null;
      playerData = { pseudo: null, role: null };
    }
  });
}
