import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-app.js";
import {
  getDatabase, ref, set, onValue, push, onDisconnect,
  update, remove, get
} from "https://www.gstatic.com/firebasejs/9.6.0/firebase-database.js";

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

// DOM
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
const questionSection = document.getElementById("questionSection");
const questionText = document.getElementById("questionText");
const questionImage = document.getElementById("questionImage");
const startQuestionBtn = document.getElementById("startQuestionBtn");
const timerDisplay = document.getElementById("timer");
const answersDisplay = document.getElementById("answers");

const answerInput = document.getElementById("answerInput");
const btnAnswer = document.getElementById("btnAnswer");

btnPseudo.onclick = () => {
  const pseudo = pseudoInput.value.trim();
  if (!pseudo) return alert("Entre un pseudo");
  playerData.pseudo = pseudo;
  stepPseudo.classList.add("hidden");
  stepRole.classList.remove("hidden");
};

roleSelect.onchange = () => {
  if (roleSelect.value === "admin") {
    adminPassword.classList.remove("hidden");
  } else {
    adminPassword.classList.add("hidden");
    adminPassword.value = "";
  }
};

btnValiderRole.onclick = async () => {
  const role = roleSelect.value;
  if (!role) return alert("Choisis un rôle");

  if (role === "admin") {
    const pwd = adminPassword.value;
    if (pwd !== "tocard") return alert("Mot de passe admin incorrect");

    const snapshot = await get(ref(db, "players"));
    const players = snapshot.val();
    for (const id in players) {
      if (players[id].role === "admin" && players[id].online) {
        return alert("Un admin est déjà connecté.");
      }
    }
  }

  playerId = push(ref(db, "players")).key;

  const existingPlayers = (await get(ref(db, "players"))).val();
  for (const id in existingPlayers) {
    if (existingPlayers[id].pseudo === playerData.pseudo && !existingPlayers[id].online) {
      playerId = id;
      break;
    }
  }

  playerData.role = role;

  const playerRef = ref(db, `players/${playerId}`);
  set(playerRef, {
    pseudo: playerData.pseudo,
    role: playerData.role,
    online: true,
    points: existingPlayers?.[playerId]?.points || 0,
    reponse: ""
  });

  onDisconnect(playerRef).update({ online: false });

  stepRole.classList.add("hidden");
  lobby.classList.remove("hidden");

  setupLobby();
  if (role === "admin") setupAdminControls();
  else setupPlayerControls();
};

function setupLobby() {
  onValue(ref(db, "players"), (snapshot) => {
    const players = snapshot.val() || {};
    const isAdminOnline = Object.values(players).some(p => p.role === "admin" && p.online);

    if (!isAdminOnline && playerData.role !== "admin") {
      alert("La partie a été annulée, l'admin s'est déconnecté.");
      location.reload();
    }

    adminList.innerHTML = "";
    playerList.innerHTML = "";
    for (const id in players) {
      const p = players[id];
      if (!p || !p.pseudo) continue;

      const div = document.createElement("div");
      div.textContent = `${p.role === "admin" ? "👑" : "🎮"} ${p.pseudo} - ${p.points} pts` +
        (p.online === false ? " [hors ligne]" : "");
      if (id === playerId) div.style.fontWeight = "bold";

      if (p.role === "admin") adminList.appendChild(div);
      else playerList.appendChild(div);
    }

    if (playerData.role === "admin") {
      answersDisplay.innerHTML = "";
      for (const id in players) {
        const p = players[id];
        if (p.role === "joueur") {
          const row = document.createElement("div");
          row.textContent = `${p.pseudo} : ${p.reponse || "..."}`;
          const btn = document.createElement("button");
          btn.textContent = "+1";
          btn.onclick = () => {
            update(ref(db, `players/${id}`), {
              points: (p.points || 0) + 1
            });
          };
          row.appendChild(btn);
          answersDisplay.appendChild(row);
        }
      }
    }
  });
}

function setupAdminControls() {
  questionSection.classList.remove("hidden");
  startQuestionBtn.onclick = () => {
    fetch("https://raw.githubusercontent.com/TonPapaLeChauve/roitoquizz/questions.json")
      .then(res => res.json())
      .then(data => {
        const question = data[currentQuestionIndex];
        if (!question) return alert("Plus de questions.");
        set(ref(db, "question"), {
          enCours: true,
          question: question.text,
          image: question.image,
          startTime: Date.now()
        });

        setTimeout(() => {
          set(ref(db, "question/enCours"), false);
          currentQuestionIndex++;
        }, 30000);
      });
}

function setupPlayerControls() {
  onValue(ref(db, "question"), (snapshot) => {
    const q = snapshot.val();
    if (q?.enCours) {
      questionText.textContent = q.question;
      questionImage.src = q.image;
      questionSection.classList.remove("hidden");

      const interval = setInterval(() => {
        const now = Date.now();
        const diff = Math.max(0, 30 - Math.floor((now - q.startTime) / 1000));
        timerDisplay.textContent = `Temps restant : ${diff}s`;
        if (diff <= 0) {
          clearInterval(interval);
          questionSection.classList.add("hidden");
          answerInput.value = "";
        }
      }, 1000);
    } else {
      questionSection.classList.add("hidden");
    }
  });

  btnAnswer.onclick = () => {
    const answer = answerInput.value.trim();
    if (answer)
      update(ref(db, `players/${playerId}`), { reponse: answer });
  };
}
