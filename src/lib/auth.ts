import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import { conta, sessao, usuario, verificacao } from "@/db/schema";

export const auth = betterAuth({
  appName: "Radar de Licitações",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user: usuario, session: sessao, account: conta, verification: verificacao },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true,
    // Confirmação de e-mail e recuperação de senha dependem de um provedor de e-mail,
    // ainda não escolhido. Ficam desligadas no MVP.
    requireEmailVerification: false,
  },
  user: {
    additionalFields: {
      adminPlataforma: { type: "boolean", required: false, defaultValue: false, input: false },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
  },
  plugins: [nextCookies()],
});

export type Sessao = typeof auth.$Infer.Session;
