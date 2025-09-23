'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { isFirebaseInitialized } from '@/lib/config/firebase';

export default function AuthDebug() {
  const { user, loading, signInWithGoogle, logout } = useAuth();

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>🔍 Debug de Autenticação</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>Firebase:</div>
          <Badge variant={isFirebaseInitialized ? "default" : "destructive"}>
            {isFirebaseInitialized ? "✅ Configurado" : "❌ Erro"}
          </Badge>
          
          <div>Loading:</div>
          <Badge variant={loading ? "secondary" : "outline"}>
            {loading ? "⏳ Carregando..." : "✅ Pronto"}
          </Badge>
          
          <div>Usuário:</div>
          <Badge variant={user ? "default" : "outline"}>
            {user ? "👤 Logado" : "🚫 Deslogado"}
          </Badge>
        </div>

        {user && (
          <div className="p-3 bg-green-50 rounded border">
            <div className="text-sm space-y-1">
              <div><strong>Nome:</strong> {user.displayName}</div>
              <div><strong>Email:</strong> {user.email}</div>
              <div><strong>UID:</strong> {user.uid}</div>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          {!user ? (
            <Button onClick={signInWithGoogle} disabled={loading} size="sm">
              🔑 Login
            </Button>
          ) : (
            <Button onClick={logout} variant="outline" size="sm">
              🚪 Logout
            </Button>
          )}
          {/* <Button onClick={debugFirebaseConfig} variant="ghost" size="sm">
            🔍 Debug
          </Button> */}
        </div>

        <div className="text-xs text-gray-500 p-2 bg-gray-50 rounded">
          <div>Console logs:</div>
          <div>• Abra Developer Tools (F12)</div>
          <div>• Vá na aba Console</div>
          <div>• Procure por mensagens de Auth</div>
        </div>
      </CardContent>
    </Card>
  );
}