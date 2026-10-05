import "server-only";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { empresa, empresaUsuario } from "@/db/schema";
import { auth } from "./auth";

export async function sessaoAtual() {
  return auth.api.getSession({ headers: await headers() });
}

/** Usuário logado com a sua empresa. Redireciona quando falta login ou empresa. */
export async function exigirEmpresa() {
  const sessao = await sessaoAtual();
  if (!sessao) redirect("/entrar");
  const [vinculo] = await db
    .select({ empresa, papel: empresaUsuario.papel })
    .from(empresaUsuario)
    .innerJoin(empresa, eq(empresa.id, empresaUsuario.empresaId))
    .where(eq(empresaUsuario.usuarioId, sessao.user.id))
    .limit(1);
  if (!vinculo) redirect("/cadastro/empresa");
  return { usuario: sessao.user, empresa: vinculo.empresa, papel: vinculo.papel };
}

export async function exigirAdmin() {
  const sessao = await sessaoAtual();
  if (!sessao) redirect("/entrar");
  if (!(sessao.user as { adminPlataforma?: boolean }).adminPlataforma) redirect("/painel");
  return sessao.user;
}
