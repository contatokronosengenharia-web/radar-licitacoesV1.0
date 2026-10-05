// Uso: npm run admin:conceder -- email@empresa.com.br
import { eq } from "drizzle-orm";
import { db, pool } from "../src/db";
import { usuario } from "../src/db/schema";

// tsx roda este arquivo como CommonJS, que não aceita await no topo.
async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Informe o e-mail: npm run admin:conceder -- email@empresa.com.br");
    process.exit(1);
  }
  const r = await db.update(usuario).set({ adminPlataforma: true }).where(eq(usuario.email, email)).returning();
  console.log(r.length ? `${email} agora é administrador da plataforma.` : `Usuário ${email} não encontrado.`);
  await pool.end();
}

main();
