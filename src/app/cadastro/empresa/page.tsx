import { redirect } from "next/navigation";
import { concluirEmpresa } from "@/app/acoes-conta";
import { CamposEmpresa } from "@/componentes/CamposEmpresa";
import { Formulario } from "@/componentes/Formulario";
import { sessaoAtual } from "@/lib/contexto";

export default async function ConcluirEmpresa(props: PageProps<"/cadastro/empresa">) {
  if (!(await sessaoAtual())) redirect("/entrar");
  const { erro } = await props.searchParams;
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="mb-2 text-2xl font-bold">Dados da empresa</h1>
      {erro === "cnpj" && (
        <p className="mb-4 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          Sua conta foi criada, mas este CNPJ já estava cadastrado. Informe outro CNPJ ou fale com o suporte.
        </p>
      )}
      <div className="cartao">
        <Formulario acao={concluirEmpresa} rotuloBotao="Salvar empresa">
          <CamposEmpresa />
        </Formulario>
      </div>
    </main>
  );
}
