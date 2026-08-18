import estilos from "./Pie.module.css";

export default function Pie() {
  return (
    <footer className={estilos.pie}>
      <div className="contenedor">
        <p className={estilos.fuente}>
          Fuente: Mi Farma Digital — Caja de Seguro Social de Panamá. Datos
          capturados de forma automatizada. Este sitio no está afiliado a la
          CSS.
        </p>
        <p className={estilos.autor}>por Saúl Santos</p>
      </div>
    </footer>
  );
}
