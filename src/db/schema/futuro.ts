// Estruturas previstas na arquitetura e ainda NÃO usadas pelo MVP:
// relatórios/entregas (WhatsApp) e planos/assinaturas (cobrança).
import {
  bigint,
  bigserial,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { empresa } from "./contas";

export const relatorio = pgTable(
  "relatorio",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresa.id, { onDelete: "cascade" }),
    periodoInicio: timestamp("periodo_inicio", { withTimezone: true }),
    periodoFim: timestamp("periodo_fim", { withTimezone: true }).notNull(),
    total: integer("total").notNull().default(0),
    geradoEm: timestamp("gerado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("relatorio_empresa_periodo_uk").on(t.empresaId, t.periodoFim)],
);

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
  (t) => [index("entrega_relatorio_idx").on(t.relatorioId)],
);

export const canalContato = pgTable("canal_contato", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  empresaId: uuid("empresa_id")
    .notNull()
    .references(() => empresa.id, { onDelete: "cascade" }),
  canal: text("canal", { enum: ["whatsapp", "email"] }).notNull(),
  destino: text("destino").notNull(),
  consentimentoEm: timestamp("consentimento_em", { withTimezone: true }),
  verificadoEm: timestamp("verificado_em", { withTimezone: true }),
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
});

export const plano = pgTable("plano", {
  id: text("id").primaryKey(),
  nome: text("nome").notNull(),
  precoCentavos: integer("preco_centavos").notNull().default(0),
  periodicidade: text("periodicidade", { enum: ["mensal", "anual"] }).notNull().default("mensal"),
  diasTeste: integer("dias_teste").notNull().default(7),
  limitePerfis: integer("limite_perfis").notNull().default(1),
  limiteUsuarios: integer("limite_usuarios").notNull().default(1),
  ativo: integer("ativo").notNull().default(1),
});

export const assinatura = pgTable(
  "assinatura",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresa.id, { onDelete: "cascade" }),
    planoId: text("plano_id").references(() => plano.id),
    situacao: text("situacao", { enum: ["teste", "ativa", "inadimplente", "expirada", "cancelada"] })
      .notNull()
      .default("teste"),
    testeInicio: timestamp("teste_inicio", { withTimezone: true }),
    testeFim: timestamp("teste_fim", { withTimezone: true }),
    periodoInicio: timestamp("periodo_inicio", { withTimezone: true }),
    periodoFim: timestamp("periodo_fim", { withTimezone: true }),
    gateway: text("gateway"),
    gatewayClienteId: text("gateway_cliente_id"),
    gatewayAssinaturaId: text("gateway_assinatura_id"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("assinatura_empresa_idx").on(t.empresaId)],
);
