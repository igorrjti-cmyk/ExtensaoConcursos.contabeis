import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Concursos Contabeis | @concursos.contabeis",
  description:
    "Painel de concursos publicos para Ciencias Contabeis: contador, tecnico em contabilidade, auditor fiscal e mais.",
  openGraph: {
    title: "Concursos Contabeis",
    description: "Todos os concursos para Ciencias Contabeis em um so lugar.",
    siteName: "Concursos Contabeis",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
        <meta name="theme-color" content="#060E20" />
      </head>
      <body suppressHydrationWarning style={{ margin: 0, padding: 0, background: "#080F1E", overflowX: "hidden" }}>
        {children}
      </body>
    </html>
  );
}
