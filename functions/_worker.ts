import worker, { RoomDurableObject } from "../worker/src/index.ts";

type Env = {
  ROOMS: DurableObjectNamespace;
  ASSETS: { fetch: (request: Request) => Promise<Response> };
};

export { RoomDurableObject };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
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

