import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-app.js";
import {
  getDatabase, ref, set, push, onValue,
  onDisconnect, update, remove, get
} from "https://www.gstatic.com/firebasejs/9.6.0/firebase-database.js";

// Config Firebase
const config = {
  apiKey: "AIzaSyAwi1VHv7jaaPPyanv90CCheM1mZ-xNr58",
  authDomain: "roidestocards-d0084.firebaseapp.com",
  databaseURL: "https://roidestocards-d0084-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "roidestocards-d0084",
  storageBucket: "roidestocards-d0084.firebasestorage.app",
  messagingSenderId: "120053524190",
  appId: "1:120053524190:web:c68520412faff06836044f",
  measurementId: "G-YVH6BWKZGZ"
};
const app = initializeApp(config);
const db = getDatabase(app);

let playerId = null;
let playerData = { pseudo: "", role: "" };
let currentQuestionIndex = 0;
let timerInterval = null;
const QUESTION_DURATION = 30;
let questions = [];

// Chargement des questions depuis GitHub
fetch("https://raw.githubusercontent.com/TonPapaLeChauve/roitoquizz/main/questions.json")
  .then(r => r.json()).then(data => questions = data);

// ----- DOM helper
const e = id => document.getElementById(id);
const stepPseudo = e("stepPseudo"), pseudoInput = e("pseudoInput"), btnPseudo = e("btnPseudo");
const stepRole = e("stepRole"), roleSelect = e("roleSelect"), adminPassword = e("adminPassword"), btnValiderRole = e("btnValiderRole");
const lobby = e("lobby"), adminList = e("adminList"), playerList = e("playerList");
const adminControls = e("adminControls"), btnNextQuestion = e("btnNextQuestion");
const questionZone = e("questionZone"), questionText = e("questionText"), questionImage = e("questionImage"), timeLeft = e("timeLeft");
const playerAnswerZone = e("playerAnswerZone"), answerInput = e("answerInput"), btnAnswer = e("btnAnswer");
const adminAnswers = e("adminAnswers"), finalAnswers = e("finalAnswers");

// Étapes de connexion

btnPseudo.onclick = () => {
  const pseudo = pseudoInput.value.trim();
  if (!pseudo) return alert("Entre un pseudo");
  playerData.pseudo = pseudo;
  stepPseudo.classList.add("hidden");
  stepRole.classList.remove("hidden");
};

roleSelect.onchange = () => {
  adminPassword.classList.toggle("hidden", roleSelect.value !== "admin");
};

btnValiderRole.onclick = async () => {
  const role = roleSelect.value;
  const pwd = adminPassword.value;
  if (!role) return alert("Choisis un rôle");

  const snap = await get(ref(db, "players"));
  const players = snap.val() || {};

  if (role === "admin") {
    if (Object.values(players).some(p => p.role === "admin" && p.online)) return alert("Un admin est déjà connecté");
    if (pwd !== "tocard") return alert("Mot de passe incorrect");
  }

  // réutilisation d'un pseudo offline
  for (const id in players) {
    if (players[id].pseudo === playerData.pseudo && !players[id].online) {
      playerId = id;
      break;
    }
  }
  if (!playerId) playerId = push(ref(db, "players")).key;

  playerData.role = role;
  const pRef = ref(db, `players/${playerId}`);
  set(pRef, {
    pseudo: playerData.pseudo,
    role,
    online: true,
    points: players[playerId]?.points || 0,
    answer: ""
  });
  onDisconnect(pRef).update({ online: false });

  stepRole.classList.add("hidden");
  lobby.classList.remove("hidden");
  adminControls.classList.toggle("hidden", role !== "admin");

  listenLobby();
  if (role === "player") listenQuestion();
  if (role === "admin") listenQuestion();
};

// Lobby & points

function listenLobby() {
  onValue(ref(db, "players"), snap => {
    const players = snap.val() || {};
    adminList.innerHTML = "";
    playerList.innerHTML = "";

    let adminOnline = false;

    for (const id in players) {
      const p = players[id];
      if (!p.online) continue;

      const row = document.createElement("div");
      row.className = "row";
      const emoji = p.role === "admin" ? "👑" : "🎮";
      row.innerHTML = `${emoji} <strong>${p.pseudo}</strong>`;
      if (p.role === "player") {
        row.innerHTML += ` - <span class="points">${p.points} pts</span>`;
      }

      if (playerData.role === "admin" && p.role === "player") {
        const plus = document.createElement("button");
        plus.textContent = "+";
        plus.className = "small-btn";
        plus.onclick = () => update(ref(db, `players/${id}`), { points: p.points + 1 });
        const minus = document.createElement("button");
        minus.textContent = "-";
        minus.className = "small-btn";
        minus.onclick = () => update(ref(db, `players/${id}`), { points: Math.max(0, p.points - 1) });
        row.append(plus, minus);
      }

      if (p.role === "admin") {
        adminList.appendChild(row);
        adminOnline = true;
      } else {
        playerList.appendChild(row);
      }
    }

    if (!adminOnline) {
      alert("L'administrateur s'est déconnecté. Partie annulée.");
      remove(ref(db, "players")).then(() => location.reload());
    }
  });
}

// Questions + chrono

btnNextQuestion.onclick = () => {
  if (currentQuestionIndex >= questions.length) return alert("Fin des questions");

  const q = questions[currentQuestionIndex++];
  const now = Date.now();

  set(ref(db, "currentQuestion"), {
    text: q.question,
    image: q.image,
    start: now,
    finished: false
  });

  clearTimeout(timerInterval);
  lookupEnd(now + QUESTION_DURATION * 1000);

  // Supprimer les réponses des joueurs
  get(ref(db, "players")).then(snap => {
    const pls = snap.val() || {};
    for (const id in pls) {
      if (pls[id].role === "player") {
        update(ref(db, `players/${id}`), { answer: "" });
      }
    }
  });

  finalAnswers.classList.add("hidden");
};

function endQuestion() {
  set(ref(db, "currentQuestion/finished"), true);
}

function lookupEnd(when) {
  const delay = when - Date.now();
  timerInterval = setTimeout(endQuestion, delay);
}

// Affichage question côté joueur/admin
function listenQuestion() {
  onValue(ref(db, "currentQuestion"), snap => {
    const q = snap.val();

    if (!q) {
      questionZone.classList.add("hidden");
      playerAnswerZone.classList.add("hidden");
      adminAnswers.classList.add("hidden");
      finalAnswers.classList.add("hidden");
      return;
    }

    if (q.finished) {
      // Fin de question : afficher réponses finales, masquer saisie
      questionZone.classList.add("hidden");
      playerAnswerZone.classList.add("hidden");
      adminAnswers.classList.add("hidden");
      adminControls.classList.toggle("hidden", playerData.role !== "admin");

      finalAnswers.classList.remove("hidden");
      loadFinalAnswers();
      return;
    }

    // Question en cours
    questionZone.classList.remove("hidden");
    questionText.textContent = q.text;
    questionImage.src = q.image;

    finalAnswers.classList.add("hidden");

    // Chrono
    const end = q.start + QUESTION_DURATION * 1000;
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      const remain = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      timeLeft.textContent = remain;
      if (remain <= 0) clearInterval(timerInterval);
    }, 250);

    playerAnswerZone.classList.toggle("hidden", playerData.role !== "player");
    adminAnswers.classList.toggle("hidden", playerData.role !== "admin");
    adminControls.classList.toggle("hidden", playerData.role !== "admin");

    if (playerData.role === "admin") loadAdminAnswers();
  });
}

// Joueur envoie sa réponse
btnAnswer.onclick = () => {
  const ans = answerInput.value.trim();
  if (ans)
    update(ref(db, `players/${playerId}`), { answer: ans });
};

// Admin lit les réponses en direct
function loadAdminAnswers() {
  onValue(ref(db, "players"), snap => {
    const pls = snap.val() || {};
    adminAnswers.innerHTML = "";
    Object.entries(pls).forEach(([id, p]) => {
      if (p.role !== "player") return;
      const row = document.createElement("div");
      row.className = "row";
      row.innerHTML = `<strong>${p.pseudo} :</strong> ${p.answer || ""}`;
      const btnVal = document.createElement("button");
      btnVal.textContent = "+1";
      btnVal.className = "small-btn";
      btnVal.onclick = () => update(ref(db, `players/${id}`), { points: p.points + 1 });
      row.appendChild(btnVal);
      adminAnswers.appendChild(row);
    });
  });
}

// Afficher réponses finales à tous
function loadFinalAnswers() {
  get(ref(db, "players")).then(snap => {
    const pls = snap.val() || {};
    finalAnswers.innerHTML = "";
    Object.values(pls).forEach(p => {
      if (p.role !== "player") return;
      const div = document.createElement("div");
      div.innerHTML = `<strong>${p.pseudo} :</strong> ${p.answer || "(pas de réponse)"}`;
      finalAnswers.appendChild(div);
    });
  });
}
