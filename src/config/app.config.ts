export const DEFAULT_PORT = 3000;

export function loadPort(): number {
  const raw = process.env.PORT;
  if (raw === undefined || raw === '') {
    return DEFAULT_PORT;
  }
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      `invalid PORT "${raw}": must be a number between 1 and 65535`,
    );
  }
  return port;
}
