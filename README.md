# PGSQL-Migrate

Minimalistic JS/TS migrations library for PostgreSQL that just works.

It doesn't use any query builder, you don't need ORM to use migrations, it has minimum dependencies, you can write your migrations in a raw SQL, it tryes to be performant for it's features and usabillity.

## How to use
Install it from NPM
```sh
npm i 4nd3rs0n/pgsql-migrate
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
import type { 
    MigrationConfig,
    DBVerInfo,
} from "pgsql-migrate"
import { 
    createMigrationTable
    getLocalMigrations,
    findLastCleanVer,
    rollbackToCleanVer,
    migrateTo,
} from "pgsql-migrate"

const main = async () => {
    /*
        ... Your code
    */
    const mLocal = getLocalMigrations(mDirPath)
    const mCfg: MigrationConfig = {
        client: pgclient,
        local:  localMigrations,
    }

    // If you're not sure if migration table exists
    // just call that function
    await createMigrationTable(mCfg);

    let mApplied = getAppliedMigrations(mCfg)
    if (mLocal.length < 1) {
        throw "No migrations were found in diretory"
    }
    let cleanVer = findLastCleanVer(mCfg, mApplied)
    let dbMaxVer: number =  ? mLocal[mLocal.length - 1]
    let dbVer: number | null = mApplied[mApplied.length - 1]
    console.log(
        `Current DB version: ${dbVer}/${dbMaxVer}\n`+
        `Dirty: ${cleanVer === null ? true : false}`
    )

    await rollbackToCleanVer(mCfg).catch(err => {
        console.log(`Error while rolling back: ${err}`)
    })
    await migrateTo(mCfg, dbMaxVer).catch(err => {
        console.log(`Error while upgrading DB: ${err}`)
    })
}

main()
```

### Tests
Not ready yet, sorry
