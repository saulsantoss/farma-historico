import Link from "next/link";
import estilos from "./Cabecera.module.css";

const ENLACES = [
  { href: "/", clave: "inicio", texto: "Inicio" },
  { href: "/explorar", clave: "explorar", texto: "Explorar" },
  { href: "/metodologia", clave: "metodologia", texto: "Metodología" },
];

export default function Cabecera({ activo }) {
  return (
    <header className={estilos.cabecera}>
      <div className={`contenedor ${estilos.fila}`}>
        <Link href="/" className={estilos.titulo}>
          Histórico de medicamentos
        </Link>
        <nav className={estilos.nav}>
          {ENLACES.map((enlace) => (
            <Link
              key={enlace.clave}
              href={enlace.href}
              className={
                enlace.clave === activo
                  ? `${estilos.enlace} ${estilos.enlaceActivo}`
                  : estilos.enlace
              }
            >
              {enlace.texto}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
