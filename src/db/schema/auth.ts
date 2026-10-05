// Tabelas exigidas pelo Better Auth (nomes de campo seguem o padrão da biblioteca).
import { boolean, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const usuario = pgTable("usuario", {
  id: text("id").primaryKey(),
  name: text("nome").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verificado").notNull().default(false),
  image: text("imagem"),
  adminPlataforma: boolean("admin_plataforma").notNull().default(false),
  createdAt: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
});

export const sessao = pgTable(
  "sessao",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expira_em", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text("ip"),
    userAgent: text("user_agent"),
    userId: text("usuario_id")
      .notNull()
      .references(() => usuario.id, { onDelete: "cascade" }),
  },
  (t) => [index("sessao_usuario_idx").on(t.userId)],
);

export const conta = pgTable(
  "conta",
  {
    id: text("id").primaryKey(),
    accountId: text("conta_externa_id").notNull(),
    providerId: text("provedor").notNull(),
    userId: text("usuario_id")
      .notNull()
      .references(() => usuario.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expira_em", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expira_em", { withTimezone: true }),
    scope: text("escopo"),
    password: text("senha_hash"),
    createdAt: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("conta_usuario_idx").on(t.userId)],
);

export const verificacao = pgTable(
  "verificacao",
  {
    id: text("id").primaryKey(),
    identifier: text("identificador").notNull(),
    value: text("valor").notNull(),
    expiresAt: timestamp("expira_em", { withTimezone: true }).notNull(),
    createdAt: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("verificacao_identificador_idx").on(t.identifier)],
);
