"use server";

import { revalidatePath } from "next/cache";
import { iniciarColeta } from "@/coleta/coleta";
import { db } from "@/db";
import { logAuditoria } from "@/db/schema";
import { executarFila } from "@/fila/manipuladores";
import { exigirAdmin } from "@/lib/contexto";
import { sincronizarDominios } from "@/pncp/dominios";
import { gerarRelatoriosDevidos } from "@/relatorios/gerar";

export type EstadoAdmin = { mensagem: string; erro?: boolean } | undefined;

async function registrar(usuarioId: string, acao: string, dados: unknown) {
  await db.insert(logAuditoria).values({ usuarioId, acao, entidade: "admin", dados });
}

export async function acaoSincronizarDominios(): Promise<EstadoAdmin> {
  const admin = await exigirAdmin();
  const r = await sincronizarDominios(db);
  await registrar(admin.id, "admin.sincronizar_dominios", r);
  revalidatePath("/admin");
  const erros = r.filter((x) => x.erro);
  return {
    mensagem: r.map((x) => `${x.tipo}: ${x.erro ? `erro (${x.erro})` : `${x.recebidos} códigos`}`).join(" · "),
    erro: erros.length > 0,
  };
}

export async function acaoIniciarColeta(_: EstadoAdmin, form: FormData): Promise<EstadoAdmin> {
  const admin = await exigirAdmin();
  const tipo = form.get("tipo") === "atualizacao" ? "atualizacao" : "publicacao";
  const r = await iniciarColeta(db, tipo, "admin");
  await registrar(admin.id, "admin.iniciar_coleta", { tipo, ...r });
  revalidatePath("/admin");
  return r.iniciada
    ? { mensagem: `Coleta #${r.execucaoId} aberta (${r.janela.inicio} a ${r.janela.fim}, ${r.tarefas} tarefas na fila).` }
    : { mensagem: r.motivo, erro: true };
}

export async function acaoProcessarFila(): Promise<EstadoAdmin> {
  await exigirAdmin();
  // Curto, para caber numa requisição da tela; o cron continua o restante.
  const r = await executarFila(db, 45_000);
  revalidatePath("/admin");
  return { mensagem: `${r.executadas} tarefas executadas, ${r.falhas} falhas, em ${Math.round(r.duracaoMs / 1000)} s.` };
}

export async function acaoGerarRelatorios(): Promise<EstadoAdmin> {
  const admin = await exigirAdmin();
  const r = await gerarRelatoriosDevidos(db, new Date(), 45_000);
  await registrar(admin.id, "admin.gerar_relatorios", r);
  revalidatePath("/admin");
  return { mensagem: `${r.gerados} relatórios gerados (${r.oportunidades} oportunidades), ${r.falhas} falhas.`, erro: r.falhas > 0 };
}
