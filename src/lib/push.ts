// ─── Avisos del navegador (PWA push) ────────────────────────────────────────
//
// Lo que hace este archivo, en orden:
//   1. convierte una cadena base64url en bytes (lo que el navegador llama
//      applicationServerKey y hay que pasar en bytes, no en texto);
//   2. pide permiso y registra este navegador contra el backend;
//   3. avisa si se pudo.
//
// Lo importante: `enablePush()` NO pide permiso de golpe. Devuelve "dudoso" si
// la persona no ha dicho nada todavía, para que la interfaz pueda preguntar en
// un momento bueno (después de su primera venta guardada) y no en el primer
// arranque, que es cuando casi todo el mundo dice que no y ya no vuelve a
// preguntar ni aunque lo necesiten.

import { apiFetch } from "./api";

/** base64url → Uint8Array. Al revés inválido si se pasa texto sin decodificar. */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** Lo que el navegador ya decidió: "no" no se puede volver a preguntar. */
export function permissionState(): NotificationPermission | "unsupported" {
  if (!pushSupported()) return "unsupported";
  return Notification.permission;
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  return reg ?? null;
}

export function isPushEnabled(): boolean {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  return Notification.permission === "granted";
}

/**
 * Pide permiso y registra este navegador.
 * Devuelve: "activado" | "cancelado" | "no-soportado" | "ya-estaba" | "error"
 */
export async function enablePush(): Promise<"activado" | "cancelado" | "no-soportado" | "ya-estaba" | "error"> {
  if (!pushSupported()) return "no-soportado";

  const reg = await getRegistration();
  if (!reg) return "error"; // aún no se ha registrado el service worker

  let permission = Notification.permission;
  if (permission === "default") {
    // Esto abre el cartel del navegador. Si la persona dice que no, se acabó:
    // "denied" es permanente y hay que decirlo, no reintentar.
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") return "cancelado";

  // OJO: apiFetch desenvuelve la respuesta — si el backend devuelve
  // { ok: true, data: {...} }, lo que llega aquí es solo {...}. Por eso aquí
  // se lee `publicKey` y no `data.publicKey`.
  const { publicKey } = await apiFetch("/push/public-key");
  if (!publicKey) return "error";

  // ¿Ya suscrito? Entonces solo hay que refrescar la fila del servidor.
  const existente = await reg.pushManager.getSubscription();

  const subscription = existente ?? await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return "error";

  await apiFetch("/push/subscribe", {
    method: "POST",
    body: { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } },
  });

  return existente ? "ya-estaba" : "activado";
}

/** Da de baja este navegador. Dejar de avisar no pide permiso, siempre se puede. */
export async function disablePush(): Promise<boolean> {
  if (!pushSupported()) return false;
  try {
    const reg = await getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await apiFetch("/push/unsubscribe", { method: "POST", body: { endpoint: sub.endpoint } }).catch(() => {});
      await sub.unsubscribe();
    }
    return true;
  } catch {
    return false;
  }
}

/** Prueba de humo: comprueba que hay un SW activo y listo para recibir avisos. */
export async function pushReady(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== "granted") return false;
  const reg = await getRegistration();
  return !!(reg?.active && (await reg.pushManager.getSubscription()));
}
