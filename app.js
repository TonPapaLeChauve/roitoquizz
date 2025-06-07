import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-app.js";
import { getDatabase, ref, set, onValue, push, onDisconnect, update, remove } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-database.js";

window.addEventListener("DOMContentLoaded", () => {

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
  const messageBox = document.getElementById("messageBox");

  // Helper pour afficher un message
  function showMessage(text) {
    messageBox.textContent = text;
    messageBox.style.display = "block";
  }

  // Reset message
  function clearMessage() {
    messageBox.textContent = "";
    messageBox.style.display = "none";
  }

  btnPseudo.onclick = () => {
    clearMessage();
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
    clearMessage();
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
      // Vérifier si un admin est déjà connecté
      const playersRef = ref(database, "players");
      const snapshot = await new Promise((resolve) => {
        onValue(playersRef, (snap) => {
          resolve(snap);
        }, { onlyOnce: true });
      });

      const players = snapshot.val() || {};
      for (const id in players) {
        if (players[id].role === "admin" && players[id].online === true) {
          alert("Un administrateur est déjà connecté. Impossible de se connecter en tant qu'admin.");
          return;
        }
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
    };

    await set(playerRef, playerObject);
    onDisconnect(playerRef).update({ online: false });

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
      clearMessage();

      let adminOnline = false;

      for (const id in players) {
        const p = players[id];
        if (!p || !p.pseudo || !p.role) continue;

        const el = document.createElement("div");
        el.textContent = p.pseudo + (p.online === false ? " [hors ligne]" : "");
        if (id === playerId) el.style.fontWeight = "bold";

        if (p.role === "admin") {
          adminList.appendChild(el);
          if (p.online) adminOnline = true;
        } else {
          playerList.appendChild(el);
        }
      }

      // Si admin non connecté, reset tout
      if (!adminOnline) {
        showMessage("L'administrateur s'est déconnecté, la partie est annulée.");
        // Déconnexion forcée des joueurs et suppression des joueurs de la base
        for (const id in players) {
          const p = players[id];
          if (p && p.role !== "admin") {
            const playerRef = ref(database, `players/${id}`);
            remove(playerRef);
          }
        }
        // Supprimer les admins aussi (cas de redémarrage)
        for (const id in players) {
          const p = players[id];
          if (p && p.role === "admin") {
            const playerRef = ref(database, `players/${id}`);
            remove(playerRef);
          }
        }
        // Revenir à l'accueil après 3 secondes
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      }
    });
  }

});
