import pg from "pg"
import path from "path"
import fsp from "fs/promises"
import { VerAndLabel, MigrationsConfig, LocalMigrations, Migration } from "./entities"
import { parseIdAndLabel, tx } from "./internal/utils"


export const loadMigrationDir = async (dirPath: string): Promise<LocalMigrations> => {
  let files = await fsp.readdir(dirPath)
  let result: LocalMigrations = {
    versionsUP:     [],
    migrationsUP:   new Map<BigInt, Migration>,
    migrationsDown: new Map<BigInt, Migration>,
  }

  for (let i = 0; i < files.length; i++) {
    let fname = files[i]
    let [idAndLabel, action, ext] = fname.split(".", 3);
    if (ext != "sql") { continue };

    let verAndLabel = parseIdAndLabel(idAndLabel);
    let queryBuff = await fsp.readFile(path.join(dirPath, fname))
    let migration: Migration = {
      version: verAndLabel.version,
      label: verAndLabel.label,
      query: queryBuff.toString(),
    }

    if (action === "up")  {
      const existingMigration = result.migrationsUP.get(verAndLabel.version);
      if (existingMigration) {
        throw `Duplicate migration version files: ${existingMigration} and ${fname}`;
      };
      result.versionsUP = [...result.versionsUP, verAndLabel.version];
      result.migrationsUP.set(verAndLabel.version, migration);
    } else {
      const existingMigration = result.migrationsDown.get(verAndLabel.version);
      if (existingMigration) {
        throw `Duplicate migration version files: ${existingMigration} and ${fname}`;
      }
      result.migrationsDown.set(verAndLabel.version, migration);
    }
  }

  return result;
}


// Just call it everytime if you're not sure if migrations table exists
// It's safe to run this function even if table exists
export const createMigrationTable = async (pool: pg.Pool) => {
  await pool.query(`
  CREATE TABLE IF NOT EXISTS applied_migrations (
    version BIGINT UNIQUE NOT NULL,
    label TEXT
  )`)
}


// Returns an array of versions and labels from smaller to bigger version number.
// Make sure that migrations table exists before calling this function
export const getAppliedMigrations = async (cfg: MigrationsConfig): Promise<VerAndLabel[]> => {
  pg.types.setTypeParser(20, BigInt);
  const { pool } = cfg
  const qresult = await pool.query<VerAndLabel>(
    "SELECT (version, label) FROM applied_migrations ORDER BY version"
  )
  return qresult.rows
}


// Rollback a single migration using down migration from a file
export const rollbackMigration = async (pool: pg.Pool, fpath: string, version: number) => {
  return tx(pool, async (client) => {
    let queryBuff = await fsp.readFile(fpath).catch(err => { throw err });
    await client.query(queryBuff.toString());
    await client.query("DELETE FROM applied_migrations WHERE version=$1", [version]);
  })
}


// Before rolling back be sure that applied migrations contain target version
export const rollbackToVer = async (
  pool: pg.Pool,
  mLocal: LocalMigrations,
  mApplied: VerAndLabel[],
  targetVer: BigInt,
) => {
  let mRollaback: Migration[] = []
  for (let i = mApplied.length - 1; i >= 0; i--) {
    const mVer = mApplied[i].version
    if (mVer < targetVer) { 
      break
    }
    const mDown = mLocal.migrationsDown.get(mVer)
    if (!mDown) {
      throw `No down migration for version ${mVer}`
    }
    if (mDown.label != mApplied[i].label) {
      throw `Label of the applied migration (${mApplied[i].label}) doesn't match `+
        `with local down migration (${mDown.label}). Migration version: ${mVer}`
    }
    mRollaback = [...mRollaback, mDown]
  }

  return await tx(pool, async (client) => {
    for (let i = 0; i < mRollaback.length; i++) {
      const migration = mRollaback[i]
      await client.query(migration.query);
      await client.query("DELETE FROM applied_migrations WHERE version=$1", [migration.version]);
    }
  })
};


// if return is null -- every version is clean 
// if return is -1 -- no clean versions
export const findLastCleanVer = (localMigrationIDs: BigInt[], appliedMigrations: VerAndLabel[]): BigInt | null =>  {
  let minLen = Math.min(localMigrationIDs.length, appliedMigrations.length) 
  let i = 0
  let clean: boolean = true
  for (; i < minLen; i++) {
    if (localMigrationIDs[i] !== appliedMigrations[i].version) {
      clean = false
      break;
    }
  }
  return clean ? null : localMigrationIDs[i-1]
}

// Make sure that migrations table exists before calling this function
export const rollbackToCleanVer = async (cfg: MigrationsConfig): Promise<BigInt> => {
  const mApplied = await getAppliedMigrations(cfg)
  const cleanVer = findLastCleanVer(cfg.mLocal.versionsUP, mApplied)
  if (cleanVer === null) {
    return mApplied[mApplied.length - 1].version
  }
  rollbackToVer(cfg.pool, cfg.mLocal, mApplied, cleanVer)
  return cleanVer
}


// Apply a single migration from a file 
export const applyMigration = async (pool: pg.Pool, fpath: string, version: number, label: string) => {
  return await tx(pool, async (client) => {
    let queryBuff = await fsp.readFile(fpath)
    await client.query(queryBuff.toString())
    await client.query("INSERT INTO applied_migrations (version, label) VALUES ($1, $2)", [version, label])
  })
}

// Before upgrading you must be sure that DB version is clean
// (current version and all version bellow are exist in local migrations up) 
export const upgradeToVer = async (
  pool: pg.Pool,
  localMigrations: LocalMigrations,
  currentVer: BigInt,
  targetVer: BigInt,
) => {
  let idxCurrent = localMigrations.versionsUP.indexOf(currentVer)
  if (idxCurrent < 0) { throw "Current version isn't listed in local migrations" }
  let idxTarget = localMigrations.versionsUP.indexOf(targetVer)
  if (idxTarget < 0) { throw "Target version isn't listed in local migrations" }
  let applyVersions = localMigrations.versionsUP 
  applyVersions.slice(idxCurrent+1, idxTarget)

  return await tx(pool, async (client) => {
    let mVer: BigInt
    for (let i = 0; i < applyVersions.length; i++) {
      mVer = applyVersions[i]
      let migration = localMigrations.migrationsUP.get(mVer)
      if (!migration) { 
        throw `Failed to get migration version ${mVer}. Probably error in migrations loading`
      }
      await client.query(migration.query)
      await client.query("INSERT INTO applied_migrations (version, label) "+
        "VALUES ($1, $2)", [migration.version, migration.label])
    }
  })
}


// Migrates to some specific version
// Make sure that migrations table exists before calling this function
// 
// If you're migrating down -- make sure u have 
export const migrateTo = async (cfg: MigrationsConfig, targetVer: BigInt) => {
  const { pool, mLocal } = cfg
  const mApplied = await getAppliedMigrations(cfg)

  let mCurrentVer: BigInt | null = null
  if (mApplied.length >= 1) {
    mCurrentVer = mApplied[mApplied.length - 1].version
  }

  if (mCurrentVer === targetVer) {
    // Already up to date
    return
  } else if (!mCurrentVer || mCurrentVer < targetVer) {
    const cleanVer = findLastCleanVer(mLocal.versionsUP, mApplied);
    if (cleanVer !== null) {
      throw "DB is dirty. Migrate to a clean version before upgrading DB"
    }
    upgradeToVer(pool, mLocal, mCurrentVer || BigInt(-1), targetVer)
  } else {
    rollbackToVer(pool, mLocal, mApplied, targetVer)
  }
}


export type { VerAndLabel, Migration, MigrationsConfig } from "./entities"
export default {
  loadMigrationDir,
  createMigrationTable,
  getAppliedMigrations,
  findLastCleanVer,
  rollbackToCleanVer,
  migrateTo
}
