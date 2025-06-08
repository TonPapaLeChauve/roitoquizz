import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-app.js";
import { getDatabase, ref, set, onValue, push, onDisconnect, update, remove, get } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-database.js";

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
const db = getDatabase(app);

let playerId = null;
let playerData = { pseudo: null, role: null };
let currentQuestionIndex = 0;
let questionTimer = null;
const QUESTION_DURATION = 30;

// DOM Elements
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
const btnNextQuestion = document.getElementById("btnNextQuestion");
const questionZone = document.getElementById("questionZone");
const questionText = document.getElementById("questionText");
const questionImage = document.getElementById("questionImage");
const timeLeft = document.getElementById("timeLeft");

let questions = [];
fetch("https://raw.githubusercontent.com/TonPapaLeChauve/roitoquizz/main/questions.json")
  .then(res => res.json())
  .then(data => questions = data)
  .catch(err => console.error("Erreur chargement questions :", err));

btnPseudo.onclick = () => {
  const pseudo = pseudoInput.value.trim();
  if (!pseudo) return alert("Entre un pseudo");
  playerData.pseudo = pseudo;
  stepPseudo.classList.add("hidden");
  stepRole.classList.remove("hidden");
};

roleSelect.addEventListener("change", () => {
  adminPassword.classList.toggle("hidden", roleSelect.value !== "admin");
});

btnValiderRole.onclick = async () => {
  const role = roleSelect.value;
  const pwd = adminPassword.value;

  if (!role) return alert("Choisis un rôle");

  const snapshot = await get(ref(db, "players"));
  const players = snapshot.val();

  if (role === "admin") {
    const adminExist = players && Object.values(players).some(p => p.role === "admin" && p.online);
    if (adminExist) return alert("Un admin est déjà connecté.");
    if (pwd !== "tocard") return alert("Mot de passe incorrect");
  }

  for (const id in players) {
    if (players[id].pseudo === playerData.pseudo) {
      playerId = id;
      break;
    }
  }

  if (!playerId) playerId = push(ref(db, "players")).key;

  playerData.role = role;
  const playerRef = ref(db, `players/${playerId}`);
  const playerObject = {
    pseudo: playerData.pseudo,
    role: role,
    online: true,
    points: players?.[playerId]?.points || 0
  };

  set(playerRef, playerObject);
  onDisconnect(playerRef).update({ online: false });

  stepRole.classList.add("hidden");
  lobby.classList.remove("hidden");

  if (role === "admin") adminControls.classList.remove("hidden");

  startLobbyListener();
};

function startLobbyListener() {
  onValue(ref(db, "players"), (snapshot) => {
    const players = snapshot.val() || {};
    adminList.innerHTML = "";
    playerList.innerHTML = "";

    let adminStillOnline = false;

    for (const id in players) {
      const p = players[id];
      if (!p) continue;

      const el = document.createElement("div");
      el.className = p.role;
      const emoji = p.role === "admin" ? "👑" : "🎮";
      let html = `<span class="emoji">${emoji}</span><strong>${p.pseudo}</strong>`;

      if (p.role === "player") html += ` <span class="points">${p.points ?? 0} pts</span>`;
      if (p.online === false) html += " [hors ligne]";
      el.innerHTML = html;

      if (p.role === "admin") {
        adminList.appendChild(el);
        if (p.online) adminStillOnline = true;
      } else {
        playerList.appendChild(el);
      }
    }

    if (playerData.role !== "admin" && !adminStillOnline) {
      alert("L'admin s'est déconnecté. Partie annulée.");
      remove(ref(db, "players")).then(() => location.reload());
    }
  });
}

btnNextQuestion.onclick = () => {
  if (currentQuestionIndex >= questions.length) {
    alert("Toutes les questions ont été posées.");
    return;
  }

  const q = questions[currentQuestionIndex];
  questionText.textContent = q.question;
  questionImage.src = q.image;
  questionZone.classList.remove("hidden");

  let remaining = QUESTION_DURATION;
  timeLeft.textContent = remaining;
  clearInterval(questionTimer);

  questionTimer = setInterval(() => {
    remaining--;
    timeLeft.textContent = remaining;
    if (remaining <= 0) {
      clearInterval(questionTimer);
      questionZone.classList.add("hidden");
      currentQuestionIndex++;
    }
  }, 1000);
};
