'use client';

import AuthDebug from '@/components/debug/AuthDebug';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function AuthTestPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Teste de Autenticação</h1>
        </div>
        
        <AuthDebug />
        
        <div className="text-center text-sm text-gray-600">
          Esta página é para debuggar problemas de login.
        </div>
      </div>
    </div>
  );
}