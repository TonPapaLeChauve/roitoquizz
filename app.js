import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-app.js";
import {
  getDatabase, ref, set, onValue, push, onDisconnect,
  remove, get, update
} from "https://www.gstatic.com/firebasejs/9.6.0/firebase-database.js";

// Config Firebase
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

const QUESTIONS_URL = "https://raw.githubusercontent.com/TonPapaLeChauve/roitoquizz/main/questions.json";

let playerId = null;
let playerData = { pseudo: null, role: null };
let questions = [];
let currentQuestionIndex = 0;
let timerInterval = null;
let chronoRunning = false;

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

const adminAnswers = document.getElementById("adminAnswers");
const answersList = document.getElementById("answersList");

const questionContainer = document.getElementById("questionContainer");
const questionText = document.getElementById("questionText");
const questionImage = document.getElementById("questionImage");
const timerDisplay = document.getElementById("timer");

const playerAnswerContainer = document.getElementById("playerAnswerContainer");
const playerAnswerInput = document.getElementById("playerAnswerInput");
const btnSendAnswer = document.getElementById("btnSendAnswer");


// Étape 1 : choisir pseudo
btnPseudo.onclick = () => {
  const pseudo = pseudoInput.value.trim();
  if (!pseudo) return alert("Entre un pseudo");

  get(ref(db, "players")).then(ss => {
    const players = ss.val() || {};
    const onlinePseudoExists = Object.values(players).some(p => p.pseudo === pseudo && p.online);
    if (onlinePseudoExists) return alert("Ce pseudo est déjà utilisé");

    playerData.pseudo = pseudo;
    stepPseudo.classList.add("hidden");
    stepRole.classList.remove("hidden");
  });
};

// Afficher masque mdp admin
roleSelect.onchange = () => {
  adminPassword.classList.toggle("hidden", roleSelect.value !== "admin");
};

// Étape 2 : valider rôle
btnValiderRole.onclick = async () => {
  const role = roleSelect.value;
  const pwd = adminPassword.value;

  if (!role) return alert("Choisis un rôle");
  if (role === "admin" && pwd !== "tocard") return alert("Mot de passe incorrect");

  const ss = await get(ref(db, "players"));
  const players = ss.val() || {};

  if (role === "admin") {
    const adminOnline = Object.values(players).some(p => p.role === "admin" && p.online);
    if (adminOnline) return alert("Un admin est déjà connecté");
  }

  let reuseId = null;
  for (const id in players) {
    if (players[id].pseudo === playerData.pseudo && !players[id].online) {
      reuseId = id;
      break;
    }
  }

  playerId = reuseId || push(ref(db, "players")).key;
  const playerRef = ref(db, `players/${playerId}`);
  const newPlayerData = {
    pseudo: playerData.pseudo,
    role,
    points: players[playerId]?.points || 0,
    online: true,
    answer: ""
  };

  await set(playerRef, newPlayerData);
  onDisconnect(playerRef).update({ online: false });

  if (role === "admin") {
    onDisconnect(ref(db, "/")).remove();
    loadQuestions();
  }

  playerData.role = role;
  stepRole.classList.add("hidden");
  lobby.classList.remove("hidden");
  adminControls.classList.toggle("hidden", role !== "admin");
  adminAnswers.classList.toggle("hidden", role !== "admin");
  playerAnswerContainer.classList.toggle("hidden", role !== "player");

  listenPlayers();
  listenAnswers();
};

// Surveiller joueurs + afficher + gérer déconnexion admin
function listenPlayers() {
  onValue(ref(db, "players"), ss => {
    const players = ss.val() || {};
    adminList.innerHTML = "";
    playerList.innerHTML = "";

    let adminStillOnline = false;

    Object.entries(players).forEach(([id, p]) => {
      if (!p.online) return;
      const isAdmin = p.role === "admin";
      if (isAdmin) adminStillOnline = true;

      const el = document.createElement("div");
      const icon = isAdmin ? "👑" : "🎮";

      // Affiche points à tout le monde
      el.innerHTML = `${icon} <b>${p.pseudo}</b> - ${p.points} pts`;

      // Après la fin d’une question, affiche la réponse dans le lobby
      if (!chronoRunning && p.answer) {
        el.innerHTML += ` — Réponse : <i>${escapeHtml(p.answer)}</i>`;
      }

      // Si admin, affiche boutons +/-
      if (!isAdmin && playerData.role === "admin") {
        const btnPlus = document.createElement("button");
        btnPlus.textContent = "+";
        btnPlus.onclick = () => update(ref(db, `players/${id}`), { points: p.points + 1 });
        el.appendChild(btnPlus);

        const btnMoins = document.createElement("button");
        btnMoins.textContent = "-";
        btnMoins.onclick = () => update(ref(db, `players/${id}`), { points: Math.max(0, p.points - 1) });
        el.appendChild(btnMoins);
      }

      if (isAdmin) adminList.appendChild(el);
      else playerList.appendChild(el);
    });

    if (!adminStillOnline) {
      alert("L'administrateur s'est déconnecté, la partie est annulée.");
      remove(ref(db, "/"));
      location.reload();
    }
  });
}

// Charger questions depuis GitHub
async function loadQuestions() {
  const resp = await fetch(QUESTIONS_URL);
  questions = await resp.json();
  console.log("Questions chargées :", questions);
}

// Admin lance question
const btnLaunch = document.getElementById("launchQuestion");
btnLaunch.onclick = () => {
  if (!questions.length) return alert("Aucune question trouvée");

  if (currentQuestionIndex >= questions.length) {
    questionText.textContent = "Fin des questions";
    questionImage.src = "#";
    timerDisplay.textContent = "";
    questionContainer.classList.remove("hidden");
    return;
  }

  const q = questions[currentQuestionIndex++];
  const now = Date.now();

  chronoRunning = true;

  set(ref(db, "currentQuestion"), {
    text: q.question,
    image: q.image,
    start: now,
    duration: q.duration || 30
  });

  // Réinitialiser réponses joueurs pour nouvelle question
  get(ref(db, "players")).then(ss => {
    const players = ss.val() || {};
    Object.entries(players).forEach(([id, p]) => {
      update(ref(db, `players/${id}`), { answer: "" });
    });
  });
};

// Écoute question + chrono
onValue(ref(db, "currentQuestion"), ss => {
  const g = ss.val();
  if (!g) {
    questionContainer.classList.add("hidden");
    lobby.classList.remove("hidden");
    chronoRunning = false;
    return;
  }

  questionContainer.classList.remove("hidden");
  lobby.classList.add("hidden");

  questionText.textContent = g.text;
  questionImage.src = g.image;
  startTimer(g.start, g.duration);

  if (playerData.role === "player") {
    playerAnswerContainer.classList.remove("hidden");
  }
});

// Envoi réponse joueur
btnSendAnswer.onclick = () => {
  const ans = playerAnswerInput.value.trim();
  if (!ans) return;

  update(ref(db, `players/${playerId}`), { answer: ans });
};

// Écoute réponses pour admin (en temps réel)
function listenAnswers() {
  if (playerData.role !== "admin") {
    adminAnswers.classList.add("hidden");
    return;
  }
  adminAnswers.classList.remove("hidden");

  onValue(ref(db, "players"), ss => {
    const players = ss.val() || {};
    answersList.innerHTML = "";
    Object.entries(players).forEach(([id, p]) => {
      if (!p.online || p.role === "admin") return;
      const div = document.createElement("div");
      div.style.marginBottom = "6px";
      div.innerHTML = `<b>${p.pseudo} :</b> ${escapeHtml(p.answer || "<i>(pas de réponse)</i>")}`;

      // Bouton valider
      const btnValide = document.createElement("button");
      btnValide.textContent = "Valider";
      btnValide.style.marginLeft = "10px";
      btnValide.onclick = () => {
        update(ref(db, `players/${id}`), { points:
