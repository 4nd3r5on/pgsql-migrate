import pg from "pg"

export type VerAndFName = {
  version:  number, 
  filename: string
};
export interface VerAndLabel {
  version: number, 
  label:   string | null
};

export interface MigrationInfo extends VerAndLabel {
  path:    string,
};

export interface LocalMigrations {
  /* Versions are sorted in the order from smaller ID to a bigger ID */
  versionsUP:     number[]; 
  migrationsUP:   Map<number, MigrationInfo>;
  migrationsDown: Map<number, MigrationInfo>;
};

export interface MigrationsConfig {
  client: pg.Pool | pg.PoolClient;
  mLocal: LocalMigrations;
  mDir:   string;
};

export type DBVerInfo = {
  version:      VerAndLabel;
  // null if DB isn't dirty or there are no clean versions
  lastCleanVer: VerAndLabel | null; 
  dirty:        boolean;
};

