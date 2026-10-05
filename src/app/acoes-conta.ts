"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { cnpjValido, somenteDigitos } from "@/contas/cnpj";
import { CnpjJaCadastrado, criarEmpresa } from "@/contas/empresa";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { sessaoAtual } from "@/lib/contexto";

export type EstadoFormulario = { erro?: string; ok?: string } | undefined;

const empresaSchema = z.object({
  razaoSocial: z.string().trim().min(2, "Informe a razão social"),
  cnpj: z
    .string()
    .transform(somenteDigitos)
    .refine(cnpjValido, "CNPJ inválido"),
  telefone: z.string().trim().max(20).optional(),
});

const cadastroSchema = empresaSchema.extend({
  nome: z.string().trim().min(2, "Informe seu nome"),
  email: z.email("E-mail inválido"),
  senha: z.string().min(8, "A senha precisa de pelo menos 8 caracteres"),
});

function mensagemAuth(e: unknown): string {
  if (e instanceof APIError) {
    const codigo = (e.body as { code?: string } | undefined)?.code;
    if (codigo === "USER_ALREADY_EXISTS" || codigo === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL")
      return "Já existe uma conta com este e-mail.";
    if (codigo === "INVALID_EMAIL_OR_PASSWORD") return "E-mail ou senha incorretos.";
  }
  return "Não foi possível concluir. Tente novamente.";
}

export async function cadastrar(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const r = cadastroSchema.safeParse(Object.fromEntries(form));
  if (!r.success) return { erro: r.error.issues[0].message };
  const d = r.data;
  let usuarioId: string;
  try {
    const criado = await auth.api.signUpEmail({
      body: { name: d.nome, email: d.email, password: d.senha },
      headers: await headers(),
    });
    usuarioId = criado.user.id;
  } catch (e) {
    return { erro: mensagemAuth(e) };
  }
  try {
    await criarEmpresa(db, { usuarioId, razaoSocial: d.razaoSocial, cnpj: d.cnpj, telefone: d.telefone });
  } catch (e) {
    // A conta já existe; a empresa pode ser concluída na tela seguinte.
    if (e instanceof CnpjJaCadastrado) redirect("/cadastro/empresa?erro=cnpj");
    throw e;
  }
  redirect("/painel/filtros?bemvindo=1");
}

export async function concluirEmpresa(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const sessao = await sessaoAtual();
  if (!sessao) redirect("/entrar");
  const r = empresaSchema.safeParse(Object.fromEntries(form));
  if (!r.success) return { erro: r.error.issues[0].message };
  try {
    await criarEmpresa(db, { usuarioId: sessao.user.id, ...r.data });
  } catch (e) {
    if (e instanceof CnpjJaCadastrado) return { erro: e.message };
    throw e;
  }
  redirect("/painel/filtros?bemvindo=1");
}

export async function entrar(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const email = String(form.get("email") ?? "");
  const senha = String(form.get("senha") ?? "");
  try {
    await auth.api.signInEmail({ body: { email, password: senha }, headers: await headers() });
  } catch (e) {
    return { erro: mensagemAuth(e) };
  }
  redirect("/painel");
}

export async function sair() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/entrar");
}
