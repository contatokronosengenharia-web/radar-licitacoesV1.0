import { iniciarColeta } from "@/coleta/coleta";
import { db } from "@/db";
import { cronAutorizado, naoAutorizado } from "@/lib/cron";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// De hora em hora: abre a coleta centralizada de novas publicações. O trabalho em si
// é feito pelas tarefas da fila (rota processar-fila).
export async function GET(request: Request) {
  if (!cronAutorizado(request)) return naoAutorizado();
  const resultado = await iniciarColeta(db, "publicacao");
  console.log(JSON.stringify({ evento: "coleta_agendada", tipo: "publicacao", resultado }));
  return Response.json(resultado);
}
