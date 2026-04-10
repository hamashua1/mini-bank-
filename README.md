# Mini Bank API

A RESTful banking backend built with Node.js, Express, TypeScript, and MongoDB. Supports user authentication, wallet management, and transaction history with full ACID-compliant operations.

## System Architecture

```
                        ┌───────────────────────────────┐
                        │         FRONTEND APP           │
                        │  (Web, Mobile, Admin Panel)    │
                        └─────────────────────┬──────────┘
                                              │
                               HTTPS (REST API Requests)
                                              │
                                              ▼
                    ┌──────────────────────────────────────────┐
                    │        EXPRESS.JS BACKEND SERVER         │
                    │  Authentication, Wallet, Transactions     │
                    └───────────────────┬──────────────────────┘
                                        │
                      ┌─────────────────┼─────────────────┐
                      │                 │                 │
                      ▼                 ▼                 ▼
        ┌────────────────────┐  ┌──────────────────┐  ┌─────────────────────┐
        │  Auth Controller   │  │ Wallet Controller│  │Transaction Controller│
        │  JWT, Sessions     │  │ Balance Logic    │  │ Tx Logging Logic    │
        └─────────┬──────────┘  └───────┬──────────┘  └─────────┬──────────┘
                  │                     │                        │
                  ▼                     ▼                        ▼
      ┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐
      │   USER COLLECTION    │ │  WALLET COLLECTION    │ │ TRANSACTION RECORDS  │
      │  (MongoDB Document)  │ │   (MongoDB Document)  │ │   (MongoDB Document) │
      └──────────────────────┘ └──────────────────────┘ └──────────────────────┘
```

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **Framework:** Express.js v5
- **Database:** MongoDB (Mongoose ODM)
- **Auth:** JWT (access + refresh tokens), bcrypt
- **Testing:** Jest + Supertest + mongodb-memory-server

## Project Structure

```
src/
├── app.ts                        # Express app entry point
├── controllers/
│   ├── auth.controller.ts        # Signup, login, refresh, logout
│   ├── wallet.controller.ts      # Create wallet, deposit, withdraw, transfer
│   └── transaction.controller.ts # Transaction history and lookup
├── routes/
│   ├── auth.routes.ts
│   ├── wallet.routes.ts
│   └── transaction.routes.ts
├── models/
│   ├── user.model.ts
│   ├── wallet.model.ts
│   └── transaction.model.ts
├── middleware/
│   ├── auth.ts                   # JWT authentication middleware
│   └── rateLimiter.ts            # Rate limiting for auth routes
└── db/
    └── connect.ts                # MongoDB connection
```

## API Endpoints

### Auth — `/api/auth`
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/signup` | — | Create a new account |
| POST | `/login` | — | Login and receive tokens |
| POST | `/refresh` | — | Refresh access token |
| POST | `/logout` | ✅ | Invalidate refresh token |

### Wallet — `/api/wallet`
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/` | ✅ | Create a wallet (pass `currency`) |
| GET | `/` | ✅ | Get wallet balance and details |
| POST | `/deposit` | ✅ | Deposit funds |
| POST | `/withdraw` | ✅ | Withdraw funds |
| POST | `/transfer` | ✅ | Transfer to another wallet by `walletId` |

### Transactions — `/api/transactions`
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | ✅ | Get all transactions (filter: `deposit`, `withdraw`, `transfer`) |
| GET | `/:id` | ✅ | Get a single transaction by ID |

## Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
Create a `.env` file in the root:
```env
PORT=3000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=1h
REFRESH_TOKEN_SECRET=your_refresh_secret
REFRESH_TOKEN_EXPIRES_IN=7d
CLIENT_ORIGIN=http://localhost:3000
```

### 3. Run in development
```bash
npm run dev
```

### Database switching (secure)

Set these env vars in `.env`:

```env
DATABASE_URL_POSTGRES=postgresql://...
DATABASE_URL_MYSQL=mysql://...
```

Then run by backend type:

```bash
npm run dev:pg
npm run dev:mysql
npm run dev:mongo
```

### 4. Build for production
```bash
npm run build
npm start
```

## Key Design Decisions

- **Atomic transactions** — all wallet operations (deposit, withdraw, transfer) use MongoDB sessions with `withTransaction()` ensuring full rollback on failure
- **One wallet per user** — enforced at both the application level and the database level via a unique index on `userId`
- **Immutable transaction log** — transaction records have `updatedAt` disabled; the audit trail cannot be modified
- **Refresh token rotation** — refresh tokens are hashed with bcrypt and rotated on every use
