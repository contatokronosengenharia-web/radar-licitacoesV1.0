import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { usuario } from "./auth";

export const empresa = pgTable(
  "empresa",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    razaoSocial: text("razao_social").notNull(),
    cnpj: varchar("cnpj", { length: 14 }).notNull().unique(),
    telefone: text("telefone"),
    // Fuso IANA (ex.: America/Sao_Paulo) e horário local "HH:MM" do relatório.
    fusoHorario: text("fuso_horario").notNull().default("America/Sao_Paulo"),
    horaRelatorio: varchar("hora_relatorio", { length: 5 }).notNull().default("08:00"),
    // Próximo relatório já convertido para UTC; o despacho consulta só este campo.
    proximoRelatorioEm: timestamp("proximo_relatorio_em", { withTimezone: true }),
    ativa: boolean("ativa").notNull().default(true),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("empresa_proximo_relatorio_idx").on(t.proximoRelatorioEm).where(sql`${t.ativa}`)],
);

// Vínculo usuário × empresa. No MVP há um por empresa; o modelo aceita vários.
export const empresaUsuario = pgTable(
  "empresa_usuario",
  {
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresa.id, { onDelete: "cascade" }),
    usuarioId: text("usuario_id")
      .notNull()
      .references(() => usuario.id, { onDelete: "cascade" }),
    papel: text("papel", { enum: ["dono", "membro"] }).notNull().default("dono"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.empresaId, t.usuarioId] }),
    index("empresa_usuario_usuario_idx").on(t.usuarioId),
  ],
);

export const logAuditoria = pgTable(
  "log_auditoria",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    usuarioId: text("usuario_id"),
    empresaId: uuid("empresa_id"),
    acao: text("acao").notNull(),
    entidade: text("entidade"),
    entidadeId: text("entidade_id"),
    dados: jsonb("dados"),
    ip: text("ip"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("log_auditoria_empresa_idx").on(t.empresaId, t.criadoEm),
    index("log_auditoria_acao_idx").on(t.acao, t.criadoEm),
  ],
);
