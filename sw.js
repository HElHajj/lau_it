// Import the Firebase Cloud Messaging library scripts
importScripts('https://www.gstatic.com/firebasejs/11.4.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.4.0/firebase-messaging-compat.js');

// Required for Firebase initialization within the Service Worker context
// IMPORTANT: Ensure this firebaseConfig matches your project's config from config.js
const firebaseConfig = {
  apiKey: "AIzaSyAeqcHJNI4gEg4pf6tnhAmCVjdzsYJySuA", // Your API Key
  authDomain: "lau-support-system.firebaseapp.com",
  databaseURL: "https://lau-support-system-default-rtdb.europe-west1.firebasedatabase.app/",
  projectId: "lau-support-system",
  storageBucket: "lau-support-system.firebasestorage.app",
  messagingSenderId: "751385390833", // THIS IS CRUCIAL FOR FCM
  appId: "1:751385390833:web:d4642d34cd050347788350",
  measurementId: "G-NDD6MDHXSQ"
};

// Initialize Firebase App
firebase.initializeApp(firebaseConfig);

// Retrieve Firebase Messaging object.
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
    console.log('Received background message:', payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: payload.notification.icon || '/pics/lau_icon.png' // Use your app icon
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

const CACHE_NAME = 'lau-support-cache-v1';
const urlsToCache = [
  '/', // Alias for index.html if your server is set up for it, otherwise use '/index.html'
  '/index.html',
  '/beirut_classrooms.html',
  '/byblos_classrooms.html',
  '/offices.html',
  '/style.css',
  '/config.js', // Assuming this is your Firebase config file
  '/pics/lau_icon.png',
  '/sound/beep_warning.mp3',
  // Add other assets like fonts or important images if any
  'https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/11.4.0/firebase-analytics.js',
  'https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js'
];

// Install event: open cache and add core files
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Service Worker: Installation complete');
        return self.skipWaiting(); // Force the waiting service worker to become the active service worker
      })
      .catch((error) => {
        console.error('Service Worker: Caching failed', error);
      })
  );
});

// Activate event: clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Clearing old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Activation complete, now controlling client.');
      return self.clients.claim(); // Become the controller for all clients within its scope.
    })
  );
});

// Fetch event: serve cached content when offline, or fetch from network
self.addEventListener('fetch', (event) => {
  // We only want to intercept GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // For Firebase database requests, always go to the network.
  // You might need to adjust this if your databaseURL is different or you have other Firebase services.
  if (event.request.url.includes(self.registration.scope + 'config.js')) {
     // If it's the config.js loaded by HTML, try cache first, then network.
     // This helps if the config.js itself is updated.
     event.respondWith(
        caches.match(event.request)
          .then((response) => {
            if (response) {
              // console.log('Service Worker: Serving from cache:', event.request.url);
              return response;
            }
            // console.log('Service Worker: Fetching from network:', event.request.url);
            return fetch(event.request).then((networkResponse) => {
              // Optionally cache the new config.js if fetched successfully
              // Be cautious with caching dynamically changing config files directly without a strategy.
              // For simplicity, we are not re-caching it here after initial cache.
              return networkResponse;
            });
          })
          .catch(error => {
            console.error('Service Worker: Error fetching config.js', error);
            // Potentially return a fallback if necessary
          })
      );
      return;
  }
  
  if (event.request.url.includes('firebaseio.com') || event.request.url.includes('firestore.googleapis.com') || event.request.url.includes('googleusercontent.com')) {
     // console.log('Service Worker: Bypassing cache for Firebase request:', event.request.url);
    event.respondWith(fetch(event.request));
    return;
  }


  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          // console.log('Service Worker: Serving from cache:', event.request.url);
          return response; // Serve from cache if found
        }
        // console.log('Service Worker: Fetching from network:', event.request.url);
        // Not in cache, fetch from network
        return fetch(event.request).then(
          (networkResponse) => {
            // Check if we received a valid response
            if(!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              if (networkResponse && networkResponse.type !== 'basic') {
                // console.log('Service Worker: Not caching opaque response from network:', event.request.url);
              } else if (networkResponse) {
                // console.log('Service Worker: Network response was not ok:', event.request.url, networkResponse.status);
              } else {
                // console.log('Service Worker: Fetch returned no response for:', event.request.url);
              }
              return networkResponse;
            }

            // IMPORTANT: Clone the response. A response is a stream
            // and because we want the browser to consume the response
            // as well as the cache consuming the response, we need
            // to clone it so we have two streams.
            const responseToCache = networkResponse.clone();

            // Only cache if it's one of our defined URLs or a dynamically loaded Firebase JS SDK file
            const isCachableUrl = urlsToCache.includes(event.request.url.replace(self.location.origin, '')) ||
                                  urlsToCache.includes(event.request.url) ||
                                  event.request.url.startsWith('https://www.gstatic.com/firebasejs/');

            if (isCachableUrl) {
                caches.open(CACHE_NAME)
                  .then((cache) => {
                    // console.log('Service Worker: Caching new resource:', event.request.url);
                    cache.put(event.request, responseToCache);
                  });
            } else {
                // console.log('Service Worker: Not caching (URL not in list and not Firebase SDK):', event.request.url);
            }
            return networkResponse;
          }
        ).catch(error => {
          console.error('Service Worker: Fetch failed; returning offline page if available (not configured). Error:', error);
          // Optionally, you could return a fallback offline page here:
          // return caches.match('/offline.html');
        });
      })
  );
});
