import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  sqliteReady: Promise<void> | undefined
}

// Quieter logs in dev (no per-query spam) - only errors and warnings
export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

/**
 * SQLite defaults are connection-local. Run the safety pragmas once for the
 * Prisma singleton and let API entry points await this promise before a query.
 *
 * C36 fix (2026-AUG): without these pragmas, foreign_keys are NOT enforced
 * (SQLite defaults to OFF), WAL mode is not enabled (slower + lock contention),
 * and busy_timeout is 0 (immediate SQLITE_BUSY on any concurrent write).
 */
export const dbReady = globalForPrisma.sqliteReady ?? (async () => {
  await db.$queryRawUnsafe('PRAGMA foreign_keys = ON;')
  await db.$queryRawUnsafe('PRAGMA busy_timeout = 5000;')
  await db.$queryRawUnsafe('PRAGMA journal_mode = WAL;')
  await db.$queryRawUnsafe('PRAGMA synchronous = NORMAL;')
})().catch((error) => {
  console.error('[db] SQLite initialization failed:', error)
  throw error
})

if (!globalForPrisma.sqliteReady) globalForPrisma.sqliteReady = dbReady
