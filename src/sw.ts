/// <reference lib="webworker" />

import { precacheAndRoute } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import {
  StaleWhileRevalidate,
  CacheFirst,
  NetworkFirst,
} from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { createHandlerBoundToURL } from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope;

// Self-destructing message for skipWaiting
self.addEventListener("message", (event: ExtendableMessageEvent) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Announce update to clients once activated
self.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil(
    self.clients.claim().then(() => {
      // Send message to all clients that SW has updated
      self.clients.matchAll().then((clients: readonly Client[]) => {
        clients.forEach((client: Client) => client.postMessage("SW_UPDATED"));
      });
    })
  );
});

// Use the imported modules above to implement precaching.
// The "__WB_MANIFEST" is injected by the workbox vite plugin
precacheAndRoute(self.__WB_MANIFEST);

// Navigate to app shell for all navigation routes
const handler = createHandlerBoundToURL("/index.html");
const navigationRoute = new NavigationRoute(handler, {
  // Don't serve the app shell for API calls or other non-HTML requests
  denylist: [/\.(js|css|png|jpg|jpeg|gif|svg|ico)$/, /\/api\//],
});
registerRoute(navigationRoute);

// Cache Google Fonts
registerRoute(
  /^https:\/\/fonts\.googleapis\.com/,
  new StaleWhileRevalidate({
    cacheName: "google-fonts-stylesheets",
  })
);

registerRoute(
  /^https:\/\/fonts\.gstatic\.com/,
  new CacheFirst({
    cacheName: "google-fonts-webfonts",
    plugins: [
      new ExpirationPlugin({
        maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
        maxEntries: 30,
      }),
    ],
  })
);

// Cache static assets
registerRoute(
  /\.(?:js|css|png|jpg|jpeg|svg|gif|ico)$/,
  new CacheFirst({
    cacheName: "static-resources",
    plugins: [
      new ExpirationPlugin({
        maxAgeSeconds: 7 * 24 * 60 * 60, // 1 week
      }),
    ],
  })
);

// Handle API requests with NetworkFirst strategy
registerRoute(
  /\/api\//,
  new NetworkFirst({
    cacheName: "api-responses",
    plugins: [
      new ExpirationPlugin({
        maxAgeSeconds: 60 * 60, // 1 hour
      }),
    ],
  })
);
