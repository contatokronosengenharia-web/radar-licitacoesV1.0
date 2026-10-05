import { and, eq, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { logAuditoria, perfilFiltro, perfilFiltroVersao } from "@/db/schema";
import type { Criterios } from "./criterios";

export async function perfilPrincipal(db: Db, empresaId: string) {
  const [p] = await db
    .select()
    .from(perfilFiltro)
    .where(and(eq(perfilFiltro.empresaId, empresaId), eq(perfilFiltro.principal, true)));
  return p ?? null;
}

/**
 * Salva os critérios como nova versão do perfil. Vale para as próximas contratações
 * que passarem pelo motor; oportunidades já encontradas não são apagadas.
 */
export async function salvarCriterios(db: Db, empresaId: string, usuarioId: string, criterios: Criterios) {
  return db.transaction(async (tx) => {
    const [p] = await tx
      .update(perfilFiltro)
      .set({ criterios, versao: sql`${perfilFiltro.versao} + 1`, atualizadoEm: new Date() })
      .where(and(eq(perfilFiltro.empresaId, empresaId), eq(perfilFiltro.principal, true)))
      .returning();
    if (!p) throw new Error("Perfil principal não encontrado");
    await tx.insert(perfilFiltroVersao).values({ perfilId: p.id, versao: p.versao, criterios, alteradoPor: usuarioId });
    await tx.insert(logAuditoria).values({
      usuarioId,
      empresaId,
      acao: "perfil_filtro.alterado",
      entidade: "perfil_filtro",
      entidadeId: p.id,
      dados: { versao: p.versao },
    });
    return p;
  });
}
