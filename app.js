import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

/* 🔑 PON TUS KEYS AQUÍ */
const SUPABASE_URL = "https://fepwhedxmrimnhabrhbo.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZlcHdoZWR4bXJpbW5oYWJyaGJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3OTk1MDUsImV4cCI6MjEwMjM3NTUwNX0.6j4_rsp5r_YN79wWlAKwMfVIwbuC5Sd9wf1KaavJtak";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ---------- Estado ---------- */
/*
 players: [{ id, name, startingScore }]
 rounds:  [ { [playerId]: number } ]   // una entrada por ronda jugada
 urlMode: 'edit' | 'view'  -> SIEMPRE decidido por la URL local, nunca se pisa con lo que llegue de la base de datos
*/
let state = {
  roomCode: null,
  players: [],
  rounds: [],
  maxPoints: 101,
  useReenganches: true,
  urlMode: "edit"
};

let progressChart = null;

/* ---------- DOM ---------- */
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
const scoreTableHeadRow = document.querySelector("#scoreTable thead tr");
const scoreTableBody = document.querySelector("#scoreTable tbody");
const emptyState = document.getElementById("emptyState");
const viewBadge = document.getElementById("viewBadge");

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

const editPlayersBtn = document.getElementById("editPlayersBtn");
const editPlayersModal = document.getElementById("editPlayersModal");
const editPlayersList = document.getElementById("editPlayersList");
const editPlayerName = document.getElementById("editPlayerName");
const editPlayerScore = document.getElementById("editPlayerScore");
const editPlayerAddBtn = document.getElementById("editPlayerAddBtn");
const editPlayersCancel = document.getElementById("editPlayersCancel");
const editPlayersSave = document.getElementById("editPlayersSave");

const progressBtn = document.getElementById("progressBtn");
const progressModal = document.getElementById("progressModal");
const progressChartCanvas = document.getElementById("progressChart");
const progressEmpty = document.getElementById("progressEmpty");
const progressClose = document.getElementById("progressClose");

const rulesBtn = document.getElementById("rulesBtn");
const rulesModal = document.getElementById("rulesModal");
const rulesClose = document.getElementById("rulesClose");

/* Copia de trabajo para el modal de editar jugadores (no se guarda hasta pulsar "Guardar") */
let editDraftPlayers = [];

/* ---------- Util ---------- */
function genCode() {
  const letters = "abcdefghijklmnopqrstuvwxyz";
  let s = "";
  for (let i = 0; i < 6; i++) s += letters[Math.floor(Math.random() * letters.length)];
  return s;
}

function genId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return "p_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function isEditable() {
  return state.urlMode !== "view";
}

/* Calcula, para cada jugador: histórico de acumulados ronda a ronda, total, reenganches y si está eliminado */
function computeStats() {
  const stats = {};
  state.players.forEach((p) => {
    stats[p.id] = {
      history: [],       // acumulado tras cada ronda (solo rondas en las que ya existía o participó)
      total: p.startingScore || 0,
      reenganches: 0,
      eliminated: false
    };
  });

  state.rounds.forEach((round) => {
    state.players.forEach((p) => {
      const s = stats[p.id];
      if (s.eliminated) {
        s.history.push(null);
        return;
      }
      const val = round[p.id];
      if (val === undefined || val === null) {
        // el jugador no jugó esa ronda (se unió después)
        s.history.push(s.history.length ? s.history[s.history.length - 1] : null);
        return;
      }
      const before = s.total;
      s.total += val;
      s.history.push(s.total);

      if (s.total >= state.maxPoints) {
        if (before < state.maxPoints) {
          if (state.useReenganches) {
            s.reenganches++;
          } else {
            s.eliminated = true;
          }
        }
      }
    });
  });

  return stats;
}

/* ---------- Añadir jugador (pantalla inicial) ---------- */
addPlayerBtn.onclick = () => {
  const v = playerInput.value.trim();
  if (!v) return;
  state.players.push({ id: genId(), name: v, startingScore: 0 });
  playerInput.value = "";
  renderPlayerList();
};

playerInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    addPlayerBtn.click();
  }
});

function renderPlayerList() {
  playerList.innerHTML = "";
  state.players.forEach((p, idx) => {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.textContent = p.name;
    const btn = document.createElement("button");
    btn.textContent = "✕";
    btn.type = "button";
    btn.onclick = () => {
      state.players.splice(idx, 1);
      renderPlayerList();
    };
    li.appendChild(span);
    li.appendChild(btn);
    playerList.appendChild(li);
  });
}

/* ---------- Crear partida ---------- */
startBtn.onclick = async () => {
  if (state.players.length === 0) return alert("Añade al menos un jugador");

  let code = codeInput.value.trim().toLowerCase() || genCode();
  state.roomCode = code;
  state.maxPoints = parseInt(maxInput.value, 10) || 101;
  state.useReenganches = useReenganches.checked;
  state.rounds = [];
  state.urlMode = "edit";

  const payload = {
    id: code,
    players: state.players,
    rounds: state.rounds,
    max_points: state.maxPoints,
    use_reenganches: state.useReenganches
  };

  await supabase.from("rooms").upsert(payload);

  const url = new URL(location.href);
  url.searchParams.set("room", code);
  url.searchParams.set("mode", "edit");
  history.replaceState(null, "", url);

  subscribeRoom(code);
  showGame();
};

/* ---------- Mostrar juego ---------- */
function showGame() {
  welcome.classList.add("hidden");
  game.classList.remove("hidden");
  roomCodeTitle.textContent = state.roomCode;

  const editable = isEditable();
  openApuntar.classList.toggle("hidden", !editable);
  editPlayersBtn.classList.toggle("hidden", !editable);
  viewBadge.classList.toggle("hidden", editable);

  renderGame();
}

/* ---------- Render tabla histórica ---------- */
function renderGame() {
  const stats = computeStats();
  const numRounds = state.rounds.length;

  // Cabecera: Jugador | R1 | R2 | ... | Rn | Total | Reenganches
  scoreTableHeadRow.innerHTML = "<th>Jugador</th>";
  for (let r = 1; r <= numRounds; r++) {
    const th = document.createElement("th");
    th.textContent = "R" + r;
    scoreTableHeadRow.appendChild(th);
  }
  const thTotal = document.createElement("th");
  thTotal.textContent = "Total";
  scoreTableHeadRow.appendChild(thTotal);
  if (state.useReenganches) {
    const thRe = document.createElement("th");
    thRe.textContent = "Reeng.";
    scoreTableHeadRow.appendChild(thRe);
  }

  scoreTableBody.innerHTML = "";
  state.players.forEach((p) => {
    const s = stats[p.id];
    const tr = document.createElement("tr");

    const tdName = document.createElement("td");
    tdName.textContent = p.name;
    tr.appendChild(tdName);

    for (let r = 0; r < numRounds; r++) {
      const td = document.createElement("td");
      const val = s.history[r];
      if (val === null || val === undefined) {
        td.textContent = "–";
        td.className = "cell-muted";
      } else {
        td.textContent = val;
        if (val < 0) td.className = "cell-negative";
      }
      tr.appendChild(td);
    }

    const tdTotal = document.createElement("td");
    tdTotal.className = "cell-total";
    tdTotal.textContent = s.eliminated ? "Eliminado" : s.total;
    if (s.eliminated) tdTotal.classList.add("cell-eliminated");
    tr.appendChild(tdTotal);

    if (state.useReenganches) {
      const tdRe = document.createElement("td");
      tdRe.textContent = s.reenganches;
      tr.appendChild(tdRe);
    }

    scoreTableBody.appendChild(tr);
  });

  emptyState.classList.toggle("hidden", numRounds > 0);
}

/* ---------- Suscripción realtime ---------- */
let subscription = null;

async function subscribeRoom(code) {
  const { data } = await supabase.from("rooms").select("*").eq("id", code).single();
  if (data) {
    applyRemoteData(data);
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
      if (payload.new) applyRemoteData(payload.new);
    })
    .subscribe();
}

function applyRemoteData(data) {
  state.players = data.players || [];
  state.rounds = data.rounds || [];
  state.maxPoints = data.max_points;
  state.useReenganches = data.use_reenganches;
  // OJO: el modo (edit/view) NUNCA se toma de la base de datos, solo de la URL local.
  renderGame();
}

async function saveRoom() {
  await supabase.from("rooms").update({
    players: state.players,
    rounds: state.rounds,
    max_points: state.maxPoints,
    use_reenganches: state.useReenganches
  }).eq("id", state.roomCode);
}

/* ---------- Apuntar ronda ---------- */
openApuntar.onclick = () => {
  if (!isEditable()) return alert("Estás en modo solo ver, no puedes apuntar rondas");

  const stats = computeStats();
  apuntarList.innerHTML = "";
  state.players.forEach((p) => {
    if (stats[p.id].eliminated) return; // los eliminados no juegan más rondas
    const row = document.createElement("div");
    row.className = "apuntar-row";
    row.innerHTML = `
      <span>${p.name}</span>
      <input type="number" data-idx="${p.id}" placeholder="0">
    `;
    apuntarList.appendChild(row);
  });

  apuntarModal.classList.remove("hidden");
};

/* -10: aplica al primer input vacío (no al primero de todos), y salta el foco al siguiente */
minus10Key.onclick = () => {
  const inputs = Array.from(apuntarList.querySelectorAll("input"));
  const target = inputs.find((inp) => inp.value.trim() === "");
  if (!target) return; // ya están todas rellenas
  target.value = -10;
  const nextIdx = inputs.indexOf(target) + 1;
  if (inputs[nextIdx]) inputs[nextIdx].focus();
};

apuntarForm.onsubmit = async (e) => {
  e.preventDefault();
  if (!isEditable()) return;

  const inputs = Array.from(apuntarList.querySelectorAll("input"));
  const round = {};
  inputs.forEach((inp) => {
    const playerId = inp.dataset.idx;
    let val = parseInt(inp.value, 10);
    if (isNaN(val)) val = 0;
    round[playerId] = val;
  });

  state.rounds.push(round);
  await saveRoom();

  apuntarModal.classList.add("hidden");
  renderGame();
};

apuntarCancel.onclick = () => apuntarModal.classList.add("hidden");

/* ---------- Compartir ---------- */
shareBtn.onclick = () => {
  shareResult.textContent = "";
  qrContainer.innerHTML = "";
  shareModal.classList.remove("hidden");
};

function buildLink(mode) {
  return `${location.origin}${location.pathname}?room=${state.roomCode}&mode=${mode}`;
}

shareEdit.onclick = () => {
  const link = buildLink("edit");
  shareResult.textContent = link;
  qrContainer.innerHTML = "";
  QRCode.toCanvas(link, { width: 160 }, (_, canvas) => qrContainer.appendChild(canvas));
};

shareView.onclick = () => {
  const link = buildLink("view");
  shareResult.textContent = link;
  qrContainer.innerHTML = "";
  QRCode.toCanvas(link, { width: 160 }, (_, canvas) => qrContainer.appendChild(canvas));
};

closeShare.onclick = () => shareModal.classList.add("hidden");

/* ---------- Editar jugadores ---------- */
editPlayersBtn.onclick = () => {
  if (!isEditable()) return;
  editDraftPlayers = state.players.map((p) => ({ ...p }));
  editPlayerName.value = "";

  const stats = computeStats();
  let maxTotal = 0;
  state.players.forEach((p) => {
    const t = stats[p.id].eliminated ? 0 : stats[p.id].total;
    if (t > maxTotal) maxTotal = t;
  });
  editPlayerScore.value = maxTotal;

  renderEditPlayersList();
  editPlayersModal.classList.remove("hidden");
};

function renderEditPlayersList() {
  editPlayersList.innerHTML = "";
  editDraftPlayers.forEach((p, idx) => {
    const li = document.createElement("li");
    li.className = "edit-players-row";
    li.innerHTML = `
      <div class="order-btns">
        <button type="button" class="icon-btn" data-action="up" ${idx === 0 ? "disabled" : ""}>▲</button>
        <button type="button" class="icon-btn" data-action="down" ${idx === editDraftPlayers.length - 1 ? "disabled" : ""}>▼</button>
      </div>
      <span class="name">${p.name}</span>
      <button type="button" class="icon-btn icon-btn--danger" data-action="delete">✕</button>
    `;
    li.querySelector('[data-action="up"]').onclick = () => {
      [editDraftPlayers[idx - 1], editDraftPlayers[idx]] = [editDraftPlayers[idx], editDraftPlayers[idx - 1]];
      renderEditPlayersList();
    };
    li.querySelector('[data-action="down"]').onclick = () => {
      [editDraftPlayers[idx + 1], editDraftPlayers[idx]] = [editDraftPlayers[idx], editDraftPlayers[idx + 1]];
      renderEditPlayersList();
    };
    li.querySelector('[data-action="delete"]').onclick = () => {
      editDraftPlayers.splice(idx, 1);
      renderEditPlayersList();
    };
    editPlayersList.appendChild(li);
  });
}

editPlayerAddBtn.onclick = () => {
  const name = editPlayerName.value.trim();
  if (!name) return;
  let score = parseInt(editPlayerScore.value, 10);
  if (isNaN(score)) score = 0;
  editDraftPlayers.push({ id: genId(), name, startingScore: score });
  editPlayerName.value = "";
  renderEditPlayersList();
};

editPlayersCancel.onclick = () => editPlayersModal.classList.add("hidden");

editPlayersSave.onclick = async () => {
  state.players = editDraftPlayers.map((p) => ({ ...p }));
  await saveRoom();
  editPlayersModal.classList.add("hidden");
  renderGame();
};

/* ---------- Ver progreso ---------- */
progressBtn.onclick = () => {
  const stats = computeStats();
  const numRounds = state.rounds.length;

  progressEmpty.classList.toggle("hidden", numRounds > 0);

  if (progressChart) {
    progressChart.destroy();
    progressChart = null;
  }

  if (numRounds > 0) {
    const labels = ["Salida"];
    for (let r = 1; r <= numRounds; r++) labels.push("R" + r);

    const palette = ["#14532d", "#b3261e", "#d4a24c", "#2563eb", "#7c3aed", "#0f766e", "#c2410c", "#334155"];
    const datasets = state.players.map((p, i) => {
      const s = stats[p.id];
      const data = [p.startingScore || 0, ...s.history.map((v) => (v === null ? null : v))];
      return {
        label: p.name,
        data,
        borderColor: palette[i % palette.length],
        backgroundColor: palette[i % palette.length],
        spanGaps: true,
        tension: 0.25
      };
    });

    progressChart = new Chart(progressChartCanvas, {
      type: "line",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } },
        scales: { y: { title: { display: true, text: "Puntos acumulados" } } }
      }
    });
  }

  progressModal.classList.remove("hidden");
};

progressClose.onclick = () => progressModal.classList.add("hidden");

/* ---------- Reglas ---------- */
rulesBtn.onclick = () => rulesModal.classList.remove("hidden");
rulesClose.onclick = () => rulesModal.classList.add("hidden");

/* ---------- Cargar desde URL ---------- */
function loadFromUrl() {
  const params = new URLSearchParams(location.search);
  const room = params.get("room");
  const mode = params.get("mode");

  if (!room || room === "null") {
    welcome.classList.remove("hidden");
    game.classList.add("hidden");
    return;
  }

  state.roomCode = room.toLowerCase();
  state.urlMode = mode === "view" ? "view" : "edit";

  subscribeRoom(state.roomCode);
  showGame();
}

loadFromUrl();
