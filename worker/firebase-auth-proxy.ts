/**
 * Cloudflare Worker entry: first-party Firebase Auth handler proxy + vinext app.
 *
 * iOS Safari / installed PWA ITP blocks third-party storage on
 * *.firebaseapp.com during signInWithRedirect. Setting authDomain to this
 * Worker host and reverse-proxying /__/auth/* (and /__/firebase/*) makes the
 * auth handler first-party so getRedirectResult can complete.
 *
 * @see https://firebase.google.com/docs/auth/web/redirect-best-practices
 */
import vinextHandler from "vinext/server/fetch-handler";

export const FIREBASE_AUTH_ORIGIN =
  "https://gen-lang-client-0310454092.firebaseapp.com";

function isFirebaseAuthPath(pathname: string): boolean {
  return (
    pathname === "/__/auth" ||
    pathname.startsWith("/__/auth/") ||
    pathname === "/__/firebase" ||
    pathname.startsWith("/__/firebase/")
  );
}

async function proxyFirebaseAuth(request: Request): Promise<Response> {
  const incoming = new URL(request.url);
  const target = new URL(
    `${incoming.pathname}${incoming.search}`,
    FIREBASE_AUTH_ORIGIN,
  );

  const headers = new Headers(request.headers);
  headers.set("Host", new URL(FIREBASE_AUTH_ORIGIN).host);
  // Hop-by-hop / CDN headers must not be forwarded upstream.
  for (const name of [
    "cf-connecting-ip",
    "cf-ipcountry",
    "cf-ray",
    "cf-visitor",
    "cf-worker",
    "x-forwarded-proto",
    "x-real-ip",
  ]) {
    headers.delete(name);
  }

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
    // Required when streaming a request body from a Worker fetch handler.
    (init as RequestInit & { duplex?: string }).duplex = "half";
  }

  const upstream = await fetch(target.toString(), init);
  const outHeaders = new Headers(upstream.headers);

  const location = outHeaders.get("Location");
  if (location) {
    try {
      const locUrl = new URL(location, FIREBASE_AUTH_ORIGIN);
      if (
        locUrl.origin === new URL(FIREBASE_AUTH_ORIGIN).origin &&
        isFirebaseAuthPath(locUrl.pathname)
      ) {
        const reqOrigin = incoming.origin;
        outHeaders.set(
          "Location",
          `${reqOrigin}${locUrl.pathname}${locUrl.search}`,
        );
      }
    } catch {
      /* keep upstream Location */
    }
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: outHeaders,
  });
}

const worker = {
  async fetch(
    request: Request,
    env: Cloudflare.Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (isFirebaseAuthPath(pathname)) {
      return proxyFirebaseAuth(request);
    }
    return vinextHandler.fetch(request, env, ctx);
  },
};

export default worker;
