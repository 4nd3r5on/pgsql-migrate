import pg from "pg"
import tx from "pg-tx"
import fsp from "fs/promises"
import { VerAndLabel } from "../entities";
import path from "path";
import { verAndLabelToFName } from "./utils";


// Apply a single migration from a file 
export const applyMigration = async (client: pg.Pool | pg.PoolClient, fpath: string, version: number, label: string) => {
  let queryBuff = await fsp.readFile(fpath).catch(err => { throw err });
  await tx(client, async (db) => {
    db.query(queryBuff.toString());
    db.query("INSERT INTO applied_migrations (version, label) VALUES ($1, $2)", [version, label]);
  });
};


// Rollback a single migration using down migration from a file
export const rollbackMigration = async (client: pg.Pool | pg.PoolClient, down_fpath: string, version: number) => {
  let queryBuff = await fsp.readFile(down_fpath).catch(err => { throw err });
  await tx(client, async (db) => {
    await db.query(queryBuff.toString());
    await db.query("DELETE FROM applied_migrations WHERE version=$1", [version]);
  });
};


// Before rolling back be sure that applied migrations contain target version
export const rollbackToVer = async (
  client: pg.Pool | pg.PoolClient,
  appliedMigrations: VerAndLabel[],
  migrationsDir: string,
  targetVer: number,
) => {
  await tx(client, async (db) => {
    for (let i = appliedMigrations.length - 1; i >= 0; i--) {
      const migration = appliedMigrations[i];
      if (migration.version > targetVer) {
        const fname = verAndLabelToFName(migration, "down")
        const queryBuff = await fsp.readFile(path.join(migrationsDir, fname)).catch(err => {
          throw err;
        });
        await db.query(queryBuff.toString());
        await db.query("DELETE FROM applied_migrations WHERE version=$1", [migration.version]);
      } else {
        break; // Stop rolling back when reaching a migration with version <= targetVersion
      };
    }
  });
};


// Before upgrading you must be sure that DB version is clean
// (current version and all version bellow are exist in local migrations up) 
// and 
export const upgradeToVer = async (
  client: pg.Pool | pg.PoolClient,
  localMigrationsUP: VerAndLabel[],
  migrationsDir: string,
  currentVer: number,
  targetVer: number,
) => {
  let mLocalUP = localMigrationsUP
  let mLocalUPLen = localMigrationsUP.length
  let idxOfCurrent: number = 0
  for (let i = 0; i < mLocalUPLen; i++) {
    if (localMigrationsUP[i].version === currentVer) {
      idxOfCurrent = i
      break
    }
  }

  await tx(client, async (db) => {
    let mVer: number
    for (let i = idxOfCurrent+1; i < mLocalUPLen; i++) {
      mVer = mLocalUP[i].version
      if (mVer > targetVer) {
        break
      }
      const fname = verAndLabelToFName(mLocalUP[i], "up")
      const queryBuff = await fsp.readFile(path.join(migrationsDir, fname)).catch(err => {
        throw err;
      });
      await db.query(queryBuff.toString())
      await db.query("INSERT INTO applied_migrations (version, label) "+
        "VALUES ($1, $2)", [mLocalUP[i].version, mLocalUP[i].label])
    }
  })
}


export default { 
  applyMigration, 
  rollbackMigration, 
  rollbackToVer, 
  upgradeToVer
};
