import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

/* 🔑 PON TUS KEYS AQUÍ */
const SUPABASE_URL = "https://fepwhedxmrimnhabrhbo.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZlcHdoZWR4bXJpbW5oYWJyaGJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3OTk1MDUsImV4cCI6MjEwMjM3NTUwNX0.6j4_rsp5r_YN79wWlAKwMfVIwbuC5Sd9wf1KaavJtak";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* Estado */
let state = {
  roomCode: null,
  players: [],
  maxPoints: 101,
  useReenganches: true,
  mode: "edit"
};

/* DOM */
const welcome = document.getElementById("welcome");
const game = document.getElementById("game");
const playerInput = document.getElementById("playerInput");
const addPlayerBtn = document.getElementById("addPlayerBtn");
const playerList = document.getElementById("playerList");
const codeInput = document.getElementById("codeInput");
const startBtn = document.getElementById("startBtn");
const maxInput = document.getElementById("maxInput");
const useReenganches = document.getElementById("useReenganches");

const roomCodeTitle = document.getElementById("roomCodeTitle");
const scoreTableBody = document.querySelector("#scoreTable tbody");

const openApuntar = document.getElementById("openApuntar");
const apuntarModal = document.getElementById("apuntarModal");
const apuntarList = document.getElementById("apuntarList");
const apuntarForm = document.getElementById("apuntarForm");
const minus10Key = document.getElementById("minus10Key");
const apuntarCancel = document.getElementById("apuntarCancel");

const shareBtn = document.getElementById("shareBtn");
const shareModal = document.getElementById("shareModal");
const shareEdit = document.getElementById("shareEdit");
const shareView = document.getElementById("shareView");
const shareResult = document.getElementById("shareResult");
const qrContainer = document.getElementById("qrContainer");
const closeShare = document.getElementById("closeShare");

/* Util */
function genCode() {
  const letters = "abcdefghijklmnopqrstuvwxyz";
  let s = "";
  for (let i = 0; i < 6; i++) s += letters[Math.floor(Math.random() * letters.length)];
  return s;
}

/* Añadir jugador */
addPlayerBtn.onclick = () => {
  const v = playerInput.value.trim();
  if (!v) return;
  state.players.push({ name: v, score: 0, reenganches: 0, lastRound: 0 });
  playerInput.value = "";
  renderPlayerList();
};

function renderPlayerList() {
  playerList.innerHTML = "";
  state.players.forEach((p, idx) => {
    const li = document.createElement("li");
    li.textContent = p.name;
    const btn = document.createElement("button");
    btn.textContent = "Eliminar";
    btn.onclick = () => {
      state.players.splice(idx, 1);
      renderPlayerList();
    };
    li.appendChild(btn);
    playerList.appendChild(li);
  });
}

/* Crear partida */
startBtn.onclick = async () => {
  if (state.players.length === 0) return alert("Añade jugadores");

  let code = codeInput.value.trim().toLowerCase() || genCode();
  state.roomCode = code;
  state.maxPoints = parseInt(maxInput.value, 10) || 101;
  state.useReenganches = useReenganches.checked;

  const payload = {
    id: code,
    players: state.players,
    max_points: state.maxPoints,
    use_reenganches: state.useReenganches,
    mode: "edit",
    rounds: []
  };

  await supabase.from("rooms").upsert(payload);

  subscribeRoom(code);
  showGame();
};

/* Mostrar juego */
function showGame() {
  welcome.classList.add("hidden");
  game.classList.remove("hidden");
  roomCodeTitle.textContent = state.roomCode;
  renderGame();
}

/* Render tabla */
function renderGame() {
  scoreTableBody.innerHTML = "";
  state.players.forEach((p) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.name}</td>
      <td>${p.score}</td>
      <td style="color:black">${p.reenganches}</td>
      <td>${p.lastRound}</td>
    `;
    scoreTableBody.appendChild(tr);
  });
}

/* Suscripción realtime */
let subscription = null;

async function subscribeRoom(code) {
  const { data } = await supabase.from("rooms").select("*").eq("id", code).single();
  if (data) {
    state.players = data.players;
    state.maxPoints = data.max_points;
    state.useReenganches = data.use_reenganches;
    state.mode = data.mode;
    renderGame();
  }

  if (subscription) subscription.unsubscribe();

  subscription = supabase
    .channel("public:rooms")
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "rooms",
      filter: `id=eq.${code}`
    }, (payload) => {
      const newVal = payload.new;
      if (newVal) {
        state.players = newVal.players;
        state.maxPoints = newVal.max_points;
        state.useReenganches = newVal.use_reenganches;
        state.mode = newVal.mode;
        renderGame();
      }
    })
    .subscribe();
}

/* Apuntar ronda */
openApuntar.onclick = () => {
  if (state.mode === "view") return alert("Modo solo ver");

  apuntarList.innerHTML = "";
  state.players.forEach((p, idx) => {
    const row = document.createElement("div");
    row.innerHTML = `
      <div>${p.name}</div>
      <input type="number" data-idx="${idx}" placeholder="0">
    `;
    apuntarList.appendChild(row);
  });

  apuntarModal.classList.remove("hidden");
};

minus10Key.onclick = () => {
  const inputs = Array.from(apuntarList.querySelectorAll("input"));
  const focused = document.activeElement;
  let idx = 0;
  if (focused && focused.tagName === "INPUT") idx = parseInt(focused.dataset.idx, 10);
  inputs[idx].value = -10;
  if (inputs[idx + 1]) inputs[idx + 1].focus();
};

apuntarForm.onsubmit = async (e) => {
  e.preventDefault();
  const inputs = Array.from(apuntarList.querySelectorAll("input"));

  inputs.forEach((inp) => {
    const idx = parseInt(inp.dataset.idx, 10);
    let val = parseInt(inp.value, 10);
    if (isNaN(val)) val = 0;

    state.players[idx].lastRound = val;
    state.players[idx].score += val;

    if (state.players[idx].score >= state.maxPoints) {
      if (state.useReenganches) state.players[idx].reenganches++;
      else state.players[idx].score = "Perdedor";
    }
  });

  await supabase.from("rooms").update({
    players: state.players
  }).eq("id", state.roomCode);

  apuntarModal.classList.add("hidden");
  renderGame();
};

apuntarCancel.onclick = () => apuntarModal.classList.add("hidden");

/* Compartir */
shareBtn.onclick = () => shareModal.classList.remove("hidden");

shareEdit.onclick = () => {
  const link = `${location.origin}${location.pathname}?room=${state.roomCode}&mode=edit`;
  shareResult.textContent = link;
  qrContainer.innerHTML = "";
  QRCode.toCanvas(link, { width: 160 }, (_, canvas) => qrContainer.appendChild(canvas));
};

shareView.onclick = () => {
  const link = `${location.origin}${location.pathname}?room=${state.roomCode}&mode=view`;
  shareResult.textContent = link;
  qrContainer.innerHTML = "";
  QRCode.toCanvas(link, { width: 160 }, (_, canvas) => qrContainer.appendChild(canvas));
};

closeShare.onclick = () => shareModal.classList.add("hidden");

/* Cargar desde URL */
function loadFromUrl() {
  const params = new URLSearchParams(location.search);
  const room = params.get("room");
  const mode = params.get("mode");

  if (!room) {
    welcome.classList.remove("hidden");
    game.classList.add("hidden");
    return;
  }

  state.roomCode = room.toLowerCase();
  state.mode = mode === "view" ? "view" : "edit";

  subscribeRoom(state.roomCode);
  showGame();
}

loadFromUrl();
