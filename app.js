import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-app.js";
import {
  getDatabase, ref, set, push, onValue, onDisconnect,
  update, remove, get
} from "https://www.gstatic.com/firebasejs/9.6.0/firebase-database.js";

const config = {
  apiKey: "...", authDomain: "...", databaseURL: "...",
  projectId: "...", storageBucket: "...", messagingSenderId: "...", appId: "..."
};
const app = initializeApp(config);
const db = getDatabase(app);

let playerId, playerData = {};
let currentQuestionIndex = 0, questionTimer;

const QUESTION_DURATION = 30;
const QUESTIONS_URL = "https://raw.githubusercontent.com/TonPapaLeChauve/roitoquizz/main/questions.json";
let questions = [];

// DOM
const stepPseudo = $`stepPseudo`, pseudoInput = $`pseudoInput`, btnPseudo = $`btnPseudo`;
const stepRole = $`stepRole`, roleSelect = $`roleSelect`, adminPassword = $`adminPassword`, btnValiderRole = $`btnValiderRole`;
const lobby = $`lobby`, adminList = $`adminList`, playerList = $`playerList`;
const adminControls = $`adminControls`, btnNextQuestion = $`btnNextQuestion`;
const questionZone = $`questionZone`, questionText = $`questionText`, questionImage = $`questionImage`, timeLeft = $`timeLeft`;
const playerAnswerZone = $`playerAnswerZone`, answerInput = $`answerInput`, btnAnswer = $`btnAnswer`;
const adminAnswers = $`adminAnswers`;

function $(id){return document.getElementById(id);}

// Pré-chargement des questions
fetch(QUESTIONS_URL).then(r=>r.json()).then(d=>questions=d);

// 1️⃣ Pseudo
btnPseudo.onclick = () => {
  const pseudo = pseudoInput.value.trim();
  if (!pseudo) return alert("Entre un pseudo");
  playerData.pseudo = pseudo;
  stepPseudo.classList.add("hidden");
  stepRole.classList.remove("hidden");
};

// 2️⃣ Rôle
roleSelect.onchange = () => adminPassword.classList.toggle("hidden", roleSelect.value !== "admin");
btnValiderRole.onclick = async () => {
  const role = roleSelect.value;
  const pwd = adminPassword.value;
  if (!role) return alert("Choisis un rôle");

  const snap = await get(ref(db, "players"));
  const pls = snap.val() || {};

  if (role==="admin") {
    if (Object.values(pls).some(p=>p.role==="admin"&&p.online)) return alert("Déjà un admin connecté");
    if (pwd!=="tocard") return alert("Mot de passe admin incorrect");
  }

  Object.entries(pls).forEach(([id,p])=>{
    if (p.pseudo===playerData.pseudo && !p.online) playerId = id;
  });
  if (!playerId) playerId = push(ref(db, "players")).key;

  playerData.role = role;
  const playerRef = ref(db, `players/${playerId}`);
  set(playerRef, { pseudo: playerData.pseudo, role, online: true, points: pls?.[playerId]?.points || 0, answer: "" });
  onDisconnect(playerRef).update({ online: false });

  stepRole.classList.add("hidden");
  lobby.classList.remove("hidden");
  if (role==="admin") adminControls.classList.remove("hidden");

  listenLobby();
  if (role==="player") answerLogic();
};

// Sync lobby + points + déconnexion admin
function listenLobby() {
  onValue(ref(db, "players"), snap => {
    const pls = snap.val() || {};
    adminList.innerHTML=""; playerList.innerHTML="";

    let adminOnline = false;
    for (const id in pls) {
      const p = pls[id];
      if (!p.online) continue;
      const e = document.createElement("div");
      e.className="row";
      e.innerHTML = `${p.role==="admin"?"👑":"🎮"}<strong>${p.pseudo}</strong>` +
        (p.role!=="admin"?`<span class="points"> - ${p.points} pts</span>`:"") +
        (id===playerId? " <i>(moi)</i>":"");
      (p.role==="admin"? adminList : playerList).appendChild(e);
      if (p.role==="admin") adminOnline = true;
    }

    if (!adminOnline && playerData.role==="player"){
      alert("Admin déconnecté, partie annulée.");
      remove(ref(db, "players")).then(_=>location.reload());
    }
  });
}

// 🔢 Admin lancement question
btnNextQuestion.onclick = () => {
  if (currentQuestionIndex>=questions.length) return alert("Fin des questions");
  const q = questions[currentQuestionIndex++];
  const now = Date.now();
  set(ref(db, "currentQuestion"), { text:q.question, image:q.image, start:now });
  questionTimer = setTimeout(endQuestion, QUESTION_DURATION*1000);
  showQuestion(true);
};

// Fin chrono
function endQuestion(){
  set(ref(db, "currentQuestion"), null);
  showQuestion(false);
}

// Affichage question/chrono / réponses admin ou joueur
onValue(ref(db, "currentQuestion"), snap => {
  const q = snap.val();
  if (!q) return showQuestion(false);

  showQuestion(true);
  questionText.textContent = q.text;
  questionImage.src = q.image;

  const end = q.start + QUESTION_DURATION*1000;
  const iv = setInterval(()=>{
    const s = Math.max(0, Math.ceil((end-Date.now())/1000));
    timeLeft.textContent = s;
    if (s<=0) clearInterval(iv);
  },200);

  onValue(ref(db, "players"), snap2=>{
    const pls = snap2.val()||{};
    adminAnswers.innerHTML = "";
    for (const id in pls){
      const p = pls[id];
      if(p.role==="player"){
        const row = document.createElement("div");
        row.className="row";
        row.innerHTML = `<strong>${p.pseudo} :</strong> ${p.answer||""}`;
        if (playerData.role==="admin"){
          const btn = document.createElement("button");
          btn.textContent="+1";
          btn.className="validateBtn";
          btn.onclick = ()=> update(ref(db, `players/${id}`), { points: p.points+1 });
          row.appendChild(btn);
        }
        adminAnswers.appendChild(row);
      }
    }
  });
});

// Basculer UI
function showQuestion(active){
  lobby.classList.toggle("hidden", active);
  questionZone.classList.toggle("hidden", !active);
  adminAnswers.classList.toggle("hidden", !(active && playerData.role==="admin"));
  playerAnswerZone.classList.toggle("hidden", active && playerData.role==="player");
}

// 🖋️ Réponse joueur
function answerLogic(){
  btnAnswer.onclick = ()=>{
    const a = answerInput.value.trim();
    if(a) update(ref(db, `players/${playerId}`), { answer: a });
  };
}
