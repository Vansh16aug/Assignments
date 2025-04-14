// DOM Elements
const audioPlayer = document.getElementById("audioPlayer");
const playBtn = document.getElementById("playBtn");
const playIcon = document.getElementById("playIcon");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const seekSlider = document.getElementById("seekSlider");
const progressFill = document.getElementById("progressFill");
const currentTimeEl = document.getElementById("currentTime");
const durationEl = document.getElementById("duration");
const volumeSlider = document.getElementById("volumeSlider");
const playlistEl = document.getElementById("playlist");
const nowPlayingEl = document.getElementById("nowPlaying");
const artistEl = document.getElementById("artist");
const bufferingOverlay = document.getElementById("bufferingOverlay");
const visualizer = document.getElementById("visualizer");
const debugContent = document.getElementById("debugContent");

// Enable debug mode (shows network activity)
document.body.classList.add("debug");

// Player state
let songs = [];
let currentSongIndex = 0;
let isPlaying = false;
let visualizerBars = [];
let isLoadingChunk = false;
let currentSong = null;
let lastLoadedPosition = 0;
let loadingTimer = null;

// Create visualizer
function createVisualizer() {
  const barsCount = 30;
  visualizer.innerHTML = "";
  visualizerBars = [];

  for (let i = 0; i < barsCount; i++) {
    const bar = document.createElement("div");
    bar.className = "visualizer-bar";
    bar.style.height = "5px";
    visualizer.appendChild(bar);
    visualizerBars.push(bar);
  }
}

// Animate visualizer (fake implementation)
function animateVisualizer() {
  if (!isPlaying) {
    visualizerBars.forEach((bar) => {
      bar.style.height = "5px";
    });
    return;
  }

  visualizerBars.forEach((bar) => {
    const height = Math.floor(Math.random() * 80) + 5;
    bar.style.height = `${height}px`;
  });

  if (isPlaying) {
    requestAnimationFrame(() => {
      setTimeout(animateVisualizer, 100);
    });
  }
}

// Load songs from server
async function loadSongs() {
  try {
    const response = await fetch("http://localhost:3000/api/songs");
    if (!response.ok) throw new Error("Failed to fetch songs");

    songs = await response.json();
    renderPlaylist();
    logNetworkActivity("Songs loaded successfully");
  } catch (error) {
    console.error("Error loading songs:", error);
    nowPlayingEl.textContent = "Failed to load songs";
    logNetworkActivity(`Error: ${error.message}`);
  }
}

// Render playlist
function renderPlaylist() {
  playlistEl.innerHTML = "";

  songs.forEach((song, index) => {
    const li = document.createElement("li");
    li.textContent = song.title;
    li.dataset.index = index;

    if (index === currentSongIndex) {
      li.classList.add("active");
    }

    li.addEventListener("click", () => {
      playSong(index);
    });

    playlistEl.appendChild(li);
  });
}

// Format time (MM:SS)
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

// Update progress UI
function updateProgress() {
  const { currentTime, duration } = audioPlayer;

  if (duration) {
    // Update slider and progress bar
    const progressPercent = (currentTime / duration) * 100;
    progressFill.style.width = `${progressPercent}%`;
    seekSlider.value = progressPercent;

    // Update time displays
    currentTimeEl.textContent = formatTime(currentTime);
    durationEl.textContent = formatTime(duration);
  }
}

// Get current buffer end time
function getBufferedEndTime() {
  if (!audioPlayer.buffered.length) return 0;

  // Find the buffer range that contains current time
  for (let i = 0; i < audioPlayer.buffered.length; i++) {
    if (
      audioPlayer.currentTime >= audioPlayer.buffered.start(i) &&
      audioPlayer.currentTime <= audioPlayer.buffered.end(i)
    ) {
      return audioPlayer.buffered.end(i);
    }
  }

  // If no matching buffer range, return the end of the last range
  if (audioPlayer.buffered.length > 0) {
    return audioPlayer.buffered.end(audioPlayer.buffered.length - 1);
  }

  return 0;
}

// Delayed check for buffer status
function scheduleBufferCheck() {
  // Clear any existing timer
  if (loadingTimer) {
    clearTimeout(loadingTimer);
  }

  // Set a new timer
  loadingTimer = setTimeout(() => {
    checkBufferAndLoadNextChunk();
  }, 1000); // Check after 1 second
}

// Check buffer and load next chunk if needed
function checkBufferAndLoadNextChunk() {
  if (!audioPlayer.duration || isLoadingChunk || !currentSong || !isPlaying)
    return;

  const bufferedEnd = getBufferedEndTime();
  const bufferedAhead = bufferedEnd - audioPlayer.currentTime;

  // Only load more if buffer is getting low (less than 5 seconds ahead)
  if (bufferedAhead < 5) {
    logNetworkActivity(
      `Buffer low (${bufferedAhead.toFixed(2)}s ahead). Loading next chunk...`
    );
    loadNextChunk(bufferedEnd);
  } else {
    logNetworkActivity(
      `Buffer adequate (${bufferedAhead.toFixed(
        2
      )}s ahead). No chunk needed yet.`
    );
  }

  // Schedule another check in the future
  scheduleBufferCheck();
}

// Load the next chunk of audio
async function loadNextChunk(position) {
  if (isLoadingChunk || !currentSong) return;

  isLoadingChunk = true;
  showBuffering(true);

  try {
    // Estimate byte position based on time position
    // This is a rough estimate - in a real app you might want to use more accurate calculation
    const bytePosition = Math.floor(
      (position * (currentSong.fileSize || 128000)) / audioPlayer.duration
    );

    // Don't request the same chunk twice
    if (bytePosition <= lastLoadedPosition && bytePosition > 0) {
      isLoadingChunk = false;
      showBuffering(false);
      return;
    }

    logNetworkActivity(
      `Requesting next chunk starting at position ${position.toFixed(
        2
      )}s (estimated byte ${bytePosition})`
    );

    // Add timestamp to prevent caching
    const timestamp = new Date().getTime();
    const url = `http://localhost:3000/stream/${currentSong.id}?t=${timestamp}`;

    const response = await fetch(url, {
      headers: {
        Range: `bytes=${bytePosition}-`,
      },
    });

    if (response.status === 206) {
      const rangeHeader = response.headers.get("Content-Range");
      if (rangeHeader) {
        const matches = rangeHeader.match(/bytes (\d+)-(\d+)\/(\d+)/);
        if (matches) {
          const chunkStart = parseInt(matches[1]);
          const chunkEnd = parseInt(matches[2]);
          const totalSize = parseInt(matches[3]);

          // Store file size for more accurate byte calculation
          if (currentSong && totalSize) {
            currentSong.fileSize = totalSize;
          }

          lastLoadedPosition = chunkEnd;
          logNetworkActivity(
            `Loaded chunk: ${rangeHeader} (${
              (chunkEnd - chunkStart + 1) / 1024
            }KB)`
          );
        }
      }

      // Let the browser process the response data
      // This will update the audio buffer automatically
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      // Use a temporary audio element to load the new chunk
      // This avoids interrupting the currently playing audio
      const tempAudio = new Audio();
      tempAudio.src = objectUrl;
      tempAudio.load(); // Force loading the blob

      // When loaded, just release the object URL as the browser has already
      // added the data to the original audio element's source buffer
      tempAudio.onloadeddata = () => {
        URL.revokeObjectURL(objectUrl);
        logNetworkActivity(`Successfully processed chunk data`);
      };

      showBuffering(false);
    } else {
      logNetworkActivity(`Error in chunk request: status ${response.status}`);
      showBuffering(false);
    }
  } catch (error) {
    logNetworkActivity(`Error loading chunk: ${error.message}`);
    showBuffering(false);
  } finally {
    isLoadingChunk = false;
  }
}

// Play song by index
function playSong(index) {
  if (!songs.length || index < 0 || index >= songs.length) return;

  currentSongIndex = index;
  currentSong = songs[currentSongIndex];

  // Reset state
  isLoadingChunk = false;
  lastLoadedPosition = 0;
  if (loadingTimer) {
    clearTimeout(loadingTimer);
    loadingTimer = null;
  }

  // Update UI
  nowPlayingEl.textContent = currentSong.title;
  artistEl.textContent = currentSong.artist || "Unknown Artist";

  // Update playlist active item
  const playlistItems = playlistEl.querySelectorAll("li");
  playlistItems.forEach((item) => item.classList.remove("active"));
  playlistItems[index].classList.add("active");

  // Show buffering
  showBuffering(true);

  // Start with initial chunk only
  const timestamp = new Date().getTime();
  audioPlayer.src = `http://localhost:3000/stream/${currentSong.id}?t=${timestamp}`;

  // Play if already playing
  if (isPlaying) {
    audioPlayer.play().catch(handlePlayError);
  }

  logNetworkActivity(`Loading song: ${currentSong.title}`);
}

// Toggle play/pause
function togglePlay() {
  if (!audioPlayer.src && songs.length > 0) {
    playSong(0);
    isPlaying = false; // Will be toggled below
  }

  if (isPlaying) {
    audioPlayer.pause();
    playIcon.className = "fa-solid fa-play";
    if (loadingTimer) {
      clearTimeout(loadingTimer);
      loadingTimer = null;
    }
  } else {
    showBuffering(true);
    audioPlayer
      .play()
      .then(() => {
        animateVisualizer();
        // Start checking buffer status when playback begins
        scheduleBufferCheck();
      })
      .catch(handlePlayError);
    playIcon.className = "fa-solid fa-pause";
  }

  isPlaying = !isPlaying;
}

// Handle play errors
function handlePlayError(error) {
  console.error("Play error:", error);
  showBuffering(false);
  logNetworkActivity(`Error playing: ${error.message}`);
}

// Show/hide buffering overlay
function showBuffering(show) {
  bufferingOverlay.style.display = show ? "flex" : "none";
}

// Previous song
function prevSong() {
  if (!songs.length) return;
  const newIndex = (currentSongIndex - 1 + songs.length) % songs.length;
  playSong(newIndex);
}

// Next song
function nextSong() {
  if (!songs.length) return;
  const newIndex = (currentSongIndex + 1) % songs.length;
  playSong(newIndex);
}

// Set volume
function setVolume() {
  audioPlayer.volume = volumeSlider.value;
}

// Log network activity for debugging
function logNetworkActivity(message) {
  const timestamp = new Date().toLocaleTimeString();
  const logItem = document.createElement("div");
  logItem.textContent = `[${timestamp}] ${message}`;
  debugContent.appendChild(logItem);
  debugContent.scrollTop = debugContent.scrollHeight;
}

// Event listeners
playBtn.addEventListener("click", togglePlay);
prevBtn.addEventListener("click", prevSong);
nextBtn.addEventListener("click", nextSong);
seekSlider.addEventListener("input", () => {
  const seekTime = (seekSlider.value / 100) * audioPlayer.duration;
  audioPlayer.currentTime = seekTime;
  showBuffering(true);
});
volumeSlider.addEventListener("input", setVolume);

// Audio event listeners
audioPlayer.addEventListener("timeupdate", updateProgress);
audioPlayer.addEventListener("ended", nextSong);
audioPlayer.addEventListener("canplay", () => showBuffering(false));
audioPlayer.addEventListener("waiting", () => {
  showBuffering(true);
  // Try loading more data when waiting
  if (isPlaying) {
    scheduleBufferCheck();
  }
});
audioPlayer.addEventListener("playing", () => {
  showBuffering(false);
  animateVisualizer();
  // Start checking buffer status when playback begins
  scheduleBufferCheck();
});
audioPlayer.addEventListener("pause", () => {
  // Stop visualizer animation
  isPlaying = false;
  // Stop buffer checks when paused
  if (loadingTimer) {
    clearTimeout(loadingTimer);
    loadingTimer = null;
  }
});

// Track buffer progress
audioPlayer.addEventListener("progress", () => {
  // When buffer updates, check if we need more data
  // But don't check too frequently
  if (isPlaying && !loadingTimer) {
    scheduleBufferCheck();
  }
});

// Initialize
createVisualizer();
loadSongs();
setVolume();

// Add this to make audio seek work even if src is not loaded yet
seekSlider.addEventListener("click", (e) => {
  e.stopPropagation();
});
