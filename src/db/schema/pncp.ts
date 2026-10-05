import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  customType,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

const tsvector = customType<{ data: string }>({
  dataType: () => "tsvector",
});

// Domínios oficiais do PNCP (modalidade, modo de disputa, instrumento, amparo legal...)
// e os que não têm endpoint (situação, esfera, poder, UF). O código oficial é a chave.
export const dominio = pgTable(
  "dominio",
  {
    tipo: text("tipo").notNull(),
    codigo: text("codigo").notNull(),
    nome: text("nome").notNull(),
    descricao: text("descricao"),
    ativo: boolean("ativo").notNull().default(true),
    // api_pncp | manual_pncp | ibge | descoberto
    origem: text("origem").notNull(),
    dados: jsonb("dados"),
    sincronizadoEm: timestamp("sincronizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.tipo, t.codigo] })],
);

export const municipio = pgTable(
  "municipio",
  {
    codigoIbge: varchar("codigo_ibge", { length: 7 }).primaryKey(),
    nome: text("nome").notNull(),
    uf: varchar("uf", { length: 2 }).notNull(),
  },
  (t) => [index("municipio_uf_idx").on(t.uf)],
);

export const orgao = pgTable("orgao", {
  cnpj: varchar("cnpj", { length: 14 }).primaryKey(),
  razaoSocial: text("razao_social").notNull(),
  esferaId: text("esfera_id"),
  poderId: text("poder_id"),
  atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
});

export const unidadeOrgao = pgTable(
  "unidade_orgao",
  {
    id: serial("id").primaryKey(),
    orgaoCnpj: varchar("orgao_cnpj", { length: 14 }).notNull(),
    codigoUnidade: text("codigo_unidade").notNull(),
    nomeUnidade: text("nome_unidade").notNull(),
    codigoIbge: varchar("codigo_ibge", { length: 7 }),
    ufSigla: varchar("uf_sigla", { length: 2 }),
    municipioNome: text("municipio_nome"),
  },
  (t) => [uniqueIndex("unidade_orgao_uk").on(t.orgaoCnpj, t.codigoUnidade)],
);

// Uma linha por contratação do PNCP, compartilhada por todas as empresas.
export const contratacao = pgTable(
  "contratacao",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    numeroControlePncp: text("numero_controle_pncp").notNull(),
    orgaoCnpj: varchar("orgao_cnpj", { length: 14 }).notNull(),
    anoCompra: integer("ano_compra").notNull(),
    sequencialCompra: integer("sequencial_compra").notNull(),
    numeroCompra: text("numero_compra"),
    processo: text("processo"),
    orgaoRazaoSocial: text("orgao_razao_social"),
    esferaId: text("esfera_id"),
    poderId: text("poder_id"),
    codigoUnidade: text("codigo_unidade"),
    nomeUnidade: text("nome_unidade"),
    ufSigla: varchar("uf_sigla", { length: 2 }),
    codigoIbge: varchar("codigo_ibge", { length: 7 }),
    municipioNome: text("municipio_nome"),
    modalidadeId: integer("modalidade_id"),
    modoDisputaId: integer("modo_disputa_id"),
    instrumentoConvocatorioId: integer("instrumento_convocatorio_id"),
    amparoLegalCodigo: integer("amparo_legal_codigo"),
    situacaoId: integer("situacao_id"),
    objetoCompra: text("objeto_compra"),
    informacaoComplementar: text("informacao_complementar"),
    valorTotalEstimado: numeric("valor_total_estimado", { precision: 18, scale: 2, mode: "number" }),
    valorTotalHomologado: numeric("valor_total_homologado", { precision: 18, scale: 2, mode: "number" }),
    orcamentoSigiloso: text("orcamento_sigiloso"),
    srp: boolean("srp"),
    fontesOrcamentarias: integer("fontes_orcamentarias").array().notNull().default(sql`'{}'`),
    dataPublicacaoPncp: timestamp("data_publicacao_pncp", { withTimezone: true }),
    dataAberturaProposta: timestamp("data_abertura_proposta", { withTimezone: true }),
    dataEncerramentoProposta: timestamp("data_encerramento_proposta", { withTimezone: true }),
    dataInclusao: timestamp("data_inclusao", { withTimezone: true }),
    dataAtualizacao: timestamp("data_atualizacao", { withTimezone: true }),
    dataAtualizacaoGlobal: timestamp("data_atualizacao_global", { withTimezone: true }),
    linkSistemaOrigem: text("link_sistema_origem"),
    linkProcessoEletronico: text("link_processo_eletronico"),
    payload: jsonb("payload").notNull(),
    payloadHash: text("payload_hash").notNull(),
    busca: tsvector("busca"),
    primeiraColetaEm: timestamp("primeira_coleta_em", { withTimezone: true }).notNull().defaultNow(),
    ultimaColetaEm: timestamp("ultima_coleta_em", { withTimezone: true }).notNull().defaultNow(),
    // Vazio = ainda não passou pelo motor de filtros. Só é vazio na inserção.
    motorProcessadoEm: timestamp("motor_processado_em", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("contratacao_numero_controle_uk").on(t.numeroControlePncp),
    index("contratacao_motor_pendente_idx").on(t.id).where(sql`${t.motorProcessadoEm} is null`),
    index("contratacao_busca_idx").using("gin", t.busca),
    index("contratacao_publicacao_idx").on(t.dataPublicacaoPncp),
    index("contratacao_modalidade_idx").on(t.modalidadeId),
    index("contratacao_uf_idx").on(t.ufSigla),
    index("contratacao_municipio_idx").on(t.codigoIbge),
    index("contratacao_orgao_idx").on(t.orgaoCnpj),
  ],
);
