import Link from "next/link";
import { redirect } from "next/navigation";
import { sessaoAtual } from "@/lib/contexto";

export default async function Inicio() {
  if (await sessaoAtual()) redirect("/painel");
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-20">
      <h1 className="text-3xl font-bold">Radar de Licitações</h1>
      <p className="text-lg text-slate-700">
        Configure uma vez os filtros da sua empresa. Todos os dias o Radar coleta as novas contratações publicadas no
        Portal Nacional de Contratações Públicas (PNCP) e separa as que interessam a você.
      </p>
      <div className="flex gap-3">
        <Link href="/cadastro" className="botao">Criar conta</Link>
        <Link href="/entrar" className="botao-secundario">Entrar</Link>
      </div>
    </main>
  );
}
