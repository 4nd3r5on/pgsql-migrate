import pg from "pg"
import { VerAndLabel } from "../entities";

export const tx = async (pool: pg.Pool, callback: (client: pg.PoolClient) => Promise<void>): Promise<void> => {
  let client = await pool.connect()
  try {
    await client.query("BEGIN")
    await callback(client)
    await client.query("COMMIT")
  } catch (err) {
    await client.query("ROLLBACK")
    throw err
  } finally {
    client.release()
  }
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

export default {
  parseIdAndLabel,
}
