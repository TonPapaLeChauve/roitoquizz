import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  onValue,
  push,
  onDisconnect,
  remove,
  get,
  update,
} from "https://www.gstatic.com/firebasejs/9.6.0/firebase-database.js";

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
const db = getDatabase(app);

let playerId = null;
let playerData = { pseudo: null, role: null };

const pseudoInput = document.getElementById("pseudoInput");
const btnPseudo = document.getElementById("btnPseudo");
const stepPseudo = document.getElementById("stepPseudo");

const stepRole = document.getElementById("stepRole");
const roleSelect = document.getElementById("roleSelect");
const adminPassword = document.getElementById("adminPassword");
const btnValiderRole = document.getElementById("btnValiderRole");

const lobby = document.getElementById("lobby");
const adminList = document.getElementById("adminList");
const playerList = document.getElementById("playerList");

const questionContainer = document.getElementById("questionContainer");
const questionText = document.getElementById("questionText");
const questionImage = document.getElementById("questionImage");
const launchBtn = document.getElementById("launchQuestion");
const timerDisplay = document.getElementById("timer");

let currentQuestionIndex = 0;
let questionList = [];

// ----------------- ÉTAPE 1 : Pseudo -----------------
btnPseudo.onclick = () => {
  const pseudo = pseudoInput.value.trim();
  if (!pseudo) return alert("Entre un pseudo");

  get(ref(db, "players")).then(snapshot => {
    const players = snapshot.val() || {};
    for (let id in players) {
      if (players[id].pseudo === pseudo && players[id].online) {
        return alert("Ce pseudo est déjà utilisé !");
      }
    }

    playerData.pseudo = pseudo;
    stepPseudo.classList.add("hidden");
    stepRole.classList.remove("hidden");
  });
};

// ----------------- Sélection rôle -----------------
roleSelect.onchange = () => {
  if (roleSelect.value === "admin") {
    adminPassword.classList.remove("hidden");
  } else {
    adminPassword.classList.add("hidden");
  }
};

// ----------------- ÉTAPE 2 : Validation rôle -----------------
btnValiderRole.onclick = async () => {
  const role = roleSelect.value;
  const pwd = adminPassword.value;

  if (!role) return alert("Choisis un rôle");
  if (role === "admin" && pwd !== "tocard") return alert("Mot de passe incorrect");

  const playersSnapshot = await get(ref(db, "players"));
  const players = playersSnapshot.val() || {};

  // Vérifier qu'un seul admin est connecté
  if (role === "admin") {
    for (let id in players) {
      if (players[id].role === "admin" && players[id].online) {
        return alert("Un admin est déjà connecté !");
      }
    }
  }

  // Réutilisation si pseudo déconnecté
  let reusedId = null;
  for (let id in players) {
    if (players[id].pseudo === playerData.pseudo && !players[id].online) {
      reusedId = id;
      break;
    }
  }

  playerId = reusedId || push(ref(db, "players")).key;

  const playerRef = ref(db, `players/${playerId}`);
  const newData = {
    pseudo: playerData.pseudo,
    role: role,
    points: players[playerId]?.points || 0,
    online: true,
  };

  set(playerRef, newData);
  onDisconnect(playerRef).update({ online: false });

  if (role === "admin") {
    onDisconnect(ref(db)).remove(); // Réinitialise la DB si admin se déconnecte
  }

  playerData.role = role;
  stepRole.classList.add("hidden");
  lobby.classList.remove("hidden");

  listenPlayers();
  if (role === "admin") loadQuestions();
};

// ----------------- LOBBY : Affichage joueurs/admins -----------------
function listenPlayers() {
  onValue(ref(db, "players"), (snapshot) => {
    const players = snapshot.val() || {};
    adminList.innerHTML = "";
    playerList.innerHTML = "";

    for (const id in players) {
      const p = players[id];
      if (!p.online) continue;

      const el = document.createElement("div");
      const isAdmin = p.role === "admin";
      const icon = isAdmin ? "👑" : "🎮";
      const isSelf = id === playerId;
      el.textContent = `${icon} ${p.pseudo}${isSelf ? " (moi)" : ""}`;

      if (!isAdmin) {
        const pointDisplay = document.createElement("span");
        pointDisplay.textContent = ` - ${p.points} pts `;
        el.appendChild(pointDisplay);

        if (playerData.role === "admin") {
          const btnPlus = document.createElement("button");
          btnPlus.textContent = "+";
          btnPlus.onclick = () => update(ref(db, `players/${id}`), { points: p.points + 1 });
          el.appendChild(btnPlus);

          const btnMoins = document.createElement("button");
          btnMoins.textContent = "-";
          btnMoins.onclick = () => update(ref(db, `players/${id}`), { points: Math.max(0, p.points - 1) });
          el.appendChild(btnMoins);
        }
      }

      if (isAdmin) adminList.appendChild(el);
      else playerList.appendChild(el);
    }
  });
}

// ----------------- Charger les questions -----------------
function loadQuestions() {
  fetch("https://raw.githubusercontent.com/tonpapalechauve/roitoquizz/main/questions.json")
    .then(res => res.json())
    .then(data => {
      questionList = data;
    });
}

// ----------------- Lancer une question -----------------
launchBtn.onclick = () => {
  if (!questionList.length) return alert("Aucune question chargée");
  if (currentQuestionIndex >= questionList.length) {
    questionText.textContent = "Fin du quiz !";
    questionImage.src = "";
    timerDisplay.textContent = "";
    return;
  }

  const q = questionList[currentQuestionIndex];
  questionText.textContent = q.texte;
  questionImage.src = q.image;

  startTimer(30); // 30 sec
  currentQuestionIndex++;
};

// ----------------- Timer -----------------
function startTimer(seconds) {
  let remaining = seconds;
  timerDisplay.textContent = `${remaining}s`;
  const interval = setInterval(() => {
    remaining--;
    timerDisplay.textContent = `${remaining}s`;
    if (remaining <= 0) {
      clearInterval(interval);
      timerDisplay.textContent = "Temps écoulé !";
    }
  }, 1000);
}
