'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
  const { user, loading, signInWithGoogle } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // If user is logged in, redirect to home page
    if (!loading && user) {
      router.push('/');
    }
  }, [user, loading, router]);

  // Show a loading state while checking for user or if user exists (to allow for redirect)
  if (loading || user) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-100">
      <div className="text-center p-8 bg-white rounded-lg shadow-md">
        <h1 className="text-3xl font-bold mb-4">Bem-vindo</h1>
        <p className="text-gray-600 mb-8">Faça login para continuar</p>
        <Button onClick={signInWithGoogle} size="lg">
          <svg className="mr-2 h-5 w-5" aria-hidden="true" focusable="false" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
            <path fill="currentColor" d="M488 261.8C488 403.3 381.5 512 244 512 111.3 512 0 398.5 0 256S111.3 0 244 0c70.3 0 131.7 29.2 175.4 76.5l-64 64C320.5 112.3 286.2 96 244 96c-82.6 0-149.3 67.8-149.3 151.2s66.7 151.2 149.3 151.2c94.9 0 131.3-64.5 135.8-98.3H244v-75.3h236.4c2.5 13.2 3.6 27.6 3.6 42.5z"></path>
          </svg>
          Entrar com Google
        </Button>
      </div>
    </div>
  );
}
