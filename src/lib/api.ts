// ─── API CLIENT ───────────────────────────────────────────────────────────────
export const API_URL = "/api";

let _token: string | null = null;

export const getToken = () => _token || localStorage.getItem("cubagest_token");
export const saveToken = (t: string | null) => {
  _token = t;
  t ? localStorage.setItem("cubagest_token", t) : localStorage.removeItem("cubagest_token");
};

export async function apiFetch(path: string, opts: { method?: string; body?: object; auth?: boolean } = {}) {
  const { method = "GET", body, auth = true } = opts;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (!token) throw new Error("No autenticado");
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Timeout de 8 segundos para no dejar al usuario esperando
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.status === 204) return null;

    // El mensaje REAL del servidor ("Correo o contraseña incorrectos",
    // "Demasiados intentos", etc.) debe llegar siempre a la UI — antes el
    // 401 de login caía en el bloque de "sesión expirada" y el usuario veía
    // un error genérico/confuso mientras la consola mostraba la verdad.
    const data = await res.json().catch(() => null);
    const serverError: string | undefined = data?.error || data?.message;

    // Token expirado o inválido SOLO en peticiones autenticadas — el 401 de
    // /auth/login (auth:false) es simplemente "credenciales incorrectas".
    // OJO: antes aquí se hacía window.location.reload(), pero eso podía
    // dispararse a mitad de una sincronización de ventas offline y
    // destruir el proceso antes de que pudiera revertir el estado de las
    // ventas a "pending" — por eso avisamos con un evento sin recargar.
    if (res.status === 401 && auth) {
      saveToken(null);
      localStorage.removeItem("cubagest_user");
      window.dispatchEvent(new Event("cubagest-session-expired"));
      throw new Error(serverError || "Tu sesión expiró. Inicia sesión de nuevo.");
    }

    if (!res.ok) throw new Error(serverError || `Error ${res.status}`);
    // El backend envuelve casi todas las respuestas como { ok:true, data:... }
    // (excepto /auth/*, que devuelve accessToken/refreshToken/user "planos").
    // Desenvolvemos aquí, en un único lugar, para que el resto del código
    // siga usando el payload directamente (products, sales, planInfo, etc.)
    if (data && typeof data === "object" && data.ok === true && "data" in data) {
      return data.data;
    }
    return data;
  } catch(e: any) {
    clearTimeout(timeout);
    if (e.name === 'AbortError') throw new Error('Sin conexión con el servidor — revisa tu internet e inténtalo de nuevo');
    throw e;
  }
}
