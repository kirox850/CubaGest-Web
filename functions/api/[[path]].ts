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
  // IP real del cliente. Sin esto el backend no encontraba
  // `cf-connecting-ip` y guardaba en cada audit log y cada rate limit la IP
  // del edge de Cloudflare, no la del cliente: todos los usuarios de Cuba
  // iban a parecer el mismo "cliente" y los audit logs no servían para nada.
  //
  // Este header lo pone Cloudflare en la petición que llega a Pages, no el
  // navegador (no se puede falsear desde el cliente). El único caso donde
  // un valor no confiable llegaría es alguien llamando al Worker
  // directamente por workers.dev y poniendo su propio header — desde Cuba
  // ese dominio está bloqueado, y aun así lo único que podría falsear es
  // la IP de SU PROPIA petición en SU propio audit log.
  const clientIp = context.request.headers.get("cf-connecting-ip");
  if (clientIp) headers.set("cf-connecting-ip", clientIp);

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

  // Límite de tiempo. Sin esto, si el backend se queda colgado (una consulta
  // lenta, unWorker occupé) esta función se queda esperando hasta que Cloudflare
  // la mate, y el usuario ve la pantalla cargando indefinidamente. Fallar a los
  // 20 s con un 504 es mucho mejor que colgar: el cliente recibe un error
  // claro y su app entra en modo sin conexión.
  //
  // 20 s, no 30: el POS avisa al cajero y guarda la venta localmente cuando la
  // red falla, así que cortar antes es mejor que dejarlo pensando.
  const timeoutMs = 20000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  init.signal = controller.signal;

  let backendResponse: Response;
  try {
    backendResponse = await fetch(targetUrl, init);
  } catch (err: any) {
    const agotado = err?.name === "AbortError" || /abort/i.test(err?.message || "");
    console.error(
      agotado
        ? `Proxy: ${method} ${targetPath} pasó de ${timeoutMs / 1000}s sin respuesta`
        : `Proxy: ${method} ${targetPath} falló al contactar el backend: ${err?.message || err}`
    );
    return new Response(
      JSON.stringify({
        ok: false,
        error: agotado
          ? "El servidor tardó demasiado en responder. Revisa tu conexión."
          : "No se pudo contactar el servidor.",
      }),
      { status: agotado ? 504 : 502, headers: { "Content-Type": "application/json" } },
    );
  } finally {
    clearTimeout(timer);
  }

  return new Response(backendResponse.body, {
    status: backendResponse.status,
    statusText: backendResponse.statusText,
    headers: backendResponse.headers,
  });
};
