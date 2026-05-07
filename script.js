const youtubeInput = document.getElementById("youtubeInput");
const addVideoBtn = document.getElementById("addVideoBtn");
const addSampleBtn = document.getElementById("addSampleBtn");
const clearAllBtn = document.getElementById("clearAllBtn");
const dropZone = document.getElementById("dropZone");
const videoGrid = document.getElementById("videoGrid");
const videoCount = document.getElementById("videoCount");

const playAllBtn = document.getElementById("playAllBtn");
const pauseAllBtn = document.getElementById("pauseAllBtn");
const muteAllBtn = document.getElementById("muteAllBtn");
const unmuteAllBtn = document.getElementById("unmuteAllBtn");
const globalVolume = document.getElementById("globalVolume");
const globalVolumeLabel = document.getElementById("globalVolumeLabel");

const saveLayoutBtn = document.getElementById("saveLayoutBtn");
const loadLayoutBtn = document.getElementById("loadLayoutBtn");
const clearSavedBtn = document.getElementById("clearSavedBtn");
const savedLayoutCount = document.getElementById("savedLayoutCount");

const syncStartBtn = document.getElementById("syncStartBtn");
const themeToggleBtn = document.getElementById("themeToggleBtn");
const themeLabel = document.getElementById("themeLabel");
const ABOUT_BOX_KEY = "multiplyyt-about-box-hidden";

const STORAGE_KEY = "multiplyyt-layout";
const THEME_KEY = "multiplyyt-theme";
const MAX_VIDEOS = 10;

let videos = [];
let players = {};
let youtubeApiReady = false;
let globalState = {
  volume: 50,
  muted: false
};

function makeId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `video-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function extractVideoId(url) {
  if (!url) return null;

  const trimmed = url.trim();

  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) return match[1];
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.searchParams.get("v");
      if (id && id.length === 11) return id;
    }
  } catch {
    return null;
  }

  return null;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function getVideoById(id) {
  return videos.find((video) => video.id === id);
}

function getPanelElement(id) {
  return document.querySelector(`[data-panel-id="${id}"]`);
}

function updateCounts() {
  videoCount.textContent = `${videos.length} / ${MAX_VIDEOS}`;
  updateSavedLayoutCount();
}

function renderEmptyState() {
  if (videos.length > 0) return;

  videoGrid.innerHTML = `
    <div class="empty-state" id="emptyState">
      <strong>No videos added yet</strong>
      Drag in a YouTube link or paste one above to start your simultaneous video wall.
    </div>
  `;
}

function removeEmptyStateIfNeeded() {
  const emptyState = document.getElementById("emptyState");
  if (emptyState) {
    emptyState.remove();
  }
}

function updatePanelMetadata() {
  const panels = Array.from(videoGrid.querySelectorAll("[data-panel-id]"));

  panels.forEach((panel, index) => {
    const id = panel.dataset.panelId;
    const video = getVideoById(id);
    if (!video) return;

    const title = panel.querySelector(".video-title");
    const urlNode = panel.querySelector(".video-url");
    const removeBtn = panel.querySelector("[data-remove-id]");
    const playBtn = panel.querySelector("[data-play-one]");
    const pauseBtn = panel.querySelector("[data-pause-one]");
    const restartBtn = panel.querySelector("[data-restart-one]");
    const muteBtn = panel.querySelector("[data-mute-one]");
    const unmuteBtn = panel.querySelector("[data-unmute-one]");
    const iframeHost = panel.querySelector(".video-player");

    if (title) {
      title.textContent = `Video ${index + 1}`;
      title.title = video.originalUrl;
    }

    if (urlNode) {
      urlNode.textContent = video.originalUrl;
    }

    if (removeBtn) {
      removeBtn.dataset.removeId = id;
      removeBtn.setAttribute("aria-label", `Remove video ${index + 1}`);
    }

    if (playBtn) playBtn.dataset.playOne = id;
    if (pauseBtn) pauseBtn.dataset.pauseOne = id;
    if (restartBtn) restartBtn.dataset.restartOne = id;
    if (muteBtn) muteBtn.dataset.muteOne = id;
    if (unmuteBtn) unmuteBtn.dataset.unmuteOne = id;

    if (iframeHost) {
      iframeHost.setAttribute("aria-label", `YouTube video player ${index + 1}`);
    }
  });
}

function createPlayerForVideo(video) {
  if (!youtubeApiReady) return;
  if (players[video.id]) return;

  players[video.id] = new YT.Player(`player-${video.id}`, {
    videoId: video.videoId,
    playerVars: {
      autoplay: 1,
      controls: 1,
      rel: 0,
      modestbranding: 1,
      playsinline: 1,
      loop: 1,
      playlist: video.videoId
    },
    events: {
      onReady: (event) => {
        event.target.setVolume(globalState.volume);

        if (globalState.muted) {
          event.target.mute();
        } else {
          event.target.unMute();
        }

        event.target.playVideo();
      },
      onStateChange: (event) => {
        if (event.data === YT.PlayerState.ENDED) {
          event.target.seekTo(0, true);
          event.target.playVideo();
        }
      }
    }
  });
}

function bindPanelButtons(panel) {
  const removeBtn = panel.querySelector("[data-remove-id]");
  const playBtn = panel.querySelector("[data-play-one]");
  const pauseBtn = panel.querySelector("[data-pause-one]");
  const restartBtn = panel.querySelector("[data-restart-one]");
  const muteBtn = panel.querySelector("[data-mute-one]");
  const unmuteBtn = panel.querySelector("[data-unmute-one]");

  removeBtn.addEventListener("click", () => removeVideo(removeBtn.dataset.removeId));

  playBtn.addEventListener("click", () => {
    const player = players[playBtn.dataset.playOne];
    if (player?.playVideo) player.playVideo();
  });

  pauseBtn.addEventListener("click", () => {
    const player = players[pauseBtn.dataset.pauseOne];
    if (player?.pauseVideo) player.pauseVideo();
  });

  restartBtn.addEventListener("click", () => {
    const player = players[restartBtn.dataset.restartOne];
    if (player?.seekTo) {
      player.seekTo(0, true);
      player.playVideo();
    }
  });

  muteBtn.addEventListener("click", () => {
    const player = players[muteBtn.dataset.muteOne];
    if (player?.mute) player.mute();
  });

  unmuteBtn.addEventListener("click", () => {
    const player = players[unmuteBtn.dataset.unmuteOne];
    if (player?.unMute) {
      player.unMute();
      if (player.setVolume) player.setVolume(globalState.volume);
    }
  });
}

function createPanel(video) {
  const article = document.createElement("article");
  article.className = "video-panel";
  article.dataset.panelId = video.id;

  article.innerHTML = `
    <div class="video-head">
      <div>
        <div class="video-title" title="${escapeHtml(video.originalUrl)}">Video</div>
        <div class="panel-action-row">
          <span class="pill">Looping</span>
        </div>
      </div>

      <div class="video-controls">
        <button class="icon-btn" data-remove-id="${video.id}" aria-label="Remove video">Remove</button>
      </div>
    </div>

    <div class="video-wrap">
      <div
        class="video-player"
        id="player-${video.id}"
        aria-label="YouTube video player"
      ></div>
    </div>

    <div class="video-url">${escapeHtml(video.originalUrl)}</div>

    <div class="panel-footer">
      <div class="panel-action-row">
        <button class="icon-btn" data-play-one="${video.id}">Play</button>
        <button class="icon-btn" data-pause-one="${video.id}">Pause</button>
        <button class="icon-btn" data-restart-one="${video.id}">Restart</button>
        <button class="icon-btn" data-mute-one="${video.id}">Mute</button>
        <button class="icon-btn" data-unmute-one="${video.id}">Unmute</button>
      </div>
    </div>
  `;

  bindPanelButtons(article);
  return article;
}

function addVideo(url) {
  if (videos.length >= MAX_VIDEOS) {
    alert(`MultiplyYt supports up to ${MAX_VIDEOS} videos at once.`);
    return;
  }

  const videoId = extractVideoId(url);

  if (!videoId) {
    alert("That does not look like a valid YouTube link.");
    return;
  }

  const alreadyExists = videos.some((video) => video.videoId === videoId);
  if (alreadyExists) {
    alert("That video is already in your MultiplyYt grid.");
    return;
  }

  const video = {
    id: makeId(),
    videoId,
    originalUrl: url.trim()
  };

  videos.unshift(video);

  removeEmptyStateIfNeeded();

  const panel = createPanel(video);
  videoGrid.prepend(panel);

  if (youtubeApiReady) {
    createPlayerForVideo(video);
  }

  youtubeInput.value = "";
  updateCounts();
  updatePanelMetadata();
}

function removeVideo(id) {
  if (players[id] && typeof players[id].destroy === "function") {
    players[id].destroy();
  }

  delete players[id];
  videos = videos.filter((video) => video.id !== id);

  const panel = getPanelElement(id);
  if (panel) {
    panel.remove();
  }

  updateCounts();
  updatePanelMetadata();
  renderEmptyState();
}

function clearAllVideos() {
  const confirmed = confirm("Remove all videos from MultiplyYt?");
  if (!confirmed) return;

  Object.values(players).forEach((player) => {
    if (player && typeof player.destroy === "function") {
      player.destroy();
    }
  });

  players = {};
  videos = [];
  videoGrid.innerHTML = "";
  updateCounts();
  renderEmptyState();
}

function rebuildGridFromVideos() {
  videoGrid.innerHTML = "";

  if (!videos.length) {
    renderEmptyState();
    updateCounts();
    return;
  }

  videos.forEach((video) => {
    const panel = createPanel(video);
    videoGrid.appendChild(panel);
  });

  updateCounts();
  updatePanelMetadata();

  if (youtubeApiReady) {
    videos.forEach((video) => createPlayerForVideo(video));
  }
}

function playAllVideos() {
  Object.values(players).forEach((player) => {
    if (player?.playVideo) player.playVideo();
  });
}

function pauseAllVideos() {
  Object.values(players).forEach((player) => {
    if (player?.pauseVideo) player.pauseVideo();
  });
}

function muteAllVideos() {
  globalState.muted = true;
  Object.values(players).forEach((player) => {
    if (player?.mute) player.mute();
  });
}

function unmuteAllVideos() {
  globalState.muted = false;
  Object.values(players).forEach((player) => {
    if (player?.unMute) {
      player.unMute();
      if (player.setVolume) player.setVolume(globalState.volume);
    }
  });
}

function setGlobalVolume(value) {
  globalState.volume = Number(value);
  globalVolumeLabel.textContent = `${globalState.volume}%`;

  Object.values(players).forEach((player) => {
    if (player?.setVolume) player.setVolume(globalState.volume);
  });
}

function syncStartTime() {
  Object.values(players).forEach((player) => {
    if (player?.seekTo) player.seekTo(0, true);
  });

  setTimeout(() => {
    playAllVideos();
  }, 150);
}

function saveLayout() {
  const payload = {
    videos,
    globalState
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  updateSavedLayoutCount();
  alert("MultiplyYt layout saved.");
}

function loadLayout() {
  const raw = localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    alert("No saved layout found.");
    return;
  }

  try {
    const parsed = JSON.parse(raw);

    Object.values(players).forEach((player) => {
      if (player?.destroy) player.destroy();
    });

    players = {};
    videos = Array.isArray(parsed.videos) ? parsed.videos : [];
    globalState = {
      volume: Number(parsed.globalState?.volume ?? 50),
      muted: Boolean(parsed.globalState?.muted ?? false)
    };

    if (videos.length > MAX_VIDEOS) {
      videos = videos.slice(0, MAX_VIDEOS);
    }

    globalVolume.value = String(globalState.volume);
    globalVolumeLabel.textContent = `${globalState.volume}%`;

    rebuildGridFromVideos();
  } catch {
    alert("Saved layout could not be loaded.");
  }
}

function clearSavedLayout() {
  const exists = localStorage.getItem(STORAGE_KEY);
  if (!exists) {
    alert("There is no saved layout to clear.");
    return;
  }

  const confirmed = confirm("Delete your saved MultiplyYt layout?");
  if (!confirmed) return;

  localStorage.removeItem(STORAGE_KEY);
  updateSavedLayoutCount();
}

function updateSavedLayoutCount() {
  savedLayoutCount.textContent = localStorage.getItem(STORAGE_KEY) ? "1" : "0";
}

function applyTheme(theme) {
  const safeTheme = theme === "light" ? "light" : "dark";
  document.body.setAttribute("data-theme", safeTheme);
  localStorage.setItem(THEME_KEY, safeTheme);
  themeLabel.textContent = safeTheme.charAt(0).toUpperCase() + safeTheme.slice(1);
}

function toggleTheme() {
  const current = document.body.getAttribute("data-theme");
  applyTheme(current === "dark" ? "light" : "dark");
}

function loadTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY) || "dark";
  applyTheme(savedTheme);
}

function handleSubmit() {
  addVideo(youtubeInput.value);
}

addVideoBtn.addEventListener("click", handleSubmit);

youtubeInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    handleSubmit();
  }
});

clearAllBtn.addEventListener("click", clearAllVideos);

addSampleBtn.addEventListener("click", () => {
  addVideo("https://www.youtube.com/watch?v=jNQXAC9IVRw");
});

playAllBtn.addEventListener("click", playAllVideos);
pauseAllBtn.addEventListener("click", pauseAllVideos);
muteAllBtn.addEventListener("click", muteAllVideos);
unmuteAllBtn.addEventListener("click", unmuteAllVideos);

globalVolume.addEventListener("input", (event) => {
  setGlobalVolume(event.target.value);
});

saveLayoutBtn.addEventListener("click", saveLayout);
loadLayoutBtn.addEventListener("click", loadLayout);
clearSavedBtn.addEventListener("click", clearSavedLayout);
syncStartBtn.addEventListener("click", syncStartTime);
themeToggleBtn.addEventListener("click", toggleTheme);

dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("dragover");
});

dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("dragover");

  const droppedText = event.dataTransfer.getData("text");
  if (droppedText) addVideo(droppedText);
});

dropZone.addEventListener("click", () => {
  youtubeInput.focus();
});

dropZone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    youtubeInput.focus();
  }
});

window.onYouTubeIframeAPIReady = function () {
  youtubeApiReady = true;
  videos.forEach((video) => createPlayerForVideo(video));
};

const aboutBox = document.getElementById("aboutBox");
const closeAboutBtn = document.getElementById("closeAboutBtn");
const showAboutWrap = document.getElementById("showAboutWrap");
const showAboutBtn = document.getElementById("showAboutBtn");

function setAboutBoxVisibility(isHidden) {
  if (!aboutBox || !showAboutWrap) return;

  if (isHidden) {
    aboutBox.classList.add("about-hidden");
    showAboutWrap.classList.remove("hidden");
    localStorage.setItem(ABOUT_BOX_KEY, "true");
  } else {
    aboutBox.classList.remove("about-hidden");
    showAboutWrap.classList.add("hidden");
    localStorage.setItem(ABOUT_BOX_KEY, "false");
  }
}

function loadAboutBoxState() {
  if (!aboutBox || !showAboutWrap) return;

  const savedState = localStorage.getItem(ABOUT_BOX_KEY);
  const isHidden = savedState === "true";

  if (isHidden) {
    aboutBox.classList.add("about-hidden");
    showAboutWrap.classList.remove("hidden");
  } else {
    aboutBox.classList.remove("about-hidden");
    showAboutWrap.classList.add("hidden");
  }
}

if (aboutBox && closeAboutBtn && showAboutWrap && showAboutBtn) {
  closeAboutBtn.addEventListener("click", () => {
    setAboutBoxVisibility(true);
  });

  showAboutBtn.addEventListener("click", () => {
    setAboutBoxVisibility(false);
  });

  loadAboutBoxState();
}

loadTheme();
setGlobalVolume(globalVolume.value);
updateSavedLayoutCount();
renderEmptyState();
updateCounts();
updatePanelMetadata();
window.toggleTheme = toggleTheme;
