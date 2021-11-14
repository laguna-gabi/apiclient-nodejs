export function filterNonNullFields<T>(params): T | Record<string, never> {
  return Object.keys(params)
    .filter((k) => params[k] !== null)
    .reduce((a, k) => ({ ...a, [k]: params[k] }), {});
}
