import { db } from "@/db";
import { buscarOpcoes, type TipoBusca } from "@/filtros/opcoes";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const TIPOS: TipoBusca[] = ["municipio", "orgao", "unidade"];

// Autocompletar dos filtros de município, órgão e unidade. Só para usuários logados.
export async function GET(request: Request) {
  const sessao = await auth.api.getSession({ headers: request.headers });
  if (!sessao) return Response.json({ erro: "Não autenticado" }, { status: 401 });
  const url = new URL(request.url);
  const tipo = url.searchParams.get("tipo") as TipoBusca;
  const termo = (url.searchParams.get("q") ?? "").slice(0, 100);
  if (!TIPOS.includes(tipo)) return Response.json({ erro: "Tipo inválido" }, { status: 400 });
  if (termo.trim().length < 2) return Response.json([]);
  return Response.json(await buscarOpcoes(db, tipo, termo));
}
