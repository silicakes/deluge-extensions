import worker, { RoomDurableObject } from "../../../../worker/src/index.ts";

export { RoomDurableObject };

export async function onRequest(context) {
  if (!context.env?.ROOMS) {
    return new Response("Missing Durable Object binding: ROOMS", {
      status: 500,
      headers: { "content-type": "text/plain" },
    });
  }

  try {
    return await worker.fetch(context.request, context.env);
  } catch (err) {
    console.error("Screen streaming relay failure:", err);
    return new Response("Screen streaming relay failure", {
      status: 500,
      headers: { "content-type": "text/plain" },
    });
  }
}
