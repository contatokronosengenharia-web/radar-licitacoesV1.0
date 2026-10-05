export function CamposEmpresa() {
  return (
    <>
      <label>
        <span className="rotulo">Razão social</span>
        <input name="razaoSocial" required className="campo" />
      </label>
      <label>
        <span className="rotulo">CNPJ</span>
        <input name="cnpj" required className="campo" inputMode="numeric" placeholder="00.000.000/0000-00" />
      </label>
      <label>
        <span className="rotulo">Telefone (opcional)</span>
        <input name="telefone" className="campo" inputMode="tel" placeholder="(11) 99999-9999" />
      </label>
    </>
  );
}
