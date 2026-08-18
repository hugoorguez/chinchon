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
  urlMode: "edit",
  theme: "felt"
};

const THEMES = [
  { id: "felt", name: "Fieltro clásico" },
  { id: "ocean", name: "Azul océano" },
  { id: "wine", name: "Vino tinto" },
  { id: "noir", name: "Casino noir" }
];

function applyTheme(themeId) {
  document.documentElement.dataset.theme = themeId;
  const t = THEMES.find((x) => x.id === themeId) || THEMES[0];
  if (themeName) themeName.textContent = t.name;
}

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
const themeBtn = document.getElementById("themeBtn");
const themeName = document.getElementById("themeName");

const roomCodeTitle = document.getElementById("roomCodeTitle");
const scoreTableHeadRow1 = document.getElementById("scoreTableHeadRow1");
const scoreTableHeadRow2 = document.getElementById("scoreTableHeadRow2");
const scoreTableBody = document.querySelector("#scoreTable tbody");
const emptyState = document.getElementById("emptyState");
const viewBadge = document.getElementById("viewBadge");
const finishedBanner = document.getElementById("finishedBanner");
const finishedActions = document.getElementById("finishedActions");
const newGameBtn = document.getElementById("newGameBtn");
const newGameSamePlayersBtn = document.getElementById("newGameSamePlayersBtn");

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
const shareViewOnlyNote = document.getElementById("shareViewOnlyNote");

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
const rulesSettings = document.getElementById("rulesSettings");
const rulesMaxInput = document.getElementById("rulesMaxInput");
const rulesUseReenganches = document.getElementById("rulesUseReenganches");
const rulesSave = document.getElementById("rulesSave");

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

/*
 Recorre las rondas y calcula, ronda a ronda:
 - el total de cada jugador
 - si algún jugador supera el máximo esa ronda:
     - con reenganches: suma un reenganche y su puntuación baja hasta igualar
       la más alta entre los jugadores que NO han superado el máximo esa ronda
     - sin reenganches: el jugador queda eliminado (se congela su puntuación)
 - si TODOS los jugadores en juego superan el máximo en la misma ronda, la
   partida se da por finalizada en ese punto (ya no hay a quién "engancharse")
*/
function computeStats() {
  const totals = {};
  const reenganchesCount = {};
  const eliminated = {};
  state.players.forEach((p) => {
    totals[p.id] = p.startingScore || 0;
    reenganchesCount[p.id] = 0;
    eliminated[p.id] = false;
  });

  const roundMeta = []; // roundMeta[r] = { playerId: {before, value, raw, final, reenganched} }
  let gameFinished = false;
  let finishedAtRound = null;

  for (let r = 0; r < state.rounds.length; r++) {
    if (gameFinished) break;
    const round = state.rounds[r];

    const activePlayers = state.players.filter((p) => !eliminated[p.id]);
    const rawTotals = {};
    const considered = [];
    activePlayers.forEach((p) => {
      const val = round[p.id];
      if (val === undefined || val === null) return; // no jugó esa ronda (se unió después)
      rawTotals[p.id] = totals[p.id] + val;
      considered.push(p);
    });

    if (considered.length === 0) {
      roundMeta.push({});
      continue;
    }

    const crossing = considered.filter((p) => rawTotals[p.id] >= state.maxPoints);
    const nonCrossing = considered.filter((p) => rawTotals[p.id] < state.maxPoints);
    const meta = {};

    if (crossing.length > 0 && nonCrossing.length <= 1) {
      // Gana la partida quien no llega al máximo cuando TODOS los demás sí llegan a la vez
      // (esto vale igual con o sin reenganches: los reenganches previos no importan aquí).
      // Si nonCrossing.length === 0, nadie sobrevive: se desempata por menor puntuación.
      considered.forEach((p) => {
        meta[p.id] = { before: totals[p.id], value: round[p.id], raw: rawTotals[p.id], final: rawTotals[p.id], reenganched: false };
        totals[p.id] = rawTotals[p.id];
      });
      roundMeta.push(meta);
      gameFinished = true;
      finishedAtRound = r;
      break;
    }

    if (crossing.length === 0) {
      // Nadie llega al máximo esta ronda: ronda normal
      considered.forEach((p) => {
        meta[p.id] = { before: totals[p.id], value: round[p.id], raw: rawTotals[p.id], final: rawTotals[p.id], reenganched: false };
        totals[p.id] = rawTotals[p.id];
      });
      roundMeta.push(meta);
      continue;
    }

    // Dos o más jugadores siguen por debajo del máximo: la partida continúa
    const nonCrossingMax = Math.max(...nonCrossing.map((p) => rawTotals[p.id]));

    considered.forEach((p) => {
      const raw = rawTotals[p.id];
      if (raw >= state.maxPoints) {
        if (state.useReenganches) {
          reenganchesCount[p.id]++;
          meta[p.id] = { before: totals[p.id], value: round[p.id], raw, final: nonCrossingMax, reenganched: true };
          totals[p.id] = nonCrossingMax;
        } else {
          eliminated[p.id] = true;
          meta[p.id] = { before: totals[p.id], value: round[p.id], raw, final: raw, reenganched: false };
          totals[p.id] = raw;
        }
      } else {
        meta[p.id] = { before: totals[p.id], value: round[p.id], raw, final: raw, reenganched: false };
        totals[p.id] = raw;
      }
    });

    roundMeta.push(meta);
  }

  const numRounds = gameFinished ? finishedAtRound + 1 : state.rounds.length;

  const byPlayer = {};
  state.players.forEach((p) => {
    byPlayer[p.id] = {
      total: totals[p.id],
      reenganches: reenganchesCount[p.id],
      eliminated: eliminated[p.id]
    };
  });

  return { byPlayer, roundMeta, gameFinished, numRounds };
}

themeBtn.onclick = () => {
  const idx = THEMES.findIndex((t) => t.id === state.theme);
  const next = THEMES[(idx + 1) % THEMES.length];
  state.theme = next.id;
  applyTheme(state.theme);
};

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
    use_reenganches: state.useReenganches,
    theme: state.theme
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
  editPlayersBtn.classList.toggle("hidden", !editable);
  viewBadge.classList.toggle("hidden", editable);

  renderGame();
}

/* ---------- Render tabla histórica ---------- */
function renderGame() {
  const stats = computeStats();
  const numRounds = stats.numRounds;

  const editable = isEditable();
  openApuntar.disabled = !editable || stats.gameFinished;
  openApuntar.textContent = stats.gameFinished ? "🏁 Partida finalizada" : "✏️ Apuntar ronda";

  if (stats.gameFinished) {
    let winner = null;
    state.players.forEach((p) => {
      const t = stats.byPlayer[p.id].total;
      if (!winner || t < stats.byPlayer[winner.id].total) winner = p;
    });
    finishedBanner.textContent = winner
      ? `🏁 Partida finalizada — gana ${winner.name} con ${stats.byPlayer[winner.id].total} puntos`
      : "🏁 Partida finalizada";
    finishedBanner.classList.remove("hidden");
    finishedActions.classList.toggle("hidden", !editable);
  } else {
    finishedBanner.classList.add("hidden");
    finishedActions.classList.add("hidden");
  }

  // ---- Cabecera ----
  scoreTableHeadRow1.innerHTML = "";
  scoreTableHeadRow2.innerHTML = "";

  const thJugador = document.createElement("th");
  thJugador.textContent = "Jugador";
  thJugador.rowSpan = numRounds > 0 ? 2 : 1;
  thJugador.className = "th-player";
  scoreTableHeadRow1.appendChild(thJugador);

  const thPuntuacion = document.createElement("th");
  thPuntuacion.textContent = "Puntuación";
  thPuntuacion.rowSpan = numRounds > 0 ? 2 : 1;
  scoreTableHeadRow1.appendChild(thPuntuacion);

  const thReenganches = document.createElement("th");
  thReenganches.textContent = "Reenganches";
  thReenganches.rowSpan = numRounds > 0 ? 2 : 1;
  scoreTableHeadRow1.appendChild(thReenganches);

  if (numRounds > 0) {
    const thGroup = document.createElement("th");
    thGroup.textContent = "Rondas anteriores";
    thGroup.colSpan = numRounds;
    thGroup.className = "th-group";
    scoreTableHeadRow1.appendChild(thGroup);

    for (let r = numRounds; r >= 1; r--) {
      const th = document.createElement("th");
      th.textContent = "R" + r;
      scoreTableHeadRow2.appendChild(th);
    }
  }

  // ---- Filas ----
  scoreTableBody.innerHTML = "";
  state.players.forEach((p) => {
    const s = stats.byPlayer[p.id];
    const tr = document.createElement("tr");

    const tdName = document.createElement("td");
    tdName.textContent = p.name;
    if (stats.gameFinished) {
      const isWinner = state.players.every((other) => stats.byPlayer[other.id].total >= s.total);
      if (isWinner) tdName.classList.add("winner-name");
    }
    tr.appendChild(tdName);

    const tdPuntuacion = document.createElement("td");
    tdPuntuacion.className = "cell-total";
    tdPuntuacion.textContent = s.eliminated ? "Eliminado" : s.total;
    if (s.eliminated) tdPuntuacion.classList.add("cell-eliminated");
    tr.appendChild(tdPuntuacion);

    const tdRe = document.createElement("td");
    tdRe.textContent = s.reenganches;
    tr.appendChild(tdRe);

    for (let r = numRounds; r >= 1; r--) {
      const td = document.createElement("td");
      const meta = stats.roundMeta[r - 1] ? stats.roundMeta[r - 1][p.id] : undefined;
      if (!meta) {
        td.textContent = "–";
        td.className = "cell-muted";
      } else {
        td.textContent = meta.value;
        if (meta.value < 0) td.classList.add("cell-negative");
        if (meta.reenganched) {
          const badge = document.createElement("span");
          badge.className = "reenganche-badge";
          badge.textContent = "↺";
          badge.title = `Con esos puntos llegó a ${meta.raw} y se reenganchó, bajando a ${meta.final}`;
          td.appendChild(badge);
        }
      }
      tr.appendChild(td);
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
  state.theme = data.theme || "felt";
  applyTheme(state.theme);
  // OJO: el modo (edit/view) NUNCA se toma de la base de datos, solo de la URL local.
  renderGame();
}

async function saveRoom() {
  await supabase.from("rooms").update({
    players: state.players,
    rounds: state.rounds,
    max_points: state.maxPoints,
    use_reenganches: state.useReenganches,
    theme: state.theme
  }).eq("id", state.roomCode);
}

/* ---------- Apuntar ronda ---------- */
openApuntar.onclick = () => {
  if (!isEditable()) return alert("Estás en modo solo ver, no puedes apuntar rondas");
  const stats = computeStats();
  if (stats.gameFinished) return;

  apuntarList.innerHTML = "";
  state.players.forEach((p) => {
    if (stats.byPlayer[p.id].eliminated) return; // los eliminados no juegan más rondas
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
  shareResult.classList.add("hidden");
  qrContainer.innerHTML = "";
  const editable = isEditable();
  shareEdit.classList.toggle("hidden", !editable);
  shareViewOnlyNote.classList.toggle("hidden", editable);
  shareModal.classList.remove("hidden");
};

function buildLink(mode) {
  return `${location.origin}${location.pathname}?room=${state.roomCode}&mode=${mode}`;
}

shareEdit.onclick = () => {
  if (!isEditable()) return;
  const link = buildLink("edit");
  shareResult.textContent = link;
  shareResult.classList.remove("hidden");
  qrContainer.innerHTML = "";
  QRCode.toCanvas(link, { width: 160 }, (_, canvas) => qrContainer.appendChild(canvas));
};

shareView.onclick = () => {
  const link = buildLink("view");
  shareResult.textContent = link;
  shareResult.classList.remove("hidden");
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
    const t = stats.byPlayer[p.id].eliminated ? 0 : stats.byPlayer[p.id].total;
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

    const orderDiv = document.createElement("div");
    orderDiv.className = "order-btns";
    const upBtn = document.createElement("button");
    upBtn.type = "button";
    upBtn.className = "icon-btn";
    upBtn.textContent = "▲";
    upBtn.disabled = idx === 0;
    upBtn.onclick = () => {
      [editDraftPlayers[idx - 1], editDraftPlayers[idx]] = [editDraftPlayers[idx], editDraftPlayers[idx - 1]];
      renderEditPlayersList();
    };
    const downBtn = document.createElement("button");
    downBtn.type = "button";
    downBtn.className = "icon-btn";
    downBtn.textContent = "▼";
    downBtn.disabled = idx === editDraftPlayers.length - 1;
    downBtn.onclick = () => {
      [editDraftPlayers[idx + 1], editDraftPlayers[idx]] = [editDraftPlayers[idx], editDraftPlayers[idx + 1]];
      renderEditPlayersList();
    };
    orderDiv.appendChild(upBtn);
    orderDiv.appendChild(downBtn);

    const nameInput = document.createElement("input");
    nameInput.className = "name-input";
    nameInput.value = p.name;
    nameInput.oninput = () => {
      editDraftPlayers[idx].name = nameInput.value;
    };

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "icon-btn icon-btn--danger";
    delBtn.textContent = "✕";
    delBtn.onclick = () => {
      editDraftPlayers.splice(idx, 1);
      renderEditPlayersList();
    };

    li.appendChild(orderDiv);
    li.appendChild(nameInput);
    li.appendChild(delBtn);
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
  const names = editDraftPlayers.map((p) => p.name.trim());
  if (names.some((n) => !n)) return alert("Ningún jugador puede tener el nombre vacío");

  state.players = editDraftPlayers.map((p) => ({ ...p, name: p.name.trim() }));
  await saveRoom();
  editPlayersModal.classList.add("hidden");
  renderGame();
};

/* ---------- Ver progreso ---------- */
progressBtn.onclick = () => {
  const stats = computeStats();
  const numRounds = stats.numRounds;

  progressEmpty.classList.toggle("hidden", numRounds > 0);

  if (progressChart) {
    progressChart.destroy();
    progressChart = null;
  }

  if (numRounds > 0) {
    const palette = ["#14532d", "#b3261e", "#d4a24c", "#2563eb", "#7c3aed", "#0f766e", "#c2410c", "#334155"];

    const labels = ["Inicio"];
    for (let r = 1; r <= numRounds; r++) labels.push("R" + r);

    const datasets = state.players.map((p, i) => {
      const color = palette[i % palette.length];
      const data = [p.startingScore || 0];
      const pointRadius = [3];
      const pointStyle = ["circle"];
      const pointColor = [color];
      const roundInfo = [null]; // info extra por punto, para el tooltip

      for (let r = 1; r <= numRounds; r++) {
        const meta = stats.roundMeta[r - 1] ? stats.roundMeta[r - 1][p.id] : undefined;
        const val = meta ? meta.final : null;
        data.push(val);
        roundInfo.push(meta || null);

        if (meta && meta.reenganched) {
          pointRadius.push(8);
          pointStyle.push("star");
          pointColor.push("#d4a24c");
        } else {
          pointRadius.push(3);
          pointStyle.push("circle");
          pointColor.push(color);
        }
      }

      return {
        label: p.name,
        data,
        borderColor: color,
        backgroundColor: color,
        pointRadius,
        pointStyle,
        pointBackgroundColor: pointColor,
        pointBorderColor: pointColor,
        roundInfo,
        spanGaps: true,
        tension: 0.2
      };
    });

    progressChart = new Chart(progressChartCanvas, {
      type: "line",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom" },
          tooltip: {
            callbacks: {
              label: (context) => {
                const info = context.dataset.roundInfo ? context.dataset.roundInfo[context.dataIndex] : null;
                if (info && info.reenganched) {
                  return `${context.dataset.label}: llegó a ${info.raw} y se reenganchó a ${info.final} ↺`;
                }
                return `${context.dataset.label}: ${context.formattedValue}`;
              }
            }
          }
        },
        scales: { y: { title: { display: true, text: "Puntos" } } }
      }
    });
  }

  progressModal.classList.remove("hidden");
};

progressClose.onclick = () => progressModal.classList.add("hidden");

/* ---------- Reglas / ajustes ---------- */
rulesBtn.onclick = () => {
  const editable = isEditable();
  rulesSettings.classList.toggle("hidden", !editable);
  rulesSave.classList.toggle("hidden", !editable);
  rulesMaxInput.value = state.maxPoints;
  rulesUseReenganches.checked = state.useReenganches;
  rulesModal.classList.remove("hidden");
};

rulesClose.onclick = () => rulesModal.classList.add("hidden");

rulesSave.onclick = async () => {
  if (!isEditable()) return;
  let max = parseInt(rulesMaxInput.value, 10);
  if (isNaN(max) || max <= 0) return alert("Pon un máximo de puntos válido");

  state.maxPoints = max;
  state.useReenganches = rulesUseReenganches.checked;
  await saveRoom();
  rulesModal.classList.add("hidden");
  renderGame();
};

/* ---------- Nueva partida al terminar ---------- */
function goToWelcome(prefillPlayers) {
  if (subscription) {
    subscription.unsubscribe();
    subscription = null;
  }

  const keptMax = state.maxPoints;
  const keptReenganches = state.useReenganches;

  state = {
    roomCode: null,
    players: [],
    rounds: [],
    maxPoints: keptMax,
    useReenganches: keptReenganches,
    urlMode: "edit"
  };

  if (prefillPlayers) {
    state.players = prefillPlayers.map((p) => ({ id: genId(), name: p.name, startingScore: 0 }));
  }

  codeInput.value = "";
  maxInput.value = keptMax;
  useReenganches.checked = keptReenganches;
  renderPlayerList();

  const url = new URL(location.href);
  url.searchParams.delete("room");
  url.searchParams.delete("mode");
  history.replaceState(null, "", url);

  game.classList.add("hidden");
  welcome.classList.remove("hidden");
}

newGameBtn.onclick = () => goToWelcome(null);
newGameSamePlayersBtn.onclick = () => goToWelcome(state.players);

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
