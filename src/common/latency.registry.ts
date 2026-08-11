import { Injectable } from '@nestjs/common';

// In-process per-route latency snapshot (ms) surfaced on the root
// endpoint as { ms: { "/": 1, "/status": 0, "/truemoney": 342 } }.
@Injectable()
export class LatencyRegistry {
  private readonly ms = new Map<string, number>();

  record(path: string, ms: number): void {
    this.ms.set(path, ms);
  }

  snapshot(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [key, value] of this.ms) {
      out[key] = value;
    }
    return out;
  }
}

// normalizePath maps Express route patterns to stable root keys:
// "/truemoney/:code/:mobile" -> "/truemoney", "" -> "/".
export function normalizePath(routePath: string | undefined): string {
  if (!routePath || routePath === '/') {
    return '/';
  }
  const paramIndex = routePath.indexOf('/:');
  if (paramIndex !== -1) {
    return routePath.slice(0, paramIndex);
  }
  return routePath;
}