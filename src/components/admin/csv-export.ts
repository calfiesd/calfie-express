"use client";

function escapeCsv(value: string | number | null | undefined) {
  const text = value == null ? "" : String(value);
  if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }

  return text;
}

export function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number | null | undefined>>) {
  const csv = [
    headers.map((header) => escapeCsv(header)).join(","),
    ...rows.map((row) => row.map((cell) => escapeCsv(cell)).join(","))
  ].join("\r\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
