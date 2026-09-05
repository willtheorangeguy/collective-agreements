export function shingles(text: string, size = 8): Set<string> {
  const words = text.toLowerCase().replace(/\s+/g, " ").split(" ");
  const out = new Set<string>();
  for (let i = 0; i <= words.length - size; i++) {
    out.add(words.slice(i, i + size).join(" "));
  }
  return out;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const s of a) {
    if (b.has(s)) inter++;
  }
  return inter / (a.size + b.size - inter);
}

export function isNearDuplicate(textA: string, textB: string, threshold = 0.8): boolean {
  return jaccard(shingles(textA), shingles(textB)) >= threshold;
}
