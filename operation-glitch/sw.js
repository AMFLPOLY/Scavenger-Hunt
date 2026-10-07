/*
 * Offline safety net. Always tries the network first (so your edits show up as soon as
 * they're online) and falls back to the last saved copy if the connection drops.
 * Only active when the game is served from a real web address.
 */
const CACHE = 'field-terminal-v4';
const NETWORK_TIMEOUT_MS = 4000;
const CORE_FILES = [
  './',
  './index.html',
  './icon.svg',
  './styles/theme.css',
  './styles/app.css',
  './content/game-config.js',
  './content/missions.js',
  './content/case-files.js',
  './js/core/dom.js',
  './js/core/text.js',
  './js/core/answer-validator.js',
  './js/core/progress-storage.js',
  './js/core/game-state.js',
  './js/core/content.js',
  './js/core/handler-voice.js',
  './js/core/runner.js',
  './js/core/remote.js',
  './js/core/sound.js',
  './js/ui/components.js',
  './js/ui/boot-screen.js',
  './js/ui/hub-screen.js',
  './js/ui/comms-screen.js',
  './js/ui/terminal-inputs.js',
  './js/ui/terminal-screen.js',
  './js/ui/training-games.js',
  './js/ui/training-screen.js',
  './js/ui/files-screen.js',
  './js/ui/report-screens.js',
  './js/ui/game-master-panel.js',
  './js/app.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => Promise.all(CORE_FILES.map((url) => cache.add(url).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

// Network first; photos and other files you add are cached the first time they load.
async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await withTimeout(fetch(request), NETWORK_TIMEOUT_MS);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const shell = (await cache.match('./index.html')) || (await cache.match('./'));
      if (shell) return shell;
    }
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(networkFirst(request));
});
