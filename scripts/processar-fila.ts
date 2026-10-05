// Uso: npm run fila:processar [-- --coletar]
// Com --coletar, abre antes uma coleta de publicações (mesma rotina do cron).
import { iniciarColeta } from "../src/coleta/coleta";
import { db, pool } from "../src/db";
import { executarFila } from "../src/fila/manipuladores";

// tsx roda este arquivo como CommonJS, que não aceita await no topo.
async function main() {
  if (process.argv.includes("--coletar")) console.log(await iniciarColeta(db, "publicacao", "script"));
  const r = await executarFila(db, Number(process.env.FILA_ORCAMENTO_MS ?? 240_000));
  console.log(r);
  await pool.end();
}

main();
