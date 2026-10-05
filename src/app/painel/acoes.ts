"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { EstadoFormulario } from "@/app/acoes-conta";
import { fusoValido, horaValida, proximoRelatorio } from "@/contas/horario";
import { db } from "@/db";
import { contratacao, empresa, logAuditoria, oportunidade } from "@/db/schema";
import { type Criterios, criteriosSchema } from "@/filtros/criterios";
import { previaPerfil } from "@/filtros/motor";
import { salvarCriterios } from "@/filtros/perfil";
import { exigirEmpresa } from "@/lib/contexto";

function lerCriterios(form: FormData): { erro: string } | { criterios: Criterios } {
  let bruto: unknown;
  try {
    bruto = JSON.parse(String(form.get("criterios") ?? "{}"));
  } catch {
    return { erro: "Filtros em formato inválido." }; 
  }
  const r = criteriosSchema.safeParse(bruto);
  if (!r.success) return { erro: r.error.issues[0].message }; 
  return { criterios: r.data }; 
}

export async function salvarFiltros(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const { usuario, empresa: e } = await exigirEmpresa();
  const lido = lerCriterios(form);
  if ("erro" in lido) return { erro: lido.erro };
  const perfil = await salvarCriterios(db, e.id, usuario.id, lido.criterios);
  revalidatePath("/painel/filtros");
  return { ok: `Filtros salvos (versão ${perfil.versao}). Valem para as próximas contratações coletadas.` };
}

export type ResultadoPrevia =
  | { erro: string }
  | { total: number; itens: { id: number; objeto: string; orgao: string; local: string }[] }
  | undefined;

/** Mostra o que os filtros teriam encontrado nos últimos 7 dias, sem salvar nada. */
export async function previaFiltros(_: ResultadoPrevia, form: FormData): Promise<ResultadoPrevia> {
  await exigirEmpresa();
  const lido = lerCriterios(form);
  if ("erro" in lido) return { erro: lido.erro };
  const { ids, total } = await previaPerfil(db, lido.criterios, 7, 10);
  if (ids.length === 0) return { total: 0, itens: [] };
  const linhas = await db
    .select({
      id: contratacao.id,
      objeto: contratacao.objetoCompra,
      orgao: contratacao.orgaoRazaoSocial,
      municipio: contratacao.municipioNome,
      uf: contratacao.ufSigla,
    })
    .from(contratacao)
    .where(inArray(contratacao.id, ids));
  const porId = new Map(linhas.map((l) => [l.id, l]));
  return {
    total,
    itens: ids.map((id) => {
      const l = porId.get(id)!;
      return { id, objeto: l.objeto ?? "", orgao: l.orgao ?? "", local: [l.municipio, l.uf].filter(Boolean).join(" / ") };
    }),
  };
}

const configSchema = z.object({
  horaRelatorio: z.string().refine(horaValida, "Horário inválido"),
  fusoHorario: z.string().refine(fusoValido, "Fuso horário inválido"),
});

export async function salvarConfiguracoes(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const { usuario, empresa: e } = await exigirEmpresa();
  const r = configSchema.safeParse(Object.fromEntries(form));
  if (!r.success) return { erro: r.error.issues[0].message };
  const proximo = proximoRelatorio(r.data.horaRelatorio, r.data.fusoHorario);
  await db
    .update(empresa)
    .set({ ...r.data, proximoRelatorioEm: proximo, atualizadoEm: new Date() })
    .where(eq(empresa.id, e.id));
  await db.insert(logAuditoria).values({
    usuarioId: usuario.id,
    empresaId: e.id,
    acao: "empresa.horario_relatorio",
    entidade: "empresa",
    entidadeId: e.id,
    dados: r.data,
  });
  revalidatePath("/painel/configuracoes");
  return { ok: "Horário salvo." };
}

export async function marcarOportunidade(form: FormData) {
  const { empresa: e } = await exigirEmpresa();
  const id = Number(form.get("id"));
  const valor = String(form.get("marcacao") ?? "");
  const marcacao = valor === "interessante" || valor === "descartada" ? valor : null;
  if (!Number.isInteger(id)) return;
  // O filtro por empresa impede marcar oportunidade de outra empresa.
  await db
    .update(oportunidade)
    .set({ marcacao })
    .where(and(eq(oportunidade.id, id), eq(oportunidade.empresaId, e.id)));
  revalidatePath("/painel");
}
