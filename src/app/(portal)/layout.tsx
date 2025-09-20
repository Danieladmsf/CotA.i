
import React from 'react';

// Este é o layout para o portal do fornecedor e outras páginas públicas.
// Ele não deve ter o menu lateral da área de gestão.
export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
