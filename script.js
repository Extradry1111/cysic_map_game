const firebaseConfig = {
  apiKey: "AIzaSyD2uLMpBe5CjdZCAhoBt7mQtyIGxdJQGBM",
  authDomain: "cysic-map.firebaseapp.com",
  projectId: "cysic-map",
  storageBucket: "cysic-map.firebasestorage.app",
  messagingSenderId: "683342323789",
  appId: "1:683342323789:web:9bf4289955ed3dd74bbc04"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let currentTwitter = null;

const bounds = [[-85, -180], [85, 180]];
const map = L.map('map', {
  zoomControl: false,
  minZoom: 2,
  maxBounds: bounds,
  maxBoundsViscosity: 1.0
}).setView([20, 0], 2);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors',
  opacity: 0.75
}).addTo(map);

let selectedLatLng = null;
const formContainer = document.getElementById('form-container');
const markerForm = document.getElementById('marker-form');
const cancelBtn = document.getElementById('cancel');

map.on('click', e => {
  selectedLatLng = e.latlng;
  formContainer.classList.remove('hidden');
  setTimeout(() => formContainer.classList.add('show'), 10);
  document.getElementById('twitter').focus();
});

cancelBtn.addEventListener('click', hideForm);

function hideForm() {
  formContainer.classList.remove('show');
  setTimeout(() => formContainer.classList.add('hidden'), 300);
  markerForm.reset();
  selectedLatLng = null;
}

markerForm.addEventListener('submit', async e => {
  e.preventDefault();
  if (!selectedLatLng) return;

  const twitterHandleInput = document.getElementById('twitter').value.trim();
  const twitterHandle = twitterHandleInput.replace(/^@/, '');
  const discordRole = document.getElementById('discordRole').value.trim();
  const reason = document.getElementById('reason').value.trim();

  currentTwitter = twitterHandle;

  const existing = await db.collection("markers").where("twitter", "==", twitterHandle).get();
  if (!existing.empty) {
    alert("Этот Twitter уже добавлен на карту!");
    return;
  }

  const avatarUrl = `https://unavatar.io/twitter/${twitterHandle}`;

  await db.collection("markers").add({
    lat: selectedLatLng.lat,
    lng: selectedLatLng.lng,
    twitter: twitterHandle,
    discordRole,
    reason,
    avatar: avatarUrl,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });

  hideForm();
});

db.collection("markers").onSnapshot(snapshot => {
  snapshot.docChanges().forEach(change => {
    if (change.type === "added") {
      const data = change.doc.data();
      addMarkerToMap(change.doc.id, data);
    }
  });
});

function loadImageWithFallback(url, fallbackUrl) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(url);
    img.onerror = () => resolve(fallbackUrl);
    img.src = url;
  });
}

async function addMarkerToMap(docId, data) {
  const fallbackAvatar = 'https://via.placeholder.com/40/8e6efc/000000?text=C';
  const avatarUrl = await loadImageWithFallback(data.avatar, fallbackAvatar);

  const avatarIcon = L.divIcon({
    html: `<div class="marker-animate"><img src="${avatarUrl}" style="width:40px;height:40px;border-radius:50%;border:2px solid #8e6efc;background:white;"></div>`,
    iconSize: [40, 40],
    className: ''
  });

  const marker = L.marker([data.lat, data.lng], { icon: avatarIcon }).addTo(map);

  let popupContent = `
    <strong>@${data.twitter}</strong><br/>
    Role: ${data.discordRole}<br/>
    Reason: ${data.reason}
  `;

  if (currentTwitter && currentTwitter === data.twitter) {
    popupContent += `<br/><button class="delete-marker" data-id="${docId}" style="margin-top:5px;background:#f44336;color:white;border:none;padding:4px 8px;border-radius:5px;cursor:pointer;">Удалить</button>`;
  }

  marker.bindPopup(popupContent);

  marker.on('popupopen', () => {
    const btn = document.querySelector('.delete-marker');
    if (btn) {
      btn.addEventListener('click', async () => {
        if (confirm("Удалить свой маркер?")) {
          await db.collection("markers").doc(docId).delete();
          map.removeLayer(marker);
        }
      });
    }
  });
}
