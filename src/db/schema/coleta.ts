import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export type TipoColeta = "publicacao" | "atualizacao";
export type SituacaoColeta = "em_andamento" | "sucesso" | "falha";

// Uma linha por execução de coleta, com o período consultado e as contagens.
export const coletaExecucao = pgTable(
  "coleta_execucao",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    tipo: text("tipo").$type<TipoColeta>().notNull(),
    situacao: text("situacao").$type<SituacaoColeta>().notNull().default("em_andamento"),
    gatilho: text("gatilho").notNull().default("cron"),
    janelaInicio: date("janela_inicio").notNull(),
    janelaFim: date("janela_fim").notNull(),
    iniciadaEm: timestamp("iniciada_em", { withTimezone: true }).notNull().defaultNow(),
    concluidaEm: timestamp("concluida_em", { withTimezone: true }),
    duracaoMs: integer("duracao_ms"),
    paginas: integer("paginas").notNull().default(0),
    registrosRecebidos: integer("registros_recebidos").notNull().default(0),
    registrosNovos: integer("registros_novos").notNull().default(0),
    registrosDuplicados: integer("registros_duplicados").notNull().default(0),
    registrosAtualizados: integer("registros_atualizados").notNull().default(0),
    erros: integer("erros").notNull().default(0),
    erroDetalhe: jsonb("erro_detalhe").$type<{ quando: string; tarefa: string; erro: string }[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
  },
  (t) => [index("coleta_execucao_tipo_idx").on(t.tipo, t.iniciadaEm)],
);

// Marca por tipo de coleta: de onde a próxima execução parte.
export const coletaControle = pgTable("coleta_controle", {
  tipo: text("tipo").$type<TipoColeta>().primaryKey(),
  ultimaIniciadaEm: timestamp("ultima_iniciada_em", { withTimezone: true }),
  ultimaIniciadaExecucaoId: bigint("ultima_iniciada_execucao_id", { mode: "number" }),
  ultimaSucessoEm: timestamp("ultima_sucesso_em", { withTimezone: true }),
  ultimaSucessoExecucaoId: bigint("ultima_sucesso_execucao_id", { mode: "number" }),
  // Só avança quando a execução inteira termina sem erro.
  ultimaSucessoJanelaFim: date("ultima_sucesso_janela_fim"),
});

export type SituacaoTarefa = "pendente" | "executando" | "concluida" | "falha";

// Fila de tarefas no próprio Postgres, consumida pelo cron "processar-fila".
export const tarefa = pgTable(
  "tarefa",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    tipo: text("tipo").notNull(),
    parametros: jsonb("parametros").notNull().default(sql`'{}'::jsonb`),
    situacao: text("situacao").$type<SituacaoTarefa>().notNull().default("pendente"),
    tentativas: integer("tentativas").notNull().default(0),
    maxTentativas: integer("max_tentativas").notNull().default(5),
    executarApos: timestamp("executar_apos", { withTimezone: true }).notNull().defaultNow(),
    travadaAte: timestamp("travada_ate", { withTimezone: true }),
    chaveUnica: text("chave_unica"),
    execucaoId: bigint("execucao_id", { mode: "number" }),
    ultimoErro: text("ultimo_erro"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    concluidaEm: timestamp("concluida_em", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("tarefa_chave_unica_uk").on(t.chaveUnica),
    index("tarefa_fila_idx").on(t.executarApos).where(sql`${t.situacao} = 'pendente'`),
    index("tarefa_execucao_idx").on(t.execucaoId, t.situacao),
  ],
);
