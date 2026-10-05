import { timingSafeEqual } from "node:crypto";

/**
 * Proteção das rotas de cron. A Vercel envia "Authorization: Bearer <CRON_SECRET>"
 * nas chamadas agendadas quando a variável CRON_SECRET existe no projeto.
 * Sem CRON_SECRET configurado, as rotas recusam tudo.
 */
export function cronAutorizado(request: Request): boolean {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return false;
  const recebido = request.headers.get("authorization") ?? "";
  const esperado = `Bearer ${segredo}`;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function naoAutorizado() {
  return Response.json({ erro: "não autorizado" }, { status: 401 });
}
