import {
  bigint,
  bigserial,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { empresa } from "./contas";
import { oportunidade, perfilFiltro } from "./filtros";

// Relatório gerado no horário da empresa a partir do que já está no banco.
export const relatorio = pgTable(
  "relatorio",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresa.id, { onDelete: "cascade" }),
    // Horário agendado (UTC) que este relatório atende. Único por empresa: uma nova
    // tentativa do mesmo horário não gera um segundo relatório.
    agendadoPara: timestamp("agendado_para", { withTimezone: true }).notNull(),
    // Fuso e hora locais vigentes na geração, para exibir o histórico como a empresa viu.
    fusoHorario: text("fuso_horario").notNull(),
    horaRelatorio: text("hora_relatorio").notNull(),
    // Janela coberta: do fim do relatório anterior (ou do cadastro) até a geração.
    periodoInicio: timestamp("periodo_inicio", { withTimezone: true }).notNull(),
    periodoFim: timestamp("periodo_fim", { withTimezone: true }).notNull(),
    total: integer("total").notNull().default(0),
    // Oportunidades pendentes que deixaram de atender aos filtros ativos.
    excluidas: integer("excluidas").notNull().default(0),
    // Perfis e versões aplicados: [{ perfilId, versao }]
    perfis: jsonb("perfis").$type<{ perfilId: string; versao: number }[]>().notNull().default([]),
    geradoEm: timestamp("gerado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("relatorio_empresa_agendado_uk").on(t.empresaId, t.agendadoPara),
    index("relatorio_empresa_gerado_idx").on(t.empresaId, t.geradoEm),
  ],
);

export interface ResumoItem {
  numeroControlePncp: string;
  objeto: string | null;
  orgao: string | null;
  municipio: string | null;
  uf: string | null;
  modalidade: string | null;
  valorEstimado: number | null;
  encerramentoPropostas: string | null;
  linkPncp: string;
}

// Oportunidades incluídas em cada relatório. Uma oportunidade entra em no máximo
// um relatório (índice único), então nunca é enviada duas vezes.
export const relatorioItem = pgTable(
  "relatorio_item",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    relatorioId: bigint("relatorio_id", { mode: "number" })
      .notNull()
      .references(() => relatorio.id, { onDelete: "cascade" }),
    oportunidadeId: bigint("oportunidade_id", { mode: "number" })
      .notNull()
      .references(() => oportunidade.id, { onDelete: "cascade" }),
    perfilId: uuid("perfil_id").references(() => perfilFiltro.id, { onDelete: "set null" }),
    posicao: integer("posicao").notNull(),
    // Retrato do conteúdo no momento da geração: o mesmo texto vai para o WhatsApp no futuro.
    resumo: jsonb("resumo").$type<ResumoItem>().notNull(),
  },
  (t) => [
    uniqueIndex("relatorio_item_oportunidade_uk").on(t.oportunidadeId),
    index("relatorio_item_relatorio_idx").on(t.relatorioId, t.posicao),
  ],
);

// Cada canal por onde o relatório sai. Hoje só "painel"; WhatsApp e e-mail entram
// como novas linhas pendentes, processadas por um despachante próprio.
export const entrega = pgTable(
  "entrega",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    relatorioId: bigint("relatorio_id", { mode: "number" })
      .notNull()
      .references(() => relatorio.id, { onDelete: "cascade" }),
    canal: text("canal", { enum: ["painel", "whatsapp", "email"] }).notNull(),
    destino: text("destino"),
    situacao: text("situacao", { enum: ["pendente", "enviada", "entregue", "lida", "falhou"] })
      .notNull()
      .default("pendente"),
    tentativas: integer("tentativas").notNull().default(0),
    provedorMensagemId: text("provedor_mensagem_id"),
    erro: text("erro"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    enviadoEm: timestamp("enviado_em", { withTimezone: true }),
  },
  (t) => [
    index("entrega_relatorio_idx").on(t.relatorioId),
    uniqueIndex("entrega_relatorio_canal_uk").on(t.relatorioId, t.canal),
    index("entrega_pendente_idx").on(t.canal, t.criadoEm),
  ],
);
