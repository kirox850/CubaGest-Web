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

    // Token expirado o inválido — limpiar sesión y avisar a la app.
    // OJO: antes aquí se hacía window.location.reload(), pero eso podía
    // dispararse a mitad de una sincronización de ventas offline y
    // destruir el proceso antes de que pudiera revertir el estado de las
    // ventas a "pending" — arriesgando perderlas o dejarlas "colgadas".
    // En vez de recargar la página, avisamos con un evento y dejamos que
    // el componente raíz muestre el login sin interrumpir nada en curso.
    if (res.status === 401) {
      saveToken(null);
      localStorage.removeItem("cubagest_user");
      window.dispatchEvent(new Event("cubagest-session-expired"));
      throw new Error("Sesión expirada");
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
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
    if (e.name === 'AbortError') throw new Error('Sin conexión');
    throw e;
  }
}
