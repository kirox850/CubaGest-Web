// ─── CONSTANTES COMPARTIDAS (igual que backend) ───────────────────────────────

export const ROLES: Record<string, { label: string; color: string; perms: string[] }> = {
  admin:       { label: "Administrador", color: "var(--brand)", perms: ["dashboard","inventario","facturacion","contabilidad","cierre","usuarios","config","transferencias","auditoria"] },
  cajero:      { label: "Cajero",        color: "var(--brand)", perms: ["dashboard","pos","facturacion","cierre","transferencias","auditoria"] },
  contador:    { label: "Contador",      color: "#10B981", perms: ["dashboard","contabilidad","cierre","auditoria"] },
  almacenista: { label: "Almacenista",   color: "#7A5C1A", perms: ["dashboard","inventario","pos","cierre","transferencias","auditoria"] },
};

export const PAY_METHODS = [
  { id: "efectivo",      label: "Efectivo" },
  { id: "transferencia", label: "Transferencia" },
  { id: "usd",           label: "USD (efectivo)" },
  { id: "clasica",       label: "Clásica" },
  { id: "zelle",         label: "Zelle" },
  { id: "mlc",           label: "MLC" },
  { id: "eur",           label: "EUR (efectivo)" },
];

export const CURRENCIES = ["CUP", "USD", "EUR", "MLC"];

export const CURRENCY_SYMBOLS: Record<string, string> = { CUP: "$", USD: "$", EUR: "€", MLC: "MLC" };

export const CATEGORIES = ["Alimentos","Higiene","Bebidas","Limpieza","Electrónica","Ropa","Otros"];
export const UNITS       = ["ud","kg","g","L","ml","paq","lata","caja","docena"];
export const EXPENSE_CATS = ["Compras","Nómina","Servicios","Operaciones","Impuestos","Otros"];
