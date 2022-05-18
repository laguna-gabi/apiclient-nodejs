export function filterNonNullFields<T>(params): T | Record<string, never> {
  return Object.keys(params)
    .filter((k) => params[k] !== null)
    .reduce((a, k) => ({ ...a, [k]: params[k] }), {});
}

export const generateCustomErrorMessage = (className: string, functionName: string, result) => {
  return `failed to ${functionName} ${className}: status: ${result.status}, ${JSON.stringify(
    result.data,
  )}`;
};
