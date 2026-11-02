export function swapItems<T>(items: T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (target < 0 || target >= items.length) {
    return items;
  }

  const next = [...items];
  const moved = next[index];
  const displaced = next[target];
  if (moved === undefined || displaced === undefined) {
    return items;
  }

  next[index] = displaced;
  next[target] = moved;
  return next;
}
