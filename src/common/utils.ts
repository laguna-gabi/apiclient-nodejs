export const filterNonNullFields = (params) => {
  return Object.keys(params)
    .filter((k) => params[k] !== null)
    .reduce((a, k) => ({ ...a, [k]: params[k] }), {});
};
