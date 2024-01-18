import fsp from "fs/promises" 
import { VerAndLabel, LocalMigrations, MigrationInfo } from "../entities";
import path from "path";

export const verAndLabelToFName = (vnl: VerAndLabel, type: "up" | "down"): string => {
  let fname = `${vnl.version}`
  if (vnl.label !== null) {
    fname += `_${vnl.label}`
  }
  fname += `.${type}.sql`
  return fname
}


// If returned version is -1 -- version is invalid
export const parseIdAndLabel = (verAndLabelStr: string): VerAndLabel => {
  let result: VerAndLabel = {version: -1, label: null};
  let underscoreIdx: number = verAndLabelStr.indexOf("_");
  let idStr: string
  let label: string | null = null;
  if (underscoreIdx === -1) {
    idStr = verAndLabelStr;
  } else {
    idStr = verAndLabelStr.substring(0, underscoreIdx);
    if (underscoreIdx < verAndLabelStr.length - 1) {
      label = verAndLabelStr.substring(underscoreIdx + 1, verAndLabelStr.length) 
    };
  };

  let ver: number = parseInt(idStr);
  if (Number.isNaN(ver) || ver < 0) {
    return result;
  };

  return {
    version: ver,
    label: label,
  };
};


// Returns versions, lables and paths of migration files from a list of files 
export const parseMigrationDir = async (files: string[]): Promise<LocalMigrations> => {
  let result: LocalMigrations = {
    versionsUP:     [],
    migrationsUP:   new Map<number, MigrationInfo>,
    migrationsDown: new Map<number, MigrationInfo>,
  };

  files.forEach(fname => {
    let [idAndLabel, action, ext] = fname.split(".", 3);
    if (ext != "sql") { return };
    let verAndLabel = parseIdAndLabel(idAndLabel);
    if (action === "up")  {
      const existingMigration = result.migrationsUP.get(verAndLabel.version);
      if (existingMigration) {
        throw `Duplicate migration version files: ${existingMigration} and ${fname}`;
      };
      result.versionsUP = [...result.versionsUP, verAndLabel.version];
      result.migrationsDown.set(verAndLabel.version, {
        version: verAndLabel.version,
        label: verAndLabel.label,
        path: fname,
      });
    } else {
      const existingMigration = result.migrationsDown.get(verAndLabel.version);
      if (existingMigration) {
        throw `Duplicate migration version files: ${existingMigration} and ${fname}`;
      };
      result.migrationsDown.set(verAndLabel.version, {
        version: verAndLabel.version,
        label: verAndLabel.label,
        path: fname,
      });
    };
  });

  return result;
};

// Returns query if file was found and null if not
export const tryReadMigration = async (dir: string, version: number, label: string | null, type: "up" | "down"): Promise<string | null> => {
  let fname = `${version}`;
  if (label) { fname += label };
  fname += `${type}.sql`;

  let queryBuff = await fsp.readFile(path.join(dir, fname));
  return queryBuff.toString();
};


// if return is null -- every version is clean 
// if return is -1 -- no clean versions
export const findLastCleanVer = (localMigrationIDs: number[], appliedMigrations: VerAndLabel[]): number | null =>  {
  let minLen = Math.min(localMigrationIDs.length, appliedMigrations.length) 
  let i = 0
  let clean: boolean = true
  for (; i < minLen; i++) {
    if (localMigrationIDs[i] !== appliedMigrations[i].version) {
      clean = false
      break;
    }
  }
  return clean ? null : i - 1
}

// TODO:
// export const compareMigrations = async (cfg: MigrationsConfig): number[] => {
//   const applied = await getAppliedMigrations(cfg)
//   const missingMigrations = applied.filter((version) => !appliedVersions.includes(version));
//   return missingMigrations;
// };

export default {
  parseIdAndLabel,
  parseMigrationDir,
  tryReadMigration,
  findLastCleanVer,
  verAndLabelToFName
}
