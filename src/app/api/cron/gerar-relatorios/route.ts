import { db } from "@/db";
import { cronAutorizado, naoAutorizado } from "@/lib/cron";
import { gerarRelatoriosDevidos } from "@/relatorios/gerar";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// A cada minuto: gera os relatórios das empresas cujo horário já chegou.
// Não consulta o PNCP; usa apenas o que a coleta e o motor já gravaram.
export async function GET(request: Request) {
  if (!cronAutorizado(request)) return naoAutorizado();
  const resumo = await gerarRelatoriosDevidos(db, new Date(), Number(process.env.RELATORIO_ORCAMENTO_MS ?? 240_000));
  console.log(JSON.stringify({ evento: "relatorios_gerados", ...resumo }));
  return Response.json(resumo);
}
