import { iniciarColeta } from "@/coleta/coleta";
import { db } from "@/db";
import { cronAutorizado, naoAutorizado } from "@/lib/cron";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Mantém situação e datas em dia (revogação, suspensão, novos prazos).
export async function GET(request: Request) {
  if (!cronAutorizado(request)) return naoAutorizado();
  const resultado = await iniciarColeta(db, "atualizacao");
  console.log(JSON.stringify({ evento: "coleta_agendada", tipo: "atualizacao", resultado }));
  return Response.json(resultado);
}
