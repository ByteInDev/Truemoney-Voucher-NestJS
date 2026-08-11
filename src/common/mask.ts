export function maskCode(code: string): string {
  if (code.length <= 8) {
    return '****';
  }
  return code.slice(0, 4) + '****' + code.slice(-4);
}
