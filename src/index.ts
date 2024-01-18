import pg from "pg"
import fsp from "fs/promises"
import { VerAndLabel, MigrationsConfig, LocalMigrations } from "./entities"
import { findLastCleanVer, parseMigrationFiles } from "./internal/utils"
import { rollbackToVer, upgradeToVer } from "./internal/migration_ops"

export const getLocalMigrations = async (dirPath: string): Promise<LocalMigrations> => {
  let files = await fsp.readdir(dirPath)
  return parseMigrationFiles(files)
}

// Just call it everytime if you're not sure if migrations table exists
// It's safe to run this function even if table exists
export const createMigrationTable = async (client: pg.PoolClient | pg.Pool) => {
  await client.query(`
  CREATE TABLE IF NOT EXISTS applied_migrations (
    version BIGINT UNIQUE NOT NULL,
    label TEXT
  )`)
}

// Returns an array of versions and labels from smaller to bigger version number.
// Make sure that migrations table exists before calling this function
export const getAppliedMigrations = async (cfg: MigrationsConfig): Promise<VerAndLabel[]> => {
  const { client } = cfg
  const qresult = await client.query<VerAndLabel>(
    "SELECT (version, label) FROM applied_migrations ORDER BY version"
  )
  return qresult.rows
}

// Make sure that migrations table exists before calling this function
export const rollbackToCleanVer = async (cfg: MigrationsConfig): Promise<number> => {
  const appliedMigrations = await getAppliedMigrations(cfg)
  const cleanVer = findLastCleanVer(cfg.mLocal.versionsUP, appliedMigrations)
  if (cleanVer === null) {
    return appliedMigrations[appliedMigrations.length - 1].version
  }
  return cleanVer
}

// Migrates to some specific version
// Make sure that migrations table exists before calling this function
// 
// If you're migrating down -- make sure u have 
export const migrateTo = async (cfg: MigrationsConfig, targetVer: number) => {
  const { client, mLocal } = cfg
  const mApplied = await getAppliedMigrations(cfg)
  if (mApplied.length < 1) {
    // TODO: Just migrate all the way up
    return
  }
  let mCurrentVer = mApplied[mApplied.length - 1].version
  if (mCurrentVer === targetVer) {
    // Already up to date
    return
  } else if (mCurrentVer < targetVer) {
    // Upgrade 
    const cleanVer = findLastCleanVer(mLocal.versionsUP, mApplied);
    if (cleanVer !== null) {
      throw "DB is dirty. Migrate to a clean version before upgrading DB"
    }
    let mLocalUP: VerAndLabel[] = []
    mLocal.versionsUP.forEach(ver => {
      let mInfo = mLocal.migrationsUP.get(ver) 
      if (!mInfo) { return }
      mLocalUP = [...mLocalUP, {
        version: mInfo.version,
        label: mInfo.label,
      }]
    })
    upgradeToVer(client, mLocalUP, cfg.mDir, mCurrentVer, targetVer)
  } else {
    rollbackToVer(client, mApplied, cfg.mDir, targetVer)
  }
}


export type { VerAndLabel, MigrationInfo, MigrationsConfig } from "./entities"
export default {
  getLocalMigrations,
  createMigrationTable,
  getAppliedMigrations,
  rollbackToCleanVer,
  migrateTo
}
