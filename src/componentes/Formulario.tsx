"use client";

import { useActionState } from "react";
import type { EstadoFormulario } from "@/app/acoes-conta";

type Acao = (estado: EstadoFormulario, form: FormData) => Promise<EstadoFormulario>;

/** Formulário com server action, mensagem de erro/sucesso e botão que trava durante o envio. */
export function Formulario({
  acao,
  rotuloBotao,
  children,
  className,
}: {
  acao: Acao;
  rotuloBotao: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [estado, enviar, enviando] = useActionState(acao, undefined);
  return (
    <form action={enviar} className={className ?? "flex flex-col gap-4"}>
      {children}
      {estado?.erro && <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">{estado.erro}</p>}
      {estado?.ok && <p className="rounded-md bg-green-50 p-3 text-sm text-green-800">{estado.ok}</p>}
      <div>
        <button type="submit" className="botao" disabled={enviando}>
          {enviando ? "Enviando..." : rotuloBotao}
        </button>
      </div>
    </form>
  );
}
