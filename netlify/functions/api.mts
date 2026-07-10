type NetlifyRuntime = {
  env?: {
    get: (name: string) => string | undefined;
  };
};

const API_ENV_NAMES = ["API_URL", "BACKEND_URL", "VITE_API_URL"] as const;

function getBackendBaseUrl() {
  const netlify = (globalThis as typeof globalThis & { Netlify?: NetlifyRuntime }).Netlify;

  for (const name of API_ENV_NAMES) {
    const value = netlify?.env?.get(name)?.trim();
    if (value) return value.replace(/\/+$/, "");
  }

  return "";
}

function getRequestPath(pathname: string) {
  const functionPath = "/.netlify/functions/api";

  if (pathname === functionPath) return "/api";
  if (pathname.startsWith(`${functionPath}/`)) {
    return `/api/${pathname.slice(functionPath.length + 1)}`;
  }

  return pathname;
}

function getProxyTarget(requestUrl: URL, backendBaseUrl: string) {
  const backendUrl = new URL(backendBaseUrl);
  const basePath = backendUrl.pathname.replace(/\/+$/, "");
  const requestPath = getRequestPath(requestUrl.pathname);

  const proxiedPath =
    basePath.endsWith("/api") && requestPath.startsWith("/api/")
      ? requestPath.slice("/api".length)
      : requestPath;

  backendUrl.pathname = `${basePath}${proxiedPath}`.replace(/\/{2,}/g, "/");
  backendUrl.search = requestUrl.search;

  return backendUrl;
}

function getProxyHeaders(requestHeaders: Headers) {
  const headers = new Headers(requestHeaders);

  headers.delete("host");
  headers.delete("content-length");
  headers.delete("connection");

  return headers;
}

function getResponseHeaders(responseHeaders: Headers) {
  const headers = new Headers(responseHeaders);

  headers.delete("content-encoding");
  headers.delete("content-length");
  headers.delete("transfer-encoding");

  return headers;
}

export default async (request: Request) => {
  const backendBaseUrl = getBackendBaseUrl();

  if (!backendBaseUrl) {
    return Response.json(
      {
        error: "API backend is not configured.",
      },
      { status: 502 },
    );
  }

  let targetUrl: URL;

  try {
    targetUrl = getProxyTarget(new URL(request.url), backendBaseUrl);
  } catch {
    return Response.json(
      {
        error: "API backend URL is invalid.",
      },
      { status: 502 },
    );
  }

  const method = request.method.toUpperCase();
  const proxyRequest: RequestInit & { duplex?: "half" } = {
    method,
    headers: getProxyHeaders(request.headers),
    body: method === "GET" || method === "HEAD" ? undefined : request.body,
    redirect: "manual",
    duplex: "half",
  };

  const upstreamResponse = await fetch(targetUrl, proxyRequest);

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: getResponseHeaders(upstreamResponse.headers),
  });
};

export const config = {
  path: ["/api", "/api/*"],
};
