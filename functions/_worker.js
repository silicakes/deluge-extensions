import worker, { RoomDurableObject } from "../worker/src/index.ts";

export { RoomDurableObject };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return new Response("ok", {
        status: 200,
        headers: { "content-type": "text/plain" },
      });
    }

    if (url.pathname.startsWith("/api/")) {
      return worker.fetch(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};

