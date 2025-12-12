import worker, { RoomDurableObject } from "../../../../worker/src/index.ts";

export { RoomDurableObject };

export function onRequest(context) {
  return worker.fetch(context.request, context.env);
}
