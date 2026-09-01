import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../db/schema/index'

// Connexion singleton pour éviter de créer plusieurs pools en dev
let _db: ReturnType<typeof drizzle> | null = null

export function useDb() {
  if (_db) return _db

  const config = useRuntimeConfig()
  const url = config.databaseUrl

  if (!url) {
    throw new Error('DATABASE_URL is not set. Please check your .env file.')
  }

  const client = postgres(url, { max: 10 })
  _db = drizzle(client, { schema })
  return _db
}
