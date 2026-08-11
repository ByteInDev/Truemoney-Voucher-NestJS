<br>

<div align="center">

# Truemoney-Voucher (NestJS)

**REST API for redeeming TrueMoney gift vouchers** — NestJS, no database

![License: MIT](https://img.shields.io/badge/license-MIT-yellow.svg)
![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-24-339933?logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)
![Jest](https://img.shields.io/badge/Jest-30-C21325?logo=jest&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)
[![Live on Vercel](https://img.shields.io/badge/Live-Vercel-000000?logo=vercel&logoColor=white)](https://truemoney-voucher-nestjs.vercel.app)

**English** - [Thai](README.th.md)

</div>

---

A NestJS port of the [Truemoney-Voucher Go API](https://github.com/ByteInDev/Truemoney-Voucher-Go).
It talks to `gift.truemoney.com` through a browser-fingerprint transport so
requests pass Cloudflare bot detection. One operation only: **redeem** a
voucher to a Thai mobile number. The wire contract (routes, validation,
error envelope, response passthrough) is identical to the Go version.

## Features

| Ability | Details |
| ------- | ------- |
| Redeem | `GET`/`POST /truemoney/{code}/{mobile}` - redeem to a mobile number (both methods are equivalent) |
| Raw code or full link | accepts `gift.truemoney.com/campaign/?v=<code>` URLs too |
| Input validation | code <= 128 chars; Thai mobile: 10 digits starting with `0` |
| Cloudflare bypass | `cycletls` (uTLS under the hood) with a Firefox JA3 + Firefox HTTP/2 fingerprint + fixed header order |
| Safe by design | codes masked in logs, raw TrueMoney JSON passthrough, graceful shutdown |

## Quick Start

```bash
npm install
npm run start:dev            # listens on :3000
```

Production:

```bash
npm run build
npm run start:prod
```

Check it is alive:

```bash
curl localhost:3000/status           # 200 OK (empty)
curl localhost:3000/                 # service info + routes
```

## API Reference

### Endpoints

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` / `POST` | `/truemoney/{code}/{mobile}` | Redeem a voucher |
| `GET` / `POST` | `/status` | Liveness probe |
| `GET` / `POST` | `/` | Service info and route list |

### Path parameters

| Param | Accepted format |
| ----- | --------------- |
| `code` | Raw code (alnum + `-`/`_`, <= 128 chars) or URL-encoded full link `https://gift.truemoney.com/campaign/?v=<code>` |
| `mobile` | Thai mobile: 10 digits starting with `0` (spaces/dashes auto-stripped) |

### Examples

```bash
# Redeem with a raw code - GET and POST are equivalent
curl "localhost:3000/truemoney/ABCD1234EFGH/0812345678"
curl -X POST "localhost:3000/truemoney/ABCD1234EFGH/0812345678"

# Redeem with a URL-encoded full link
curl "localhost:3000/truemoney/https%3A%2F%2Fgift.truemoney.com%2Fcampaign%2F%3Fv%3DABCD1234EFGH/0812345678"
```

### Responses

TrueMoney's JSON is passed through unchanged (including its `{"status": {...}}`
error envelope). Own errors are always `code` + `message`:

| HTTP status | Body | When |
| ----------- | ---- | ---- |
| `200` | `{"code": 400, "message": "Bad Request"}` | invalid code / mobile |
| `404` | `{"code": 404, "message": "Not Found"}` | unknown path |
| `200` | `{"code": 500, "message": "Internal Server Error"}` | TrueMoney call failed |
| `500` | `{"code": 500, "message": "Internal Server Error"}` | unhandled exception |

### TrueMoney status codes

Inside `status.code` of the envelope:

| Code | Meaning |
| ---- | ------- |
| `SUCCESS` | Money received successfully |
| `TARGET_USER_REDEEMED` | You already redeemed this voucher |
| `VOUCHER_OUT_OF_STOCK` | Someone else already took it |
| `VOUCHER_EXPIRED` | The wallet voucher has expired |
| `VOUCHER_NOT_FOUND` | Voucher not found in the system |
| `CANNOT_GET_OWN_VOUCHER` | Cannot redeem your own voucher |
| `TARGET_USER_NOT_FOUND` | Phone number not found in the system |
| `INTERNAL_ERROR` | Voucher not found, or the URL is wrong |

## Configuration

| Env var | Default | Description |
| ------- | ------- | ----------- |
| `PORT` | `3000` | HTTP listen port (1-65535) |

```bash
PORT=8080 npm run start:prod
```

## Deploy to Vercel

`api/index.js` is the serverless entrypoint: it bootstraps the NestJS app
once per function instance and hands every request to the Express adapter.
`vercel.json` rewrites every path into it and runs `npm run build` before
packaging.

```bash
npm run vercel:deploy        # = npm run build && vercel --prod
```

**Serverless caveats:**

- the cycletls transport spawns a bundled Go binary lazily — only on the
  first redeem, never at bootstrap, so `/status`, `/` and validation
  errors stay fast on cold instances. If Vercel blocks child processes,
  fall back to Docker
- `dist/` must exist when deploying (`npm run build` runs automatically via
  the `buildCommand` in `vercel.json`, or locally before `vercel --prod`)
- `cf_clearance` starts cold per instance — Cloudflare behaviour and latency
  may differ from Docker/VPS

**Performance on the Free (Hobby) plan:** functions run only in `iad1`
(US East) — Thailand→Virginia RTT (~200 ms) is fixed and unavoidable, and
cannot be configured away on a free plan. `maxDuration: 60` is honored.
Measure with a keep-alive client (e.g. `httpx`/`curl` with connection
reuse), not a fresh `curl.exe` per request, to see actual server time.

## Browser fingerprinting (cycletls)

The Go version hand-builds a Firefox TLS + HTTP/2 fingerprint with uTLS.
Node.js has no uTLS, so the NestJS port uses
[`cycletls`](https://www.npmjs.com/package/cycletls) — a bundled Go binary
(uTLS + custom HTTP/2) driven from JS — configured for Firefox:

- **JA3** TLS ClientHello fingerprint (`FIREFOX_JA3` in
  `src/truemoney/truemoney-client.cycletls.ts`)
- **HTTP/2 fingerprint**: header table 65536, push off, initial window
  131072, max frame 16384, MPAS priority — byte-identical values to the
  Go transport's SETTINGS
- **Fixed header order** on the wire, Firefox User-Agent (Firefox 148)

If TrueMoney tightens its fingerprint checks, swap `FIREFOX_JA3` for a
freshly captured Firefox JA3. Everything else (headers, settings, UA) must
move together — a mixed fingerprint is detectable.

## Architecture

- **`src/truemoney/`** — TrueMoney domain logic: validation (`voucher.ts`),
  client abstraction + cycletls implementation (`truemoney-client*.ts`),
  redeem orchestration (`truemoney.service.ts`), controller
  (`truemoney.controller.ts`). A shared cookie jar keeps `cf_clearance`
  warm across requests, like the Go version.
- **`src/common/`** — `AppError` + sentinels, JSON exception filter,
  request-logging interceptor (method/path/status/duration_ms), cookie jar,
  voucher-code masking.
- **`src/configure-app.ts`** — CORS (any origin, GET/POST/OPTIONS),
  global filter + interceptor, server timeouts (30s/10s/60s, like Go).

## Testing

```bash
npm test                # unit tests (validators, mask, jar, config, service)
npm run test:e2e        # HTTP contract via supertest with a mocked client
npm run lint
```

## Contributing

Contributions are welcome! Please:

1. Open an issue first for significant changes
2. Keep `npm run lint` green
3. Follow the existing code style

## Disclaimer

> **For educational use or where the provider permits it.**
> Redeeming is irreversible and governed by TrueMoney's Terms of Service.
> Voucher codes are cash-equivalent — never expose logs containing full codes.

## License

Licensed under the [MIT License](./LICENSE) © 2026 ByteInDev
