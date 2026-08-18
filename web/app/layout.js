import "./globals.css";

export const metadata = {
  title: "Histórico de inventario de medicamentos — Mi Farma Digital (CSS)",
  description:
    "Registro histórico del inventario público de medicamentos de Mi Farma Digital, Caja de Seguro Social de Panamá. Capturas automatizadas conservadas en el tiempo.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
