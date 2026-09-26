// ─── API CLIENT ───────────────────────────────────────────────────────────────
export const API_URL = "/api";

let _token: string | null = null;

export const getToken = () => _token || localStorage.getItem("cubagest_token");
export const saveToken = (t: string | null) => {
  _token = t;
  t ? localStorage.setItem("cubagest_token", t) : localStorage.removeItem("cubagest_token");
};

const REFRESH_KEY = "cubagest_refresh_token";
const USER_KEY = "cubagest_user";
export const getRefreshToken = () => localStorage.getItem(REFRESH_KEY);
export const saveRefreshToken = (t: string | null) =>
  t ? localStorage.setItem(REFRESH_KEY, t) : localStorage.removeItem(REFRESH_KEY);

// ── Errores tipados ──────────────────────────────────────────────────────────
// El POS necesita distinguir "el servidor no respondió" (la venta se puede
// guardar offline y reintentar) de "el servidor respondió que no" (error de
// validación o de permisos: NO se encola, se le muestra al usuario tal cual).
export type ApiErrorKind = "network" | "timeout" | "auth" | "permission" | "validation" | "server";

export class ApiError extends Error {
  kind: ApiErrorKind;
  status?: number;
  constructor(message: string, kind: ApiErrorKind, status?: number) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
  }
}

/** true si el fallo es de transporte (red / tiempo de espera) o del servidor:
 *  la operación se puede reintentar sin cambios. Un 400/403 de validación o
 *  permisos NO cuenta: el servidor respondió y no va a cambiar de opinión. */
export const isTransportError = (e: any): boolean =>
  e instanceof ApiError
    ? e.kind === "network" || e.kind === "timeout" || e.kind === "server"
    : e?.name === "AbortError";

const kindForStatus = (status: number): ApiErrorKind =>
  status === 401 || status === 403 ? (status === 403 ? "permission" : "auth")
  : status >= 500 ? "server"
  : "validation";

export interface ApiFetchOptions {
  method?: string;
  body?: object;
  auth?: boolean;
  /** Tiempo máximo de espera (ms). Por defecto 8s; la sincronización de
   *  ventas usa más margen porque viaja en una sola petición por lote. */
  timeoutMs?: number;
}

async function request(path: string, opts: ApiFetchOptions, token: string | null) {
  const { method = "GET", body, auth = true, timeoutMs = 8000 } = opts;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    if (!token) throw new ApiError("No autenticado", "auth");
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Timeout para no dejar al usuario esperando.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

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

    if (!res.ok) {
      throw new ApiError(serverError || `Error ${res.status}`, kindForStatus(res.status), res.status);
    }
    // El backend envuelve casi todas las respuestas como { ok:true, data:... }
    // (excepto /auth/*, que devuelve accessToken/refreshToken/user "planos").
    // Desenvolvemos aquí, en un único lugar, para que el resto del código
    // siga usando el payload directamente (products, sales, planInfo, etc.)
    if (data && typeof data === "object" && data.ok === true && "data" in data) {
      return data.data;
    }
    return data;
  } catch (e: any) {
    clearTimeout(timeout);
    if (e?.name === "AbortError") {
      throw new ApiError("Sin conexión con el servidor — revisa tu internet e inténtalo de nuevo", "timeout");
    }
    if (e instanceof ApiError) throw e;
    // TypeError de fetch = no hay red / CORS / servidor caído.
    throw new ApiError(
      e?.message === "Failed to fetch"
        ? "Sin conexión con el servidor — revisa tu internet e inténtalo de nuevo"
        : (e?.message || "No se pudo conectar con el servidor"),
      "network",
    );
  }
}

// ── Renovación de token ──────────────────────────────────────────────────────
// Un SOLO candado compartido: si llegan cinco peticiones con 401 a la vez,
// todas esperan la misma renovación y luego reintentan con el token nuevo (no
// cinco renovaciones simultáneas, que además rotan el refresh token y dejaban
// al resto con un token revocado).
let _refreshLock: Promise<string | null> | null = null;

function refreshAccessToken(): Promise<string | null> {
  if (_refreshLock) return _refreshLock;
  const run = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;
    try {
      const data: any = await request("/auth/refresh", { method: "POST", body: { refreshToken }, auth: false }, null);
      const accessToken = data?.accessToken;
      if (!accessToken) return null;
      saveToken(accessToken);
      // El backend puede rotar el refresh token en cada renovación.
      if (data?.refreshToken) saveRefreshToken(data.refreshToken);
      return accessToken as string;
    } catch {
      return null;
    }
  })();
  _refreshLock = run;
  run.finally(() => { if (_refreshLock === run) _refreshLock = null; });
  return run;
}

function endSession(message: string) {
  saveToken(null);
  saveRefreshToken(null);
  localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event("cubagest-session-expired"));
  return new ApiError(message, "auth", 401);
}

export async function apiFetch(path: string, opts: ApiFetchOptions = {}) {
  const { auth = true } = opts;

  try {
    return await request(path, opts, auth ? getToken() : null);
  } catch (e: any) {
    // Un 401 en una petición autenticada puede ser solo un access token
    // caducado: se intenta renovar UNA vez y reintentar. Solo si la renovación
    // tampoco funciona se cierra la sesión.
    if (auth && e?.status === 401 && getRefreshToken()) {
      const renewed = await refreshAccessToken();
      if (renewed) {
        try {
          return await request(path, opts, renewed);
        } catch (retryErr: any) {
          if (retryErr?.status !== 401) throw retryErr;
        }
      }
      // Sigue sin acceso: la sesión ya no es recuperable desde el cliente.
      throw endSession("Tu sesión expiró. Inicia sesión de nuevo.");
    }
    // Token expirado o inválido SOLO en peticiones autenticadas — el 401 de
    // /auth/login (auth:false) es simplemente "credenciales incorrectas".
    // OJO: antes aquí se hacía window.location.reload(), pero eso podía
    // dispararse a mitad de una sincronización de ventas offline y
    // destruir el proceso antes de que pudiera revertir el estado de las
    // ventas a "pending" — por eso avisamos con un evento sin recargar.
    if (auth && e?.status === 401) {
      throw endSession("Tu sesión expiró. Inicia sesión de nuevo.");
    }
    throw e;
  }
}

// ── Cierre de sesión ─────────────────────────────────────────────────────────
// Se avisa al servidor para revocar la sesión (best-effort: sin red, el cierre
// de sesión local debe completarse igual). IMPORTANTE: no se borra nada de los
// datos offline (catálogo, stock, cola de ventas) — el usuario está en su
// dispositivo personal y los reutiliza al volver a entrar. Solo se elimina el
// estado de autenticación.
export async function logout() {
  const refreshToken = getRefreshToken();
  try {
    if (getToken()) {
      await request("/auth/logout", { method: "POST", body: { refreshToken }, auth: true, timeoutMs: 5000 }, getToken());
    }
  } catch {
    // Sin conexión o token ya inválido: la sesión local se cierra igual.
  } finally {
    saveToken(null);
    saveRefreshToken(null);
    localStorage.removeItem(USER_KEY);
  }
}
