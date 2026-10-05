// Uso: npm run pncp:sincronizar-dominios
import { db, pool } from "../src/db";
import { sincronizarDominios } from "../src/pncp/dominios";

// tsx roda este arquivo como CommonJS, que não aceita await no topo.
async function main() {
  const r = await sincronizarDominios(db);
  console.table(r);
  await pool.end();
  process.exit(r.some((x) => x.erro) ? 1 : 0);
}

main();
