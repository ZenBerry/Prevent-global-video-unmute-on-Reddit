// content.js
console.log("Reddit Unmute Once: Loaded (Final Simplified)");

// --- State ---
let lastUserInteractionTime = 0;
const observedRoots = new WeakSet();
const trackedVideos = new WeakSet();

// --- Configuration ---
const INTERACTION_THRESHOLD_MS = 200;

// --- Global Interaction Listeners ---
document.addEventListener(
  "click",
  () => {
    lastUserInteractionTime = Date.now();
  },
  true
);
document.addEventListener(
  "keydown",
  () => {
    lastUserInteractionTime = Date.now();
  },
  true
);
document.addEventListener(
  "touchstart",
  () => {
    lastUserInteractionTime = Date.now();
  },
  true
);

// --- Logic ---

function revokeAuthorization(video) {
  if (video.dataset.authorized) {
    delete video.dataset.authorized;
  }
  // "All vids muted by default on play" & "untill... paused"
  // So if we revoke, we also ensure it's muted.
  if (!video.muted) {
    video.muted = true;
  }
}

function handlePlay(e) {
  const video = e.target;
  // "All vids muted by default on play"
  // We treat every play start as a fresh session that requires authorization (Unmute click).
  // This effectively resets checking.
  revokeAuthorization(video);
}

function handlePause(e) {
  const video = e.target;
  // "keep it intact untill the video gets paused"
  revokeAuthorization(video);
}

function handleVolumeChange(e) {
  const video = e.target;

  if (video.muted) {
    // It is muted. We don't care.
    // We technically could clear authorization here too, but handlePlay/Pause does it.
    if (video.dataset.authorized) delete video.dataset.authorized;
    return;
  }

  // Video is UNMUTED.
  // Check if we are already authorized
  if (video.dataset.authorized === "true") {
    // "keep it intact"
    return;
  }

  // Not authorized yet. Check for manual interaction.
  const now = Date.now();
  const isUserInteraction = now - lastUserInteractionTime < INTERACTION_THRESHOLD_MS;

  if (isUserInteraction) {
    // Manual Unmute! Grant authorization.
    video.dataset.authorized = "true";
  } else {
    // Unauthorized (Auto-Unmute) -> Block it.
    video.muted = true;
  }
}

// --- Intersection Observer (Out of Focus) ---
const intersectionObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) {
        // "until... out of focus"
        const video = entry.target;
        revokeAuthorization(video);
      }
    });
  },
  {threshold: 0}
); // Trigger as soon as 1 pixel is out? Or fully out? Usually threshold 0 means "when 0% is visible" i.e. fully out? No, callback runs when crossing. isIntersecting=false means < 0 visible.

function attachListeners(video) {
  if (trackedVideos.has(video)) return;
  trackedVideos.add(video);

  // Enforce default mute on discovery?
  // User: "All vids muted by default on play".
  // Usually Reddit videos start muted, but if they don't, handlePlay will catch it.

  video.addEventListener("play", handlePlay);
  video.addEventListener("pause", handlePause);
  video.addEventListener("ended", handlePause); // Stop = Pause logic
  video.addEventListener("volumechange", handleVolumeChange);

  intersectionObserver.observe(video);
}

// --- DOM Helpers ---

function scanAndObserve(root) {
  if (!root) return;
  if (observedRoots.has(root)) return;
  observedRoots.add(root);

  // Initial Scan
  const vids = root.querySelectorAll ? root.querySelectorAll("video") : [];
  vids.forEach(attachListeners);
  if (root.tagName === "VIDEO") attachListeners(root);

  // Observe Mutations
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;

        if (node.tagName === "VIDEO") attachListeners(node);
        if (node.shadowRoot) scanAndObserve(node.shadowRoot);

        const videos = node.querySelectorAll ? node.querySelectorAll("video") : [];
        videos.forEach(attachListeners);

        const deepElements = node.querySelectorAll ? node.querySelectorAll("*") : [];
        deepElements.forEach((el) => {
          if (el.shadowRoot) scanAndObserve(el.shadowRoot);
        });
      });
    });
  });

  observer.observe(root, {childList: true, subtree: true});

  // Recurse existing
  const existingElements = root.querySelectorAll ? root.querySelectorAll("*") : [];
  existingElements.forEach((el) => {
    if (el.shadowRoot) scanAndObserve(el.shadowRoot);
  });
}

// --- Start ---
scanAndObserve(document.body);
