# PGSQL-Migrate

Minimalistic JS/TS migrations library for PostgreSQL that just works.

It doesn't use any query builder, you don't need ORM to use migrations, it has minimum dependencies, you can write your migrations in a raw SQL, it tries to be performant for it's features and usabillity.

## How to use
Install it from NPM
```sh
npm i @4nd3rs0n/pgsql-migrate
```

### Migrations dir
Directroy that contains your `.sql` files with migrations.

It can contain sql files like `migrationID_labet.up|down.sql`
```
0_core.up.sql
0_core.down.sql
1_user.up.sql
1_user.down.sql
```
You may not want to use labels like `migrationID.up|down.sql`
```
0.up.sql
0.down.sql
1.up.sql
1.down.sql
```
You can skip some version IDs if you want
```
1.up.sql
1.down.sql
3.up.sql
3.down.sql
```

Also you can use timestamps instead of IDs like `timestamp_labet.up|down.sql`
```
1705406292767_core.up.sql
1705406292767_core.down.sql
1705406292839_user.up.sql
1705406292839_user.down.sql
```

### Some code examples
```ts
import pg from "pg"
import migrate from "@4nd3rs0n/pgsql-migrate"
import type { MigrationsConfig } from "@4nd3rs0n/pgsql-migrate"

type DoMigrateConfig = {
  pool: pg.Pool
  migrationsDir: string
  versionLimit: BigInt | null
}

const doMigrate = async (cfg: DoMigrateConfig) => {
  let mLocal = await migrate.loadMigrationDir(cfg.migrationsDir)
  let mCfg: MigrationsConfig = {
    pool:   cfg.pool,
    mLocal: mLocal
  }

  if (mLocal.versionsUP.length < 1) {
    throw `No migrations were found in ${cfg.migrationsDir}`
  }
  let maxVersion = mLocal.versionsUP[mLocal.versionsUP.length - 1]

  let migrateTo = cfg.versionLimit || maxVersion
  // If you're not sure if migration table exists
  // just call that function
  await migrate.createMigrationTable(cfg.pool)
  await migrate.rollbackToCleanVer(mCfg)
  await migrate.migrateTo(mCfg, migrateTo)

  await new Promise(r => setTimeout(r, 300));
  let mApplied = await migrate.getAppliedMigrations(mCfg)
  let currentVer: BigInt | null = null
  if (mApplied.length > 0) {
    currentVer = mApplied[mApplied.length - 1].version
  }
  let mLastClean = migrate.findLastCleanVer(mLocal.versionsUP, mApplied)

  console.log(
    `DB Info:\n`+
    `\tDB Version Limit: ${cfg.versionLimit}\n`+
    `\tCurrent DB Version: ${currentVer}/${maxVersion}\n`+
    `\tDirty: ${mLastClean !== null ? true : false}\n`
  )
}

const main = async () => {
  /*
    ... Your code
  */
  let pool: pg.Pool = new pg.Pool(cfg)
  pg.types.setTypeParser(20, BigInt);
  await doMigrate({
  pool,
    migrationsDir,
    versionLimit: null,
  })
}

main()
```

### Tests
Not ready yet, sorry
