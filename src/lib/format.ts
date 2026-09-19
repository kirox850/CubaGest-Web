// ─── HELPERS DE FORMATO Y CSV ─────────────────────────────────────────────────

export const fmt = (n: number) => new Intl.NumberFormat("es-CU", { minimumFractionDigits: 2 }).format(n || 0);
export const today = () => new Date().toISOString().split("T")[0];

// Convierte filas a CSV escapando comillas/comas/saltos, y descarga un archivo
// con BOM UTF-8 para que Excel lo abra bien con acentos y ñ.
export function toCSV(rows: Record<string, any>[], headers?: { key: string; label: string }[]): string {
  if (!rows.length) return "";
  const cols = headers || Object.keys(rows[0]).map(k => ({ key: k, label: k }));
  const esc = (v: any) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [cols.map(c => esc(c.label)).join(",")];
  for (const r of rows) lines.push(cols.map(c => esc(r[c.key])).join(","));
  return lines.join("\n");
}

export function downloadCSV(filename: string, rows: Record<string, any>[], headers?: { key: string; label: string }[]) {
  const csv = toCSV(rows, headers);
  if (!csv) return;
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
