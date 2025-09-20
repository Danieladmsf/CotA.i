
// src/app/registro-fornecedor/page.tsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Home } from 'lucide-react';

export default function InvalidInvitePage() {
  return (
    <div className="container mx-auto p-4 md:p-8 flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
      <Card className="w-full max-w-lg text-center shadow-xl">
        <CardHeader>
          <div className="mx-auto bg-destructive/10 p-3 rounded-full w-fit">
            <AlertTriangle className="h-10 w-10 text-destructive" />
          </div>
          <CardTitle className="mt-4 text-2xl font-bold text-destructive">Convite Inválido</CardTitle>
           <CardDescription className="pt-2 text-muted-foreground">
             Esta página é apenas para registro via convite.
           </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-muted-foreground">
          <p>
            Para se cadastrar como fornecedor, você precisa receber um link de convite único do administrador do sistema.
          </p>
          <p>
            Se você já tem um link, por favor, verifique se ele está correto e tente novamente.
          </p>
          <Button asChild className="mt-6 bg-primary hover:bg-primary/90 text-primary-foreground">
            <Link href="/">
                <Home className="mr-2 h-4 w-4"/>
                Voltar para a Página Inicial
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
