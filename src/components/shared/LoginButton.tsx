'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

export default function LoginButton() {
  const { user, signInWithGoogle, logout, loading } = useAuth();

  if (loading) {
    return <Button disabled>Loading...</Button>;
  }

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <span>Olá, {user.displayName}</span>
        <Button onClick={logout} variant="outline">
          Sair
        </Button>
      </div>
    );
  }

  return (
    <Button onClick={signInWithGoogle}>
      Entrar com Google
    </Button>
  );
}