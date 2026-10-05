import { sql } from "drizzle-orm";
import { db } from "@/db";

export async function limparBanco() {
  await db.execute(sql`truncate table oportunidade_perfil, oportunidade, perfil_filtro_versao, perfil_filtro,
    empresa_usuario, empresa, tarefa, coleta_execucao, coleta_controle, contratacao, orgao, unidade_orgao,
    municipio, dominio, sessao, conta, verificacao, usuario, log_auditoria restart identity cascade`);
}

type Resposta = { status: number; corpo?: unknown };

/** Substitui o fetch global por um PNCP falso controlado pelo teste. */
export function pncpFalso(responder: (url: URL) => Resposta) {
  const chamadas: URL[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (entrada: string | URL | Request) => {
    const url = new URL(typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada : entrada.url);
    chamadas.push(url);
    const r = responder(url);
    return new Response(r.corpo === undefined ? null : JSON.stringify(r.corpo), { status: r.status });
  }) as typeof fetch;
  return { chamadas, restaurar: () => (globalThis.fetch = original) };
}

export function pagina<T>(data: T[], numeroPagina: number, totalPaginas: number) {
  return {
    data,
    totalRegistros: data.length,
    totalPaginas,
    numeroPagina,
    paginasRestantes: totalPaginas - numeroPagina,
    empty: data.length === 0,
  };
}
