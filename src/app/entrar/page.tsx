import Link from "next/link";
import { entrar } from "@/app/acoes-conta";
import { Formulario } from "@/componentes/Formulario";

export default function Entrar() {
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="mb-6 text-2xl font-bold">Entrar</h1>
      <div className="cartao">
        <Formulario acao={entrar} rotuloBotao="Entrar">
          <label>
            <span className="rotulo">E-mail</span>
            <input name="email" type="email" required className="campo" autoComplete="email" />
          </label>
          <label>
            <span className="rotulo">Senha</span>
            <input name="senha" type="password" required className="campo" autoComplete="current-password" />
          </label>
        </Formulario>
      </div>
      <p className="mt-4 text-sm text-slate-600">
        Ainda não tem conta? <Link href="/cadastro" className="text-blue-700 underline">Cadastre sua empresa</Link>
      </p>
    </main>
  );
}
