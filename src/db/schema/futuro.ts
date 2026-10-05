// Estruturas previstas na arquitetura e ainda NÃO usadas pelo MVP:
// contatos para WhatsApp e planos/assinaturas (cobrança).
import { bigserial, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { empresa } from "./contas";

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
