// Import the functions you need from the Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-database.js";

// Configuration Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAwi1VHv7jaaPPyanv90CCheM1mZ-xNr58",
  authDomain: "roidestocards-d0084.firebaseapp.com",
  databaseURL: "https://roidestocards-d0084-default-rtdb.europe-west1.firebasedatabase.app/",
  projectId: "roidestocards-d0084",
  storageBucket: "roidestocards-d0084.appspot.com",
  messagingSenderId: "120053524190",
  appId: "1:120053524190:web:c68520412faff06836044f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Écrire des données dans Firebase
document.getElementById('writeData').addEventListener('click', () => {
  const testDataRef = ref(database, 'test/data');
  set(testDataRef, {
    message: "Bonjour, Firebase!",
    timestamp: Date.now()
  }).then(() => {
    console.log("Données écrites avec succès.");
    alert("Données écrites avec succès.");
  }).catch((error) => {
    console.error("Erreur lors de l'écriture des données : ", error);
    alert("Erreur lors de l'écriture des données.");
  });
});

// Lire des données depuis Firebase
document.getElementById('readData').addEventListener('click', () => {
  const testDataRef = ref(database, 'test/data');
  onValue(testDataRef, (snapshot) => {
    const data = snapshot.val();
    const outputDiv = document.getElementById('dataOutput');
    if (data) {
      outputDiv.innerHTML = `Message: ${data.message}, Timestamp: ${new Date(data.timestamp).toLocaleString()}`;
      console.log("Données lues : ", data);
    } else {
      outputDiv.innerHTML = "Aucune donnée disponible.";
      console.log("Aucune donnée disponible.");
    }
  });
});
