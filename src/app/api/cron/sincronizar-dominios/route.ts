import { db } from "@/db";
import { cronAutorizado, naoAutorizado } from "@/lib/cron";
import { sincronizarDominios } from "@/pncp/dominios";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: Request) {
  if (!cronAutorizado(request)) return naoAutorizado();
  const resultados = await sincronizarDominios(db);
  console.log(JSON.stringify({ evento: "dominios_sincronizados", resultados }));
  return Response.json({ resultados });
}
