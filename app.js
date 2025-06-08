import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-app.js";
import {
  getDatabase, ref, set, push, onValue,
  onDisconnect, update, remove, get
} from "https://www.gstatic.com/firebasejs/9.6.0/firebase-database.js";

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
let questionsLoaded = false;

// URL vers ton JSON sur GitHub
fetch("https://raw.githubusercontent.com/TonPapaLeChauve/roitoquizz/main/questions.json")
  .then(r => r.json())
  .then(data => {
    questions = data;
    questionsLoaded = true;
  });

// ----- DOM ↯
const e = id => document.getElementById(id);
const stepPseudo = e("stepPseudo"), pseudoInput = e("pseudoInput"), btnPseudo = e("btnPseudo");
const stepRole = e("stepRole"), roleSelect = e("roleSelect"), adminPassword = e("adminPassword"), btnValiderRole = e("btnValiderRole");
const lobby = e("lobby"), adminList = e("adminList"), playerList = e("playerList");
const adminControls = e("adminControls"), btnNextQuestion = e("btnNextQuestion");
const questionZone = e("questionZone"), questionText = e("questionText"), questionImage = e("questionImage"), timeLeft = e("timeLeft");
const playerAnswerZone = e("playerAnswerZone"), answerInput = e("answerInput"), btnAnswer = e("btnAnswer");
const adminAnswers = e("adminAnswers"), finalAnswers = e("finalAnswers");

// ---- Étapes de connexion ----

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

// ---- Lobby et points --------

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

      const nameSpan = document.createElement("span");
      nameSpan.textContent = p.pseudo;
      row.appendChild(nameSpan);

      if (p.role === "player") {
        const pointsSpan = document.createElement("span");
        pointsSpan.className = "points";
        pointsSpan.textContent = p.points || 0;
        row.appendChild(pointsSpan);
        playerList.appendChild(row);
      } else if (p.role === "admin") {
        adminOnline = true;

        // Ajout des boutons + et -
        const plus = document.createElement("button");
        plus.textContent = "+";
        plus.classList.add("admin-point-btn");
        plus.onclick = () => updatePoints(id, 1);

        const minus = document.createElement("button");
        minus.textContent = "-";
        minus.classList.add("admin-point-btn");
        minus.onclick = () => updatePoints(id, -1);

        row.appendChild(plus);
        row.appendChild(minus);

        const pointsSpan = document.createElement("span");
        pointsSpan.className = "points";
        pointsSpan.textContent = p.points || 0;
        row.appendChild(pointsSpan);

        adminList.appendChild(row);
      }
    }
  });
}

async function updatePoints(id, delta) {
  const pRef = ref(db, `players/${id}`);
  const snap = await get(pRef);
  const p = snap.val();
  if (!p) return;
  const newPoints = (p.points || 0) + delta;
  await update(pRef, { points: newPoints });
}

// ---- Question & Réponses ----

function listenQuestion() {
  onValue(ref(db, "currentQuestion"), snap => {
    const q = snap.val();

    if (!q) {
      questionZone.classList.add("hidden");
      playerAnswerZone.classList.add("hidden");
      adminControls.classList.remove("hidden");
      finalAnswers.classList.add("hidden");
      return;
    }

    if (q.finished) {
      // Question terminée
      questionZone.classList.add("hidden");
      playerAnswerZone.classList.add("hidden");
      adminControls.classList.remove("hidden");

      finalAnswers.classList.remove("hidden");
      loadFinalAnswers();

      return;
    }

    // Question active
    finalAnswers.classList.add("hidden");
    questionZone.classList.remove("hidden");
    questionText.textContent = q.text;
    questionImage.src = q.image;
    adminControls.classList.add("hidden");

    const endTime = q.start + QUESTION_DURATION * 1000;
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      const remain = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      timeLeft.textContent = remain;
      if (remain <= 0) clearInterval(timerInterval);
    }, 250);

    if (playerData.role === "player") {
      playerAnswerZone.classList.remove("hidden");
    } else {
      playerAnswerZone.classList.add("hidden");
    }
  });
}

btnAnswer.onclick = () => {
  const answer = answerInput.value.trim();
  if (!answer) return alert("Écris ta réponse !");
  update(ref(db, `players/${playerId}`), { answer });
  answerInput.value = "";
};

// ---- Fin de la question ----

function endQuestion() {
  update(ref(db, "currentQuestion"), { finished: true });
  loadFinalAnswers();

  questionZone.classList.add("hidden");
  playerAnswerZone.classList.add("hidden");
  adminControls.classList.remove("hidden");
}

btnNextQuestion.onclick = async () => {
  if (!questionsLoaded) return alert("Chargement des questions en cours...");
  if (currentQuestionIndex >= questions.length) return alert("Fin des questions");

  // Reset des réponses avant prochaine question
  const snap = await get(ref(db, "players"));
  const players = snap.val() || {};
  for (const id in players) {
    if (players[id].role === "player") {
      await update(ref(db, `players/${id}`), { answer: "" });
    }
  }

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
  finalAnswers.classList.add("hidden");
};

// Fonction pour checker fin du chrono
function lookupEnd(msEnd) {
  const delay = msEnd - Date.now();
  if (delay <= 0) {
    endQuestion();
  } else {
    setTimeout(() => {
      endQuestion();
    }, delay);
  }
}

// ---- Affichage des réponses ----

async function loadFinalAnswers() {
  finalAnswers.innerHTML = "<h3>Réponses des joueurs :</h3>";
  const snap = await get(ref(db, "players"));
  const players = snap.val() || {};
  for (const id in players) {
    if (players[id].role === "player" && players[id].online) {
      const ans = players[id].answer || "(pas de réponse)";
      const div = document.createElement("div");
      div.textContent = `${players[id].pseudo} : ${ans}`;
      finalAnswers.appendChild(div);
    }
  }
}

