// Proxy de /api/* hacia el backend real (cubagest-backend.kirox850.workers.dev).
//
// Por qué existe esto: en Cuba, ETECSA bloquea el dominio *.workers.dev a
// nivel de red (es un dominio muy usado para evadir censura, así que lo
// filtran en bloque), aunque el resto de Cloudflare funcione normal. El
// frontend (cubagest.dpdns.org, en Cloudflare Pages) sí carga sin VPN, pero
// las llamadas directas del navegador al backend en workers.dev se quedan
// colgadas.
//
// La solución: el navegador nunca llama a workers.dev directamente. Llama a
// /api/... en el MISMO dominio del frontend (cubagest.dpdns.org), y esta
// función (que corre en el edge de Cloudflare, no en el navegador del
// usuario) reenvía la petición al Worker real por dentro de la red de
// Cloudflare — ese salto edge-a-edge no pasa por el ISP cubano, así que no
// se bloquea.
//
// Importante: esto también resuelve el callback de QvaPay (ver
// subscriptions.ts en el backend, que ahora apunta el `callback` de QvaPay
// a /api/subscription/qvapay-callback en vez de a la URL de workers.dev
// directamente) — si no, el navegador del usuario sería redirigido por
// QvaPay a workers.dev y se colgaría igual.

const BACKEND_ORIGIN = "https://cubagest-backend.kirox850.workers.dev";

export const onRequest = async (context: { request: Request }) => {
  const url = new URL(context.request.url);

  // /api/subscription/status -> /subscription/status contra el backend real
  const targetPath = url.pathname.replace(/^\/api/, "") || "/";
  const targetUrl = `${BACKEND_ORIGIN}${targetPath}${url.search}`;

  const method = context.request.method;
  const hasBody = !(method === "GET" || method === "HEAD");

  // Solo reenviamos los headers que el backend realmente necesita.
  // No reenviamos "host" ni headers específicos del navegador/Cloudflare
  // del lado del frontend para evitar confundir al Worker de destino.
  const headers = new Headers();
  const authHeader = context.request.headers.get("authorization");
  if (authHeader) headers.set("authorization", authHeader);
  const contentType = context.request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const accept = context.request.headers.get("accept");
  if (accept) headers.set("accept", accept);

  const init: RequestInit = {
    method,
    headers,
    body: hasBody ? context.request.body : undefined,
    // redirect "manual": necesario para el callback de QvaPay, que responde
    // con un 302 hacia el frontend. Si dejáramos "follow" (el default), esta
    // función seguiría el redirect ella misma y el navegador nunca vería la
    // redirección — se quedaría viendo el contenido de la página de
    // destino en la URL /api/... en vez de navegar a donde corresponde.
    redirect: "manual",
  };
  if (hasBody) {
    // @ts-ignore — requerido quando el body es un ReadableStream
    init.duplex = "half";
  }

  const backendResponse = await fetch(targetUrl, init);

  return new Response(backendResponse.body, {
    status: backendResponse.status,
    statusText: backendResponse.statusText,
    headers: backendResponse.headers,
  });
};
