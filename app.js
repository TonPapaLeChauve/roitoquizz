import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-app.js";
import {
  getDatabase, ref, set, onValue, push, onDisconnect,
  update, remove, get, child
} from "https://www.gstatic.com/firebasejs/9.6.0/firebase-database.js";

// 🔧 CONFIG FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyAwi1VHv7jaaPPyanv90CCheM1mZ-xNr58",
  authDomain: "roidestocards-d0084.firebaseapp.com",
  databaseURL: "https://roidestocards-d0084-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "roidestocards-d0084",
  storageBucket: "roidestocards-d0084.appspot.com",
  messagingSenderId: "120053524190",
  appId: "1:120053524190:web:c68520412faff06836044f"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// 🔗 REMPLACE par ton propre lien GitHub brut
const QUESTIONS_URL = "https://raw.githubusercontent.com/tonpseudo/tonrepo/main/questions.json";

let playerId = null;
let playerData = { pseudo: null, role: null };
let isAdmin = false;
let currentQuestionIndex = 0;
let timerInterval = null;

// HTML Elements
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
const adminControls = document.getElementById("adminControls");

const questionText = document.getElementById("questionText");
const questionImage = document.getElementById("questionImage");
const timerDisplay = document.getElementById("timerDisplay");
const btnNextQuestion = document.getElementById("btnNextQuestion");

// → Étape 1 : Entrer pseudo
btnPseudo.onclick = () => {
  const pseudo = pseudoInput.value.trim();
  if (!pseudo) return alert("Entre un pseudo");
  playerData.pseudo = pseudo;
  stepPseudo.classList.add("hidden");
  stepRole.classList.remove("hidden");
};

// → Afficher champ mdp si admin sélectionné
roleSelect.addEventListener("change", () => {
  if (roleSelect.value === "admin") {
    adminPassword.classList.remove("hidden");
  } else {
    adminPassword.classList.add("hidden");
    adminPassword.value = "";
  }
});

// → Valider le rôle
btnValiderRole.onclick = async () => {
  const role = roleSelect.value;
  const pwd = adminPassword.value;

  if (!role) return alert("Choisis un rôle");
  if (role === "admin" && pwd !== "tocard") return alert("Mot de passe admin incorrect");

  const playersRef = ref(database, "players");
  const snapshot = await get(playersRef);
  const players = snapshot.val() || {};

  // ✅ Un seul admin
  if (role === "admin") {
    const existingAdmin = Object.values(players).find(p => p.role === "admin" && p.online);
    if (existingAdmin) return alert("Un admin est déjà connecté");
    isAdmin = true;
  }

  // 🔁 Vérifie si pseudo déjà utilisé
  for (let id in players) {
    if (players[id].pseudo === playerData.pseudo) {
      if (players[id].online) return alert("Ce pseudo est déjà utilisé");
      playerId = id;
      break;
    }
  }

  if (!playerId) playerId = push(playersRef).key;
  const playerRef = ref(database, `players/${playerId}`);
  const playerObject = {
    pseudo: playerData.pseudo,
    role,
    online: true,
    points: players[playerId]?.points || 0
  };

  await set(playerRef, playerObject);
  onDisconnect(playerRef).update({ online: false });

  playerData.role = role;
  stepRole.classList.add("hidden");
  lobby.classList.remove("hidden");

  if (isAdmin) adminControls.classList.remove("hidden");

  startLobbyListener();
  startQuestionListener();
};

// → Suivi des joueurs
function startLobbyListener() {
  const playersRef = ref(database, "players");

  onValue(playersRef, (snapshot) => {
    const players = snapshot.val() || {};
    adminList.innerHTML = "";
    playerList.innerHTML = "";

    let adminStillConnected = false;

    for (const id in players) {
      const p = players[id];
      const container = document.createElement("div");
      container.textContent = `🎮 ${p.pseudo} (${p.points} pts)` + (p.online ? "" : " [hors ligne]");
      if (id === playerId) container.style.fontWeight = "bold";

      if (p.role === "admin") {
        adminStillConnected = adminStillConnected || p.online;
        adminList.appendChild(container);
      } else {
        playerList.appendChild(container);
      }

      // admin : boutons +/- pour chaque joueur
      if (isAdmin && p.role === "player") {
        const btnPlus = document.createElement("button");
        const btnMoins = document.createElement("button");
        btnPlus.textContent = "+";
        btnMoins.textContent = "-";

        btnPlus.onclick = () => update(ref(database, `players/${id}`), { points: p.points + 1 });
        btnMoins.onclick = () => update(ref(database, `players/${id}`), { points: Math.max(0, p.points - 1) });

        container.appendChild(btnPlus);
        container.appendChild(btnMoins);
      }
    }

    // ❌ Si admin déco → reset
    if (isAdmin && !adminStillConnected) {
      alert("L'administrateur s'est déconnecté. Partie annulée.");
      remove(ref(database, "/"));
      location.reload();
    }
  });
}

// → Suivi des questions
function startQuestionListener() {
  const qRef = ref(database, "currentQuestion");
  onValue(qRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) return;

    questionText.textContent = data.text || "";
    questionImage.src = data.image || "";
    startTimer(data.timer || 30);
  });
}

// ⏱ Chronomètre partagé
function startTimer(seconds) {
  clearInterval(timerInterval);
  timerDisplay.textContent = `${seconds}s`;

  timerInterval = setInterval(() => {
    seconds--;
    timerDisplay.textContent = `${seconds}s`;
    if (seconds <= 0) clearInterval(timerInterval);
  }, 1000);
}

// 📥 Charger fichier JSON questions
async function loadQuestions() {
  const response = await fetch(QUESTIONS_URL);
  return response.json();
}

// 👉 ADMIN : Question suivante
btnNextQuestion.onclick = async () => {
  if (!questions.length) questions = await loadQuestions();

  if (currentQuestionIndex >= questions.length) {
    alert("Fin des questions !");
    return;
  }

  const q = questions[currentQuestionIndex];
  currentQuestionIndex++;

  set(ref(database, "currentQuestion"), {
    text: q.text,
    image: q.image,
    timer: q.timer || 30
  });
};
