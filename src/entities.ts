import pg from "pg"

export interface MigrationsConfig {
  client: pg.Pool | pg.PoolClient;
  mLocal: LocalMigrations;
  mDir:   string;
};
export interface LocalMigrations {
  /* Versions are sorted in the order from smaller ID to a bigger ID */
  versionsUP:     number[]; 
  migrationsUP:   Map<number, MigrationInfo>;
  migrationsDown: Map<number, MigrationInfo>;
};

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

