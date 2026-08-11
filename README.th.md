<br>

<div align="center">

# Truemoney-Voucher (NestJS)

**REST API สำหรับไถ่ถอนบัตรกำนัล TrueMoney** — NestJS, ไม่ใช้ฐานข้อมูล

![License: MIT](https://img.shields.io/badge/license-MIT-yellow.svg)
![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-24-339933?logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)
![Jest](https://img.shields.io/badge/Jest-30-C21325?logo=jest&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)
[![Live on Vercel](https://img.shields.io/badge/Live-Vercel-000000?logo=vercel&logoColor=white)](https://truemoney-voucher-nestjs.vercel.app)

[English](README.md) - **ไทย**

</div>

---

พอร์ตเวอร์ชัน NestJS ของ [Truemoney-Voucher Go API](https://github.com/ByteInDev/Truemoney-Voucher-Go)
พูดกับ `gift.truemoney.com` ผ่าน transport ที่เลียนแบบเบราว์เซอร์จริงเพื่อผ่านการตรวจจับบอตของ Cloudflare
มีแค่ operation เดียว: **redeem** (ไถ่ถอน) บัตรกำนัลไปยังเบอร์มือถือไทย
สัญญา wire contract (routes, validation, error envelope, response passthrough) เหมือนเวอร์ชัน Go ทุกประการ

## Features

| ความสามารถ | รายละเอียด |
| ----------- | ----------- |
| Redeem | `GET`/`POST /truemoney/{code}/{mobile}` - ไถ่ถอนไปยังเบอร์มือถือ (ทั้งสอง method เทียบเท่ากัน) |
| โค้ดดิบหรือลิงก์เต็ม | รับ `gift.truemoney.com/campaign/?v=<code>` ได้ด้วย |
| Input validation | code <= 128 ตัวอักษร; มือถือไทย: 10 หลัก ขึ้นต้นด้วย `0` |
| Cloudflare bypass | `cycletls` (ใช้ uTLS ภายใน) พร้อม JA3 ของ Firefox + Firefox HTTP/2 fingerprint + ลำดับ header คงที่ |
| Safe by design | โค้ดถูกปิดบัง (mask) ใน log, ส่งต่อ JSON ดิบจาก TrueMoney, graceful shutdown |

## Quick Start

```bash
npm install
npm run start:dev            # ฟังพอร์ต :3000
```

โพรดักชัน:

```bash
npm run build
npm run start:prod
```

เช็กว่าเซิร์ฟเวอร์พร้อม:

```bash
curl localhost:3000/status           # 200 OK (ว่าง)
curl localhost:3000/                 # service info + routes
```

ด้วย Docker:

```bash
docker build -t truemoney-voucher-nestjs .
docker run -d -p 3000:3000 truemoney-voucher-nestjs
```

## API Reference

### Endpoints

| Method | Path | คำอธิบาย |
| ------ | ---- | -------- |
| `GET` / `POST` | `/truemoney/{code}/{mobile}` | ไถ่ถอนบัตรกำนัล |
| `GET` / `POST` | `/status` | Liveness probe |
| `GET` / `POST` | `/` | ข้อมูล service และรายการ route |

### Path parameters

| Param | รูปแบบที่รับได้ |
| ----- | --------------- |
| `code` | โค้ดดิบ (ตัวอักษร/ตัวเลข + `-`/`_`, <= 128 ตัว) หรือลิงก์เต็มแบบ URL-encoded `https://gift.truemoney.com/campaign/?v=<code>` |
| `mobile` | มือถือไทย: 10 หลัก ขึ้นต้นด้วย `0` (ตัดช่องว่าง/ขีดให้อัตโนมัติ) |

### ตัวอย่าง

```bash
# ไถ่ถอนด้วยโค้ดดิบ - GET และ POST เทียบเท่ากัน
curl "localhost:3000/truemoney/ABCD1234EFGH/0812345678"
curl -X POST "localhost:3000/truemoney/ABCD1234EFGH/0812345678"

# ไถ่ถอนด้วยลิงก์เต็มแบบ URL-encoded
curl "localhost:3000/truemoney/https%3A%2F%2Fgift.truemoney.com%2Fcampaign%2F%3Fv%3DABCD1234EFGH/0812345678"
```

### Responses

JSON ของ TrueMoney ถูกส่งต่อตามเดิมทุกประการ (รวมถึง error envelope `{"status": {...}}`)
error ที่เกิดจากตัวเราเป็น `code` + `message` เสมอ:

| HTTP status | Body | เมื่อเกิด |
| ----------- | ---- | -------- |
| `200` | `{"code": 400, "message": "Bad Request"}` | code / mobile ไม่ถูกต้อง |
| `404` | `{"code": 404, "message": "Not Found"}` | path ไม่มี |
| `200` | `{"code": 500, "message": "Internal Server Error"}` | การเรียก TrueMoney ล้มเหลว |
| `500` | `{"code": 500, "message": "Internal Server Error"}` | exception ที่ไม่คาดคิด |

### รหัสสถานะ TrueMoney

ภายใน `status.code` ของ envelope:

| Code | ความหมาย |
| ---- | -------- |
| `SUCCESS` | ได้รับเงินสำเร็จ |
| `TARGET_USER_REDEEMED` | คุณไถ่ถอนบัตรนี้ไปแล้ว |
| `VOUCHER_OUT_OF_STOCK` | มีคนอื่นไถ่ถอนไปแล้ว |
| `VOUCHER_EXPIRED` | บัตรกำนัลหมดอายุ |
| `VOUCHER_NOT_FOUND` | ไม่พบบัตรกำนัลในระบบ |
| `CANNOT_GET_OWN_VOUCHER` | ไม่สามารถไถ่ถอนบัตรของตัวเอง |
| `TARGET_USER_NOT_FOUND` | ไม่พบเบอร์โทรศัพท์ในระบบ |
| `INTERNAL_ERROR` | ไม่พบบัตร หรือ URL ผิด |

## Configuration

| ตัวแปร env | ค่าเริ่มต้น | คำอธิบาย |
| ---------- | ----------- | -------- |
| `PORT` | `3000` | พอร์ต HTTP (1-65535) |

```bash
PORT=8080 npm run start:prod
```

## Deploy บน Vercel

`api/index.js` คือ serverless entrypoint: bootstrap แอป NestJS หนึ่งครั้งต่อ
function instance แล้วส่งทุก request ไปที่ Express adapter
`vercel.json` rewrite ทุก path เข้ามาที่ฟังก์ชันนี้ และรัน `npm run build`
ก่อนแพ็ก

```bash
npm run vercel:deploy        # = npm run build && vercel --prod
```

**ข้อควรระวังแบบ serverless:**

- transport cycletls spawn ไบนารี Go แบบ **lazy** — เฉพาะ redeem ครั้งแรก
  ไม่ใช่ตอน bootstrap ทำให้ `/status`, `/` และ validation error ยังเร็วแม้
  instance เย็น ถ้า Vercel บล็อก child process ให้กลับไปใช้ Docker แทน
- ต้องมี `dist/` ตอน deploy (`npm run build` รันอัตโนมัติผ่าน `buildCommand`
  ใน `vercel.json` หรือรันเองก่อน `vercel --prod`)
- `cf_clearance` เริ่มเย็นทุก instance — พฤติกรรมกับ Cloudflare และ latency
  อาจต่างจาก Docker/VPS

**ประสิทธิภาพบน Free (Hobby) plan:** ฟังก์ชันรันได้แค่ `iad1` (US East)
— RTT ไทย→เวอร์จิเนีย (~200 ms) แก้ไม่ได้บน free plan
`maxDuration: 60` ใช้ได้ วัดด้วย client แบบ keep-alive
(เช่น `httpx` หรือ curl ที่ reuse connection) อย่าใช้ `curl.exe` ใหม่ทุกครั้ง
เพื่อดูเวลา server จริง

## Browser fingerprinting (cycletls)

เวอร์ชัน Go สร้าง Firefox TLS + HTTP/2 fingerprint ด้วยมือโดยใช้ uTLS
Node.js ไม่มี uTLS ดังนั้นพอร์ต NestJS จึงใช้
[`cycletls`](https://www.npmjs.com/package/cycletls) — ไบนารี Go ในตัว (uTLS + HTTP/2 แบบกำหนดเอง)
ขับเคลื่อนจาก JS — ตั้งค่าตาม Firefox:

- **JA3** TLS ClientHello fingerprint (`FIREFOX_JA3` ใน `src/truemoney/truemoney-client.cycletls.ts`)
- **HTTP/2 fingerprint**: header table 65536, push off, initial window 131072,
  max frame 16384, MPAS priority — ค่าตรงกับ SETTINGS ของ Go transport แบบ byte-identical
- **ลำดับ header คงที่** บนสายส่ง, User-Agent ของ Firefox (Firefox 148)

ถ้า TrueMoney เข้มงวดการตรวจ fingerprint มากขึ้น ให้เปลี่ยน `FIREFOX_JA3` เป็น
JA3 ของ Firefox ที่ capture ใหม่สด ทุกอย่างอื่น (headers, settings, UA) ต้องแก้ไปพร้อมกัน —
fingerprint แบบผสมจะถูกตรวจจับได้

## Architecture

- **`src/truemoney/`** — ตรรกะโดเมน TrueMoney: validation (`voucher.ts`),
  client abstraction + cycletls implementation (`truemoney-client*.ts`),
  redeem orchestration (`truemoney.service.ts`), controller (`truemoney.controller.ts`)
  cookie jar ร่วมกันช่วยให้ `cf_clearance` อบอุ่นตลอดทุก request เหมือนเวอร์ชัน Go
- **`src/common/`** — `AppError` + sentinels, JSON exception filter,
  request-logging interceptor (method/path/status/duration_ms), cookie jar,
  การปิดบังโค้ดบัตรกำนัล
- **`src/configure-app.ts`** — CORS (ทุก origin, GET/POST/OPTIONS),
  global filter + interceptor, server timeouts (30s/10s/60s เหมือน Go)

## Testing

```bash
npm test                # unit tests (validators, mask, jar, config, service)
npm run test:e2e        # HTTP contract via supertest พร้อม client จำลอง (mock)
npm run lint
```

## การมีส่วนร่วม

ยินดีต้อนรับทุกการมีส่วนร่วมครับ:

1. กรุณาเปิด issue เพื่อหารือก่อนสำหรับการเปลี่ยนแปลงที่มีนัยสำคัญ
2. รักษา `npm run lint` ให้ผ่านเสมอ
3. ปฏิบัติตาม code style ที่มีอยู่

## Disclaimer

> **สำหรับการศึกษาหรือในที่ที่ผู้ให้บริการอนุญาต**
> การไถ่ถอนไม่สามารถย้อนกลับได้ และอยู่ภายใต้ข้อกำหนดการใช้งานของ TrueMoney
> รหัสบัตรกำนัลมีค่าเทียบเท่าเงินสด — อย่าเปิดเผย log ที่มีโค้ดเต็ม

## License

ภายใต้ [MIT License](./LICENSE) © 2026 ByteInDev