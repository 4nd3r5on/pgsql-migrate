import pg from "pg"

export interface MigrationsConfig {
  pool: pg.Pool;
  mLocal: LocalMigrations;
};
export interface LocalMigrations {
  /* Versions are sorted in the order from smaller ID to a bigger ID */
  versionsUP:     number[]; 
  migrationsUP:   Map<number, Migration>;
  migrationsDown: Map<number, Migration>;
};

export interface VerAndLabel {
  version: number, 
  label:   string | null
};
export interface Migration extends VerAndLabel {
  query: string,
};

