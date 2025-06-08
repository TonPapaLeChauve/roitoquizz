// 🔗 Remplace par ton propre lien si différent
const QUESTIONS_URL = "https://raw.githubusercontent.com/tonpapalechauve/roitoquizz/main/questions.json";

let questions = [];
let currentQuestionIndex = 0;
let isAdmin = false;

// 🔁 Charger les questions au lancement si admin
async function loadQuestions() {
  try {
    const res = await fetch(QUESTIONS_URL);
    questions = await res.json();
    console.log("Questions chargées", questions);
  } catch (err) {
    console.error("Erreur de chargement des questions :", err);
  }
}

// 🔘 Quand l'admin clique sur "Lancer question"
document.getElementById("btnNextQuestion").onclick = async () => {
  if (!questions.length) return alert("Aucune question chargée");

  const question = questions[currentQuestionIndex];
  const gameRef = ref(database, "game");

  await set(gameRef, {
    currentQuestionIndex,
    questionStartTime: Date.now(),
    questionDuration: 30000 // 30 sec
  });

  currentQuestionIndex = (currentQuestionIndex + 1) % questions.length;
};

// 🔁 Ecouter les changements de question
onValue(ref(database, "game"), async (snapshot) => {
  const gameData = snapshot.val();
  if (!gameData) return;

  const index = gameData.currentQuestionIndex || 0;
  const q = questions[index];
  if (!q) return;

  document.getElementById("questionText").textContent = q.question;
  document.getElementById("questionImage").src = q.image;

  const timerDisplay = document.getElementById("timerDisplay");
  const duration = gameData.questionDuration || 30000;
  const startTime = gameData.questionStartTime;
  const endTime = startTime + duration;

  const interval = setInterval(() => {
    const now = Date.now();
    const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
    timerDisplay.textContent = `⏱️ Temps restant : ${remaining} sec`;

    if (remaining <= 0) clearInterval(interval);
  }, 500);
});

// 🔧 Gestion des points (admin seulement)
function setupPointsManager(players) {
  const container = document.getElementById("pointsManager");
  container.innerHTML = "";

  for (const id in players) {
    const p = players[id];
    const line = document.createElement("div");
    line.innerHTML = `
      <strong>${p.pseudo}</strong> - <span>${p.points || 0}</span>
      <button data-id="${id}" data-delta="1">+</button>
      <button data-id="${id}" data-delta="-1">−</button>
    `;
    container.appendChild(line);
  }

  container.querySelectorAll("button").forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.id;
      const delta = parseInt(btn.dataset.delta);
      const playerRef = ref(database, `players/${id}`);
      update(playerRef, {
        points: (players[id].points || 0) + delta
      });
    };
  });
}
