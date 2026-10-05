import { db } from "@/db";
import { executarFila } from "@/fila/manipuladores";
import { cronAutorizado, naoAutorizado } from "@/lib/cron";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// A cada minuto: executa tarefas até o orçamento, abaixo do limite de duração da função.
export async function GET(request: Request) {
  if (!cronAutorizado(request)) return naoAutorizado();
  const orcamentoMs = Number(process.env.FILA_ORCAMENTO_MS ?? 240_000);
  const resumo = await executarFila(db, orcamentoMs);
  console.log(JSON.stringify({ evento: "fila_processada", ...resumo }));
  return Response.json(resumo);
}
