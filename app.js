import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-app.js";
import {
  getDatabase, ref, set, push, onValue,
  onDisconnect, update, remove, get
} from "https://www.gstatic.com/firebasejs/9.6.0/firebase-database.js";

// Firebase config
const config = {
  apiKey: "AIzaSyAwi1VHv7jaaPPyanv90CCheM1mZ-xNr58",
  authDomain: "roidestocards-d0084.firebaseapp.com",
  databaseURL: "https://roidestocards-d0084-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "roidestocards-d0084",
  storageBucket: "roidestocards-d0084.firebaseapp.com",
  messagingSenderId: "120053524190",
  appId: "1:120053524190:web:c68520412faff06836044f"
};

const app = initializeApp(config);
const db = getDatabase(app);

let playerId = null;
let playerData = { pseudo: "", role: "" };
let currentQuestionIndex = 0;
let timerInterval = null;
const QUESTION_DURATION = 30;
let questions = [];

// Charger les questions
fetch("https://raw.githubusercontent.com/TonPapaLeChauve/roitoquizz/main/questions.json")
  .then(r => r.json()).then(data => questions = data);

// DOM
const e = id => document.getElementById(id);
const stepPseudo = e("stepPseudo"), pseudoInput = e("pseudoInput"), btnPseudo = e("btnPseudo");
const stepRole = e("stepRole"), roleSelect = e("roleSelect"), adminPassword = e("adminPassword"), btnValiderRole = e("btnValiderRole");
const lobby = e("lobby"), adminList = e("adminList"), playerList = e("playerList");
const adminControls = e("adminControls"), btnNextQuestion = e("btnNextQuestion");
const questionZone = e("questionZone"), questionText = e("questionText"), questionImage = e("questionImage"), timeLeft = e("timeLeft");
const playerAnswerZone = e("playerAnswerZone"), answerInput = e("answerInput"), btnAnswer = e("btnAnswer");
const adminAnswers = e("adminAnswers");
const correctAnswerZone = e("correctAnswer"), correctText = e("correctText");

// Pseudo
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
};

// LOBBY
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

      // Ne pas permettre de modifier les points de l'admin
      if (playerData.role === "admin" && p.role === "player") {
        const plus = document.createElement("button");
        plus.textContent = "+";
        plus.style.fontSize = "0.6em";
        plus.onclick = () => update(ref(db, `players/${id}`), { points: p.points + 1 });

        const minus = document.createElement("button");
        minus.textContent = "-";
        minus.style.fontSize = "0.6em";
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

    if (!adminOnline && playerData.role === "player") {
      alert("L'administrateur s'est déconnecté. Partie annulée.");
      remove(ref(db, "players")).then(() => location.reload());
    }
  });
}

// QUESTIONS
btnNextQuestion.onclick = () => {
  if (currentQuestionIndex >= questions.length) return alert("Fin des questions");

  const q = questions[currentQuestionIndex++];
  const now = Date.now();

  // Nettoyer les réponses précédentes
  get(ref(db, "players")).then(snap => {
    const players = snap.val() || {};
    for (const id in players) {
      update(ref(db, `players/${id}`), { answer: "" });
    }
  });

  set(ref(db, "currentQuestion"), {
    text: q.question,
    image: q.image,
    reponse: q.reponse,
    start: now
  });

  clearTimeout(timerInterval);
  lookupEnd(now + QUESTION_DURATION * 1000);
};

function endQuestion() {
  set(ref(db, "currentQuestion"), null);
}

function lookupEnd(when) {
  const delay = when - Date.now();
  timerInterval = setTimeout(endQuestion, delay);
}

// ECOUTE DE QUESTION
function listenQuestion() {
  onValue(ref(db, "currentQuestion"), snap => {
    const q = snap.val();
    if (!q) {
      questionZone.classList.add("hidden");
      playerAnswerZone.classList.add("hidden");
      adminAnswers.classList.add("hidden");
      correctAnswerZone.classList.remove("hidden");

      // Affiche réponse joueur
      if (playerData.role === "player") {
        get(ref(db, `players/${playerId}`)).then(snap => {
          const p = snap.val();
          if (p && p.answer) answerInput.value = p.answer;
        });
      }

      return;
    }

    questionZone.classList.remove("hidden");
    playerAnswerZone.classList.toggle("hidden", playerData.role !== "player");
    adminAnswers.classList.toggle("hidden", playerData.role !== "admin");
    correctAnswerZone.classList.add("hidden");

    questionText.textContent = q.text;
    questionImage.src = q.image;

    const end = q.start + QUESTION_DURATION * 1000;
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      const remain = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      timeLeft.textContent = remain;
      if (remain <= 0) {
        clearInterval(timerInterval);
        correctText.textContent = q.reponse || "(non fournie)";
        correctAnswerZone.classList.remove("hidden");
      }
    }, 250);

    if (playerData.role === "admin") loadAdminAnswers();
  });
}

// REPONSE JOUEUR
btnAnswer.onclick = () => {
  const ans = answerInput.value.trim();
  if (ans)
    update(ref(db, `players/${playerId}`), { answer: ans });
};

// ADMIN VOIT LES RÉPONSES
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
      btnVal.onclick = () => update(ref(db, `players/${id}`), { points: p.points + 1 });
      row.appendChild(btnVal);
      adminAnswers.appendChild(row);
    });
  });
}
