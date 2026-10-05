import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { empresa } from "./contas";
import { contratacao } from "./pncp";
import type { Criterios } from "../../filtros/criterios";

// Perfil de filtros salvo pela empresa. MVP: um perfil "principal" por empresa.
export const perfilFiltro = pgTable(
  "perfil_filtro",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresa.id, { onDelete: "cascade" }),
    nome: text("nome").notNull().default("Perfil principal"),
    principal: boolean("principal").notNull().default(true),
    ativo: boolean("ativo").notNull().default(true),
    criterios: jsonb("criterios").$type<Criterios>().notNull(),
    versao: integer("versao").notNull().default(1),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("perfil_filtro_principal_uk").on(t.empresaId).where(sql`${t.principal}`),
    index("perfil_filtro_empresa_idx").on(t.empresaId),
  ],
);

export const perfilFiltroVersao = pgTable(
  "perfil_filtro_versao",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    perfilId: uuid("perfil_id")
      .notNull()
      .references(() => perfilFiltro.id, { onDelete: "cascade" }),
    versao: integer("versao").notNull(),
    criterios: jsonb("criterios").$type<Criterios>().notNull(),
    alteradoPor: text("alterado_por"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("perfil_filtro_versao_uk").on(t.perfilId, t.versao)],
);

// Oportunidade = contratação compatível com a empresa. Única por empresa + contratação.
export const oportunidade = pgTable(
  "oportunidade",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresa.id, { onDelete: "cascade" }),
    contratacaoId: bigint("contratacao_id", { mode: "number" })
      .notNull()
      .references(() => contratacao.id),
    encontradaEm: timestamp("encontrada_em", { withTimezone: true }).notNull().defaultNow(),
    // Preenchido uma única vez, quando a oportunidade entra num relatório.
    relatorioId: bigint("relatorio_id", { mode: "number" }),
    // Preenchido quando, na hora do relatório, ela já não atendia aos filtros ativos
    // (filtro alterado, prazo encerrado, contratação revogada, descartada pelo usuário).
    excluidaRelatorioEm: timestamp("excluida_relatorio_em", { withTimezone: true }),
    marcacao: text("marcacao", { enum: ["interessante", "descartada"] }),
  },
  (t) => [
    uniqueIndex("oportunidade_empresa_contratacao_uk").on(t.empresaId, t.contratacaoId),
    index("oportunidade_sem_relatorio_idx")
      .on(t.empresaId)
      .where(sql`${t.relatorioId} is null and ${t.excluidaRelatorioEm} is null`),
    index("oportunidade_empresa_data_idx").on(t.empresaId, t.encontradaEm),
  ],
);

export const oportunidadePerfil = pgTable(
  "oportunidade_perfil",
  {
    oportunidadeId: bigint("oportunidade_id", { mode: "number" })
      .notNull()
      .references(() => oportunidade.id, { onDelete: "cascade" }),
    perfilId: uuid("perfil_id")
      .notNull()
      .references(() => perfilFiltro.id, { onDelete: "cascade" }),
    perfilVersao: integer("perfil_versao").notNull(),
  },
  (t) => [primaryKey({ columns: [t.oportunidadeId, t.perfilId] })],
);
