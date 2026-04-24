import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Votação',
  description: 'Crie votações e compartilhe com qualquer pessoa',
  icons: {
    icon: '/icon.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
