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

// Logique pour gérer les étapes du pseudo, du rôle, du lobby, et du quiz
// Utilisez les fonctions Firebase pour écouter et mettre à jour les données en temps réel

// Exemple pour valider le pseudo
document.getElementById('btnPseudo').onclick = function() {
  const pseudo = document.getElementById('pseudoInput').value.trim();
  if (pseudo) {
    // Stockez le pseudo et passez à l'étape suivante
    document.getElementById('stepPseudo').classList.add('hidden');
    document.getElementById('stepRole').classList.remove('hidden');
  } else {
    alert('Veuillez entrer un pseudo.');
  }
};

// Ajoutez d'autres fonctions pour gérer le rôle, le lobby, et le quiz
