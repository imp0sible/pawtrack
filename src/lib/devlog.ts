// Devlog versioning. Format: <major>.<minor>.<patch>.
// - The first column stays 0 until the project reaches MVP.
// - A "major" update increments the second column.
// - A "small" update increments the third column.
export function nextVersion(prev: string | null | undefined, kind: "MAJOR" | "MINOR"): string {
  const [a = 0, b = 0, c = 0] = (prev ?? "0.0.0").split(".").map((n) => parseInt(n, 10) || 0);
  return kind === "MAJOR" ? `${a}.${b + 1}.${c}` : `${a}.${b}.${c + 1}`;
}
