import pg from "pg"

export interface MigrationsConfig {
  pool: pg.Pool;
  mLocal: LocalMigrations;
};
export interface LocalMigrations {
  /* Versions are sorted in the order from smaller ID to a bigger ID */
  versionsUP:     BigInt[]; 
  migrationsUP:   Map<BigInt, Migration>;
  migrationsDown: Map<BigInt, Migration>;
};

export interface VerAndLabel {
  version: BigInt, 
  label:   string | null
};
export interface Migration extends VerAndLabel {
  query: string,
};

