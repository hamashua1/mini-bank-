# Mini Bank — Project Logic

## Overview

Mini Bank is a full-stack banking application with a Node.js/Express/TypeScript backend and a React frontend. It supports multiple database backends (MongoDB, PostgreSQL, MySQL) switchable at runtime, and embeds the Papermap AI assistant scoped per user for data analysis.

---

## Architecture

```
Frontend (React, port 3001)
  └── AuthContext  →  REST API calls  →  Backend (Express, port 3000)
                                              ├── Auth routes
                                              ├── Wallet routes
                                              ├── Transaction routes
                                              └── Repository registry
                                                    ├── Mongo repos  (DB_TYPE=mongo)
                                                    └── SQL repos    (DB_TYPE=postgres|mysql)
```

### Multi-DB Strategy

The active database is controlled by the `DB_TYPE` environment variable, set via `cross-env` in npm scripts:

| Script            | DB_TYPE    | Database              |
|-------------------|------------|-----------------------|
| `npm run dev:mongo`  | `mongo`   | MongoDB (Atlas)       |
| `npm run dev:pg`     | `postgres` | PostgreSQL (Railway)  |
| `npm run dev:mysql`  | `mysql`    | MySQL (Railway)       |

At startup, `initRepositories()` reads `DB_TYPE` and binds the correct concrete repo implementations to the shared `UserRepo`, `WalletRepo`, `TransactionRepo`, and `TenantDashboardRepo` exports. All controllers talk only to these interface-typed repos — they are DB-agnostic.

---

## Startup Flow

1. Load `.env` via `dotenv`
2. If SQL mode: copy `DATABASE_URL_POSTGRES` or `DATABASE_URL_MYSQL` into `DATABASE_URL` (required by Prisma)
3. Validate required env vars for the active DB mode — exit with error if any are missing
4. `initRepositories()` — wire DB-specific repo implementations
5. Connect to the database:
   - **Mongo**: `mongoose.connect()` then run startup backfills (see below)
   - **SQL**: Prisma connect
6. Start Express on `PORT` (default `3000`)

### Startup Backfills (Mongo only)

Run once on every startup, idempotent (no-ops after first run):

- **walletId backfill**: Any wallet document missing a `walletId` field gets `walletId = _id.toString()`
- **userId backfill**: Any wallet document with an ObjectId-typed `userId` gets it converted to a string, ensuring Papermap tenant-scoping (string equality) works correctly

---

## Auth Flow

### Signup — `POST /api/auth/signup`

1. Validate email format and password length (min 8 chars)
2. Check email is not already taken
3. Hash password with bcrypt (10 rounds)
4. Create user record
5. Provision a Papermap dashboard for this user (non-fatal if it fails)
6. Return `201` with `userId`

### Login — `POST /api/auth/login`

1. Validate email and password inputs
2. Look up user by email; compare password hash
3. Issue a short-lived **access token** (JWT, `JWT_EXPIRES_IN`, default `1h`)
4. Issue a long-lived **refresh token** (JWT, `REFRESH_TOKEN_EXPIRES_IN`, default `7d`), hash and store it
5. Call `getOrCreateTenantDashboard` to get/create the user's Papermap dashboard
6. Call `generatePapermapToken` to produce a 24-hour Papermap token embedding the user's `dashboardId` and `tenant_id`
7. Return `accessToken`, `refreshToken`, `papermapToken`

### Token Refresh — `POST /api/auth/refresh`

1. Verify the refresh token (JWT)
2. Look up user; compare hashed refresh token stored in DB
3. Issue new access token and new refresh token
4. Regenerate Papermap token (fresh 24-hour window)
5. Return all three tokens

### Logout — `POST /api/auth/logout` *(authenticated)*

1. Clear the stored refresh token hash for the user
2. Return `200`

### Get Papermap Token — `GET /api/auth/papermap-token` *(authenticated)*

Used by the frontend on page load if no Papermap token is in localStorage.

1. Look up user by `userId` from JWT
2. Call `getOrCreateTenantDashboard`
3. Return a fresh `papermapToken`

### Authentication Middleware

Every protected route passes through `authenticate`:

1. Read `Authorization: Bearer <token>` header
2. Verify JWT with `JWT_SECRET`
3. Attach `req.userId` (string) for downstream handlers

Rate limiting (`authRateLimiter`) is applied to all auth endpoints.

---

## WebAuthn (Biometric Login)

Allows users to register and authenticate with device biometrics (fingerprint/Face ID) as an alternative to password.

- `POST /api/auth/webauthn/register/options` — generate registration challenge *(authenticated)*
- `POST /api/auth/webauthn/register/verify` — verify and store credential *(authenticated)*
- `POST /api/auth/webauthn/login/options` — generate authentication challenge
- `POST /api/auth/webauthn/login/verify` — verify credential, return same token set as password login

---

## Wallet Flow

One wallet per user. Supported currencies: `USD`, `EUR`, `GBP`, `NGN`.

### Create — `POST /api/wallet`

1. Validate currency is in the supported list
2. Check user does not already have a wallet
3. Create wallet with `balance: 0`
4. Return `walletId`, `balance`, `currency`

### Get — `GET /api/wallet`

Returns current wallet state: `walletId`, `balance`, `currency`, `createdAt`.

### Deposit — `POST /api/wallet/deposit`

1. Validate amount (positive finite number) and description (non-empty, max 200 chars)
2. Find wallet by `userId`
3. Increment balance, record a `deposit` transaction (stores `balanceBefore`, `balanceAfter`)
4. Return new `balance` and transaction record

### Withdraw — `POST /api/wallet/withdraw`

Same as deposit but decrements balance. Throws `INSUFFICIENT_BALANCE` if `balance < amount`.

### Transfer — `POST /api/wallet/transfer`

1. Validate `toWalletId`, `amount`, `description`
2. Find sender wallet by `userId`
3. Find recipient wallet by `walletId`
4. Guard: sender ≠ recipient (`SELF_TRANSFER`)
5. Guard: same currency (`CURRENCY_MISMATCH`)
6. Guard: sufficient balance (`INSUFFICIENT_BALANCE`)
7. Deduct from sender, credit recipient (atomic via MongoDB session / Prisma transaction)
8. Record `transfer_out` on sender, `transfer_in` on recipient
9. Return sender's new `balance`

---

## Transaction Flow

Transactions are always created by wallet operations — never directly by the client.

Each transaction stores: `walletId`, `type`, `amount`, `balanceBefore`, `balanceAfter`, `description`, `createdAt`.

Types: `deposit` | `withdraw` | `transfer_in` | `transfer_out`

### List — `GET /api/transactions`

Returns paginated transaction history for the authenticated user's wallet. Query params: `page`, `limit`.

### Get by ID — `GET /api/transactions/:id`

Returns a single transaction, validated against the user's `walletId` (users can only access their own transactions).

---

## Papermap AI Integration

Papermap is an AI data assistant embedded in the frontend. It queries the live database scoped to the logged-in user.

### Key Concepts

| Concept | Description |
|---|---|
| `workspace_id` | Points Papermap to the correct database (one per DB type) |
| `tenant_id` | The user's `_id` string — Papermap filters all queries to documents matching this value |
| `dashboard_id` | Unique per user — the UI shell for their pinned charts |
| Papermap token | Base64-encoded JSON payload signed with HMAC-SHA256, valid 24 hours |

### Dashboard Provisioning — `getOrCreateTenantDashboard`

Called on every login and signup:

1. Look up existing `tenantDashboard` record for this `userId`
2. If it exists **and** the `workspaceId` matches the currently active workspace → return the stored `dashboardId` immediately (no API call)
3. Otherwise (new user, or workspace changed): call the Papermap API to create a new dashboard titled `Mini Bank - <email>`
4. Upsert the tenant record with the new `workspaceId` and `dashboardId`
5. Return the `dashboardId`

This means workspace changes (e.g. switching from Mongo to Postgres creds) automatically re-provision dashboards rather than serving a stale mapping.

### Token Generation — `generatePapermapToken`

```
payload = {
  api_key_id,       // identifies the Papermap API key
  workspace_id,     // the active DB workspace
  tenant_id,        // user's _id — scopes all AI queries to this user
  dashboard_id,     // user's unique dashboard
  valid_until,      // Unix timestamp, 24 hours from now
  signature,        // HMAC-SHA256(workspaceId + validUntil, secretKey)
}
token = base64(JSON.stringify(payload))
```

### Frontend Integration

In `App.jsx`, `AuthenticatedLayout`:

1. Decode the Papermap token from `localStorage` (base64 → JSON)
2. Extract `workspace_id` and `dashboard_id` from the payload
3. If all three (`token`, `workspaceId`, `dashboardId`) are present, mount `PapermapConfigProvider` + `PaperChat`
4. The widget sends queries to Papermap with the token — Papermap uses `tenant_id` to scope database queries to that user's documents only

Token lifecycle in `AuthContext`:
- Stored in `localStorage` on login
- Loaded from `localStorage` on page refresh
- Fetched fresh from `GET /api/auth/papermap-token` if missing from localStorage
- Cleared on logout

---

## Data Models (MongoDB)

### User
| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | Primary key |
| `email` | String | Unique |
| `passwordHash` | String | bcrypt |
| `refreshToken` | String \| null | Hashed refresh token |
| `webAuthnCredentials` | Array | Biometric credentials |

### Wallet
| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | Internal DB key |
| `walletId` | String | Public-facing ID, equals `_id.toString()` |
| `userId` | String | Owner's `user._id.toString()` |
| `balance` | Number | Current balance |
| `currency` | String | USD / EUR / GBP / NGN |

### Transaction
| Field | Type | Notes |
|---|---|---|
| `walletId` | ObjectId | Ref to Wallet |
| `type` | String | deposit / withdraw / transfer_in / transfer_out |
| `amount` | Number | |
| `balanceBefore` | Number | Balance before the operation |
| `balanceAfter` | Number | Balance after the operation |
| `description` | String | Max 200 chars |
| `createdAt` | Date | Auto |

### TenantDashboard
| Field | Type | Notes |
|---|---|---|
| `tenantId` | String | User's `_id.toString()`, unique |
| `workspaceId` | String | Papermap workspace at time of creation |
| `dashboardId` | String | User's Papermap dashboard ID |
