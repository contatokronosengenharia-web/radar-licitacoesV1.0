"use client";

import { useActionState } from "react";
import type { EstadoAdmin } from "./acoes";

export function BotaoAdmin({
  acao,
  rotulo,
  campos,
}: {
  acao: (estado: EstadoAdmin, form: FormData) => Promise<EstadoAdmin>;
  rotulo: string;
  campos?: Record<string, string>;
}) {
  const [estado, executar, executando] = useActionState(acao, undefined);
  return (
    <form action={executar} className="flex flex-col gap-1">
      {Object.entries(campos ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button className="botao-secundario" disabled={executando}>{executando ? "Executando..." : rotulo}</button>
      {estado && <p className={`max-w-sm text-xs ${estado.erro ? "text-red-700" : "text-slate-600"}`}>{estado.mensagem}</p>}
    </form>
  );
}
