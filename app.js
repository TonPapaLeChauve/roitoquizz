// app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue, remove } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";

// Config Firebase que tu m'as donné
const firebaseConfig = {
  apiKey: "AIzaSyAwi1VHv7jaaPPyanv90CCheM1mZ-xNr58",
  authDomain: "roidestocards-d0084.firebaseapp.com",
  projectId: "roidestocards-d0084",
  storageBucket: "roidestocards-d0084.firebasestorage.app",
  messagingSenderId: "120053524190",
  appId: "1:120053524190:web:c68520412faff06836044f",
  measurementId: "G-YVH6BWKZGZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const PASSWORD = "tocard";
let isAdmin = false;
let timeLeft = 30;
let interval;

// --- DOM Elements ---
const roleSelectDiv = document.getElementById("roleSelect");
const adminPanel = document.getElementById("adminPanel");
const responseForm = document.getElementById("responseForm");

const roleSelect = document.getElementById("role");
const adminPasswordInput = document.getElementById("adminPassword");
const btnValiderRole = document.getElementById("btnValiderRole");

const questionP = document.getElementById("question");
const questionInput = document.getElementById("questionInput");
const btnLancerChrono = document.getElementById("btnLancerChrono");
const countdownDiv = document.getElementById("countdown");
const responseList = document.getElementById("responseList");

const joueurQuestionP = document.getElementById("joueurQuestion");
const pseudoInput = document.getElementById("pseudo");
const reponseInput = document.getElementById("reponse");
const btnEnvoyerReponse = document.getElementById("btnEnvoyerReponse");

// --- Fonctions ---

function afficherReponses(data) {
  responseList.innerHTML = "";
  if (data) {
    Object.values(data).forEach(({ pseudo, reponse }) => {
      const p = document.createElement("p");
      p.textContent = `${pseudo} : ${reponse}`;
      responseList.appendChild(p);
    });
  }
}

function lancerChrono() {
  const questionText = questionInput.value.trim();
  if (!questionText) return alert("Entre une question");

  // Mettre la question en base
  set(ref(db, 'quiz/question'), questionText);

  // Reset réponses en base
  remove(ref(db, 'quiz/responses'));

  timeLeft = 30;
  set(ref(db, 'quiz/timeLeft'), timeLeft);

  countdownDiv.textContent = timeLeft;

  interval = setInterval(() => {
    timeLeft--;
    set(ref(db, 'quiz/timeLeft'), timeLeft);
    if (timeLeft <= 0) {
      clearInterval(interval);
      set(ref(db, 'quiz/timeLeft'), 0);
    }
  }, 1000);
}

// Envoi d'une réponse joueur
function envoyerReponse() {
  const pseudo = pseudoInput.value.trim();
  const reponse = reponseInput.value.trim();

  if (!pseudo || !reponse) return alert("Remplis tous les champs");

  const responsesRef = ref(db, 'quiz/responses');
  const newResponseRef = push(responsesRef);
  set(newResponseRef, { pseudo, reponse });

  alert("Réponse enregistrée !");
  responseForm.style.display = "none";
  pseudoInput.value = "";
  reponseInput.value = "";
}

// Écoute la question en temps réel
onValue(ref(db, 'quiz/question'), (snapshot) => {
  const question = snapshot.val();
  if (question) {
    questionP.textContent = question;
    joueurQuestionP.textContent = question;
  } else {
    questionP.textContent = "En attente de la question...";
    joueurQuestionP.textContent = "";
  }
});

// Écoute le chrono en temps réel
onValue(ref(db, 'quiz/timeLeft'), (snapshot) => {
  const time = snapshot.val();
  if (time === null) {
    countdownDiv.textContent = "";
    responseForm.style.display = "none";
    return;
  }

  countdownDiv.textContent = time > 0 ? time : "Temps écoulé !";

  if (time > 0) {
    if (!isAdmin) {
      responseForm.style.display = "flex";
    }
  } else {
    responseForm.style.display = "none";
  }
});

// Écoute les réponses en temps réel (admin)
onValue(ref(db, 'quiz/responses'), (snapshot) => {
  if (isAdmin) {
    afficherReponses(snapshot.val());
  }
});

// Gestion du rôle + affichage des panneaux
btnValiderRole.addEventListener("click", () => {
  const role = roleSelect.value;
  const adminPass = adminPasswordInput.value;

  if (role === "admin") {
    if (adminPass === PASSWORD) {
      isAdmin = true;
      roleSelectDiv.style.display = "none";
      adminPanel.style.display = "flex";
      responseForm.style.display = "none";
    } else {
      alert("Mot de passe incorrect");
      adminPasswordInput.style.display = "block";
    }
  } else if (role === "joueur") {
    isAdmin = false;
    roleSelectDiv.style.display = "none";
    adminPanel.style.display = "none";
    responseForm.style.display = "flex";
  } else {
    alert("Choisis un rôle");
  }
});

// Afficher le champ mot de passe seulement si admin sélectionné
roleSelect.addEventListener("change", () => {
  if (roleSelect.value === "admin") {
    adminPassword.classList.remove("hidden");
  } else {
    adminPassword.classList.add("hidden");
    adminPassword.value = "";
  }
});

// Forcer la valeur par défaut au chargement
roleSelect.value = "";

// Fonction pour afficher ou cacher le champ mot de passe selon rôle
function checkRole() {
  if (roleSelect.value === "admin") {
    adminPassword.classList.remove("hidden");
  } else {
    adminPassword.classList.add("hidden");
    adminPassword.value = "";
  }
}

// Appel initial au chargement
checkRole();

// Appel à chaque changement
roleSelect.addEventListener("change", checkRole);


btnLancerChrono.addEventListener("click", lancerChrono);
btnEnvoyerReponse.addEventListener("click", envoyerReponse);
