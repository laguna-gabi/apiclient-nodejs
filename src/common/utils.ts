export function log(text: string, className?: string) {
  const now = new Date();
  console.debug(
    `${now.toLocaleDateString()}, ${now.toLocaleTimeString()}   ${
      className ? `[${className}]` : ``
    } ${text}`,
  );
}
