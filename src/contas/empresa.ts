import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { empresa, empresaUsuario, logAuditoria, perfilFiltro, perfilFiltroVersao } from "@/db/schema";
import { criteriosPadrao } from "@/filtros/criterios";
import { FUSO_PADRAO, proximoRelatorio } from "./horario";

export interface DadosEmpresa {
  usuarioId: string;
  razaoSocial: string;
  cnpj: string;
  telefone?: string | null;
}

export class CnpjJaCadastrado extends Error {
  constructor() {
    super("Este CNPJ já está cadastrado.");
  }
}

/** Cria empresa, vínculo do dono e o perfil de filtros principal, numa única transação. */
export async function criarEmpresa(db: Db, d: DadosEmpresa) {
  const [existente] = await db.select({ id: empresa.id }).from(empresa).where(eq(empresa.cnpj, d.cnpj));
  if (existente) throw new CnpjJaCadastrado();

  return db.transaction(async (tx) => {
    const horaPadrao = "08:00";
    const [nova] = await tx
      .insert(empresa)
      .values({
        razaoSocial: d.razaoSocial,
        cnpj: d.cnpj,
        telefone: d.telefone ?? null,
        fusoHorario: FUSO_PADRAO,
        horaRelatorio: horaPadrao,
        proximoRelatorioEm: proximoRelatorio(horaPadrao, FUSO_PADRAO),
      })
      .returning();
    await tx.insert(empresaUsuario).values({ empresaId: nova.id, usuarioId: d.usuarioId, papel: "dono" });
    const criterios = criteriosPadrao();
    const [perfil] = await tx.insert(perfilFiltro).values({ empresaId: nova.id, criterios }).returning();
    await tx.insert(perfilFiltroVersao).values({ perfilId: perfil.id, versao: 1, criterios, alteradoPor: d.usuarioId });
    await tx.insert(logAuditoria).values({
      usuarioId: d.usuarioId,
      empresaId: nova.id,
      acao: "empresa.criada",
      entidade: "empresa",
      entidadeId: nova.id,
    });
    return nova;
  });
}
