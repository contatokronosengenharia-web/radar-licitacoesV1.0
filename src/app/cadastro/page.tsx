import Link from "next/link";
import { cadastrar } from "@/app/acoes-conta";
import { CamposEmpresa } from "@/componentes/CamposEmpresa";
import { Formulario } from "@/componentes/Formulario";

export default function Cadastro() {
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="mb-2 text-2xl font-bold">Cadastre sua empresa</h1>
      <p className="mb-6 text-sm text-slate-600">Um cadastro por empresa. Depois você configura os filtros de interesse.</p>
      <div className="cartao">
        <Formulario acao={cadastrar} rotuloBotao="Criar conta">
          <CamposEmpresa />
          <hr className="border-slate-200" />
          <label>
            <span className="rotulo">Seu nome</span>
            <input name="nome" required className="campo" autoComplete="name" />
          </label>
          <label>
            <span className="rotulo">E-mail</span>
            <input name="email" type="email" required className="campo" autoComplete="email" />
          </label>
          <label>
            <span className="rotulo">Senha (mínimo 8 caracteres)</span>
            <input name="senha" type="password" required minLength={8} className="campo" autoComplete="new-password" />
          </label>
        </Formulario>
      </div>
      <p className="mt-4 text-sm text-slate-600">
        Já tem conta? <Link href="/entrar" className="text-blue-700 underline">Entrar</Link>
      </p>
    </main>
  );
}
