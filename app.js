// Initialisation Firebase
const firebaseConfig = {
  apiKey: "VOTRE_API_KEY",
  authDomain: "VOTRE_AUTH_DOMAIN",
  databaseURL: "VOTRE_DATABASE_URL",
  projectId: "VOTRE_PROJECT_ID",
  storageBucket: "VOTRE_STORAGE_BUCKET",
  messagingSenderId: "VOTRE_MESSAGING_SENDER_ID",
  appId: "VOTRE_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Variables globales
let playerId = null;
let playerData = { pseudo: null, role: null };
let isAdmin = false;
let timerInterval = null;

// DOM Elements
const stepPseudo = document.getElementById("stepPseudo");
const pseudoInput = document.getElementById("pseudoInput");
const btnPseudo = document.getElementById("btnPseudo");

const stepRole = document.getElementById("stepRole");
const roleSelect = document.getElementById("roleSelect");
const adminPassword = document.getElementById("adminPassword");
const btnValiderRole = document.getElementById("btnValiderRole");

const lobby = document.getElementById("lobby");
const lobbyList = document.getElementById("lobbyList");
const btnLancerQuestion = document.getElementById("btnLancerQuestion");

const adminPanel = document.getElementById("adminPanel");
const questionInput = document.getElementById("questionInput");
const btnLancer = document.getElementById("btnLancer");
const questionDisplay = document.getElementById("questionDisplay");
const countdownAdmin = document.getElementById("countdownAdmin");
const responseList = document.getElementById("responseList");

const playerPanel = document.getElementById("playerPanel");
const joueurQuestion = document.getElementById("joueurQuestion");
const countdownJoueur = document.getElementById("countdownJoueur");
const reponseInput = document.getElementById("reponseInput");
const btnEnvoyerReponse = document.getElementById("btnEnvoyerReponse");

const scorePanel = document.getElementById("scorePanel");
const scoreList = document.getElementById("scoreList");

// Étape 1 : Choisir pseudo
btnPseudo.onclick = () => {
  const pseudo = pseudoInput.value.trim();
  if (!pseudo) {
    alert("Entre un pseudo");
    return;
  }
  playerData.pseudo = pseudo;
  stepPseudo.classList.add("hidden");
  stepRole.classList.remove("hidden");
};

// Afficher / cacher champ mot de passe admin selon rôle
roleSelect.addEventListener("change", () => {
  if (roleSelect.value === "admin") {
    adminPassword.classList.remove("hidden");
  } else {
    adminPassword.classList.add("hidden");
    adminPassword.value = "";
  }
});

// Étape 2 : Valider rôle + mot de passe admin si besoin + inscrire dans Firebase
btnValiderRole.onclick = () => {
  const role = roleSelect.value;
  const pwd = adminPassword.value;
  if (!role) {
    alert("Choisis un rôle");
    return;
  }
  if (role === "admin") {
    if (pwd !== "tocard") {
      alert("Mot de passe admin incorrect");
      return;
    }
    isAdmin = true;
  } else {
    isAdmin = false;
  }
  playerData.role = role;

  // Ajouter joueur dans DB et récupérer clé générée
  const playersRef = database.ref("players");
  playerId = playersRef.push().key;
  const playerRef = database.ref(`players/${playerId}`);
  playerRef.set({ pseudo: playerData.pseudo, role: playerData.role, score: 0 });

  stepRole.classList.add("hidden");
  lobby.classList.remove("hidden");

  if (isAdmin) {
    btnLancerQuestion.classList.remove("hidden");
  } else {
    btnLancerQuestion.classList.add("hidden");
  }

  startLobbyListener();
};

// Écoute en direct les joueurs connectés pour afficher lobby
function startLobbyListener() {
  const playersRef = database.ref("players");
  playersRef.on("value", (snapshot) => {
    const players = snapshot.val() || {};
    lobbyList.innerHTML = "";
    for (const id in players) {
      const p = players[id];
      const span = document.createElement("div");
      span.textContent = p.pseudo + (p.role === "admin" ? " (Admin)" : "");
      if (id === playerId) span.style.fontWeight = "bold";
      lobbyList.appendChild(span);
    }
  });
}

// Admin lance la question + chrono
btnLancerQuestion.onclick = () => {
  adminPanel.classList.remove("hidden");
  lobby.classList.add("hidden");
};

btnLancer.onclick = () => {
  const question = questionInput.value.trim();
  if (!question) {
    alert("Écris une question !");
    return;
  }
  // Mettre question + chrono dans DB
  const quizRef = database.ref("quiz");
  quizRef.set({
    question: question,
    chrono: 30,
    active: true,
    timestamp: Date.now()
  });

  questionInput.value = "";
  btnLancer.disabled = true;

  // Vider les réponses précédentes
  const reponsesRef = database.ref("reponses");
  reponsesRef.set({});

  startCountdown(30, countdownAdmin);
};

// Fonction chrono (admin + maj Firebase)
function startCountdown(seconds, displayElement) {
  clearInterval(timerInterval);
  let timeLeft = seconds;
  displayElement.textContent = timeLeft + "s";

  timerInterval = setInterval(() => {
    timeLeft--;
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      displayElement.textContent = "Temps écoulé";
      btnLancer.disabled = false;

      // Fin quiz
      const quizActiveRef = database.ref("quiz/active");
      quizActiveRef.set(false);

      // Retour au lobby et affichage des scores
      lobby.classList.remove("hidden");
      adminPanel.classList.add("hidden");
      playerPanel.classList.add("hidden");
      scorePanel.classList.remove("hidden");

      return;
    }
    displayElement.textContent = timeLeft + "s";

    // Mise à jour chrono dans DB
    const chronoRef = database.ref("quiz/chrono");
    chronoRef.set(timeLeft);
  }, 1000);
}

// Écoute question + chrono pour tous
database.ref("quiz").on("value", (snapshot) => {
  const quiz = snapshot.val();
  if (!quiz || !quiz.active) {
    questionDisplay.textContent = "En attente...";
    joueurQuestion.textContent = "En attente...";
    countdownAdmin.textContent = "--";
    countdownJoueur.textContent = "--";
    btnEnvoyerReponse.disabled = true;
    reponseInput.disabled = true;
    reponseInput.value = "";
    reponseInput.classList.add("hidden");
    btnEnvoyerReponse.classList.add("hidden");
    return;
  }
  questionDisplay.textContent = quiz.question;
  joueurQuestion.textContent = quiz.question;

  if (!isAdmin) {
    countdownJoueur.textContent = quiz.chrono + "s";
    if (quiz.chrono > 0) {
      btnEnvoyerReponse.disabled = false;
      reponseInput.disabled = false;
      reponseInput.classList.remove("hidden");
      btnEnvoyerReponse.classList.remove("hidden");
    } else {
      btnEnvoyerReponse.disabled = true;
      reponseInput.disabled = true;
      reponseInput.classList.add("hidden");
      btnEnvoyerReponse.classList.add("hidden");
    }
  } else {
    countdownAdmin.textContent = quiz.chrono + "s";
  }
});

// Écoute réponses en direct (admin uniquement)
if (isAdmin) {
  database.ref("reponses").on("value", (snapshot) => {
    const reponses = snapshot.val() || {};
    responseList.innerHTML = "";
    Object.values(reponses).forEach(r => {
      const p = document.createElement("p");
      p.textContent = `${r.pseudo} : ${r.reponse}`;
      responseList.appendChild(p);
    });
  });
}

// Envoyer réponse joueur
btnEnvoyerReponse.onclick = () => {
  const answer = reponseInput.value.trim();
  if (!answer) {
    alert("Écris une réponse !");
    return;
  }
  const reponsesRef = database.ref("reponses");
  // Empêche double réponse : on remplace ou on ajoute
  const userResponseRef = database.ref(`reponses/${playerId}`);
  userResponseRef.set({
    pseudo: playerData.pseudo,
    reponse: answer,
    timestamp: Date.now()
  });
  alert("Réponse envoyée !");
  reponseInput.value = "";
  btnEnvoyerReponse.disabled = true;
  reponseInput.disabled = true;
};

// Supprimer joueur dans Firebase à la déconnexion
window.addEventListener("beforeunload", () => {
  if (playerId) {
    database.ref(`players/${playerId}`).remove();
    database.ref(`reponses/${playerId}`).remove();
  }
});
