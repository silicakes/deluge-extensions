async function checkDurableObject(env) {
  if (!env?.ROOMS) {
    return { ok: false, error: "Missing Durable Object binding: ROOMS" };
  }
  try {
    const id = env.ROOMS.idFromName("health-check");
    const stub = env.ROOMS.get(id);
    const resp = await stub.fetch(
      "https://internal/api/rooms/health-check/ws?role=viewer",
    );
    return { ok: true, status: resp.status };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const details = url.searchParams.get("details") === "1";

  if (!details) {
    return new Response("ok", {
      status: 200,
      headers: {
        "content-type": "text/plain",
        "cache-control": "no-store",
      },
    });
  }

  const doCheck = await checkDurableObject(context.env);
  const body = {
    ok: true,
    hasRoomsBinding: !!context.env?.ROOMS,
    durableObject: doCheck,
  };
  return new Response(JSON.stringify(body, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}
