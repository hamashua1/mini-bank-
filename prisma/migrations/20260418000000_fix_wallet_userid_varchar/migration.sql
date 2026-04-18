-- Auth is exclusively MongoDB; Wallet.userId stores a MongoDB ObjectId (24 chars),
-- not a PostgreSQL UUID. Drop the FK and convert the column type.

ALTER TABLE "Wallet" DROP CONSTRAINT IF EXISTS "Wallet_userId_fkey";

ALTER TABLE "Wallet" ALTER COLUMN "userId" TYPE VARCHAR(36) USING "userId"::text;
