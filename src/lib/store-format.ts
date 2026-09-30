export function usd(value: number | string): string {
  const n = typeof value === "string" ? Number(value) : value;
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function shortAddress(address: string, size = 6): string {
  if (address.length <= size * 2 + 2) return address;
  return `${address.slice(0, size)}…${address.slice(-4)}`;
}

export function credentialsToTxt(lines: string[]): string {
  return lines.join("\n") + "\n";
}

export function credentialsToCsv(lines: string[]): string {
  const rows = lines.map((line, i) => {
    const parts = line.split(/[:|,\t]/);
    const username = parts[0]?.trim() ?? "";
    const password = parts.slice(1).join(":").trim();
    const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;
    return [String(i + 1), cell(username), cell(password), cell(line)].join(",");
  });
  return ["index,username,password,raw", ...rows].join("\n") + "\n";
}

export function downloadFile(filename: string, contents: string, mime: string) {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function statusTone(status: string): "cyan" | "amber" | "rose" | "fog" {
  if (status === "delivered") return "cyan";
  if (status === "paid") return "teal" as never;
  if (status === "pending") return "amber";
  if (status === "failed" || status === "cancelled") return "rose";
  return "fog";
}
