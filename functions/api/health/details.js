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
  const env = context.env ?? {};
  const doCheck = await checkDurableObject(env);

  const body = {
    ok: true,
    hasRoomsBinding: !!env.ROOMS,
    durableObject: doCheck,
    pages: {
      branch: env.CF_PAGES_BRANCH ?? null,
      commitSha: env.CF_PAGES_COMMIT_SHA ?? null,
      deploymentId: env.CF_PAGES_DEPLOYMENT_ID ?? null,
      url: env.CF_PAGES_URL ?? null,
    },
  };

  return new Response(JSON.stringify(body, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}
