'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth, isFirebaseInitialized } from '@/lib/config/firebase';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    console.log('🔥 AuthProvider: Initializing...');
    console.log('🔥 AuthProvider: Firebase initialized?', isFirebaseInitialized);

    if (!isFirebaseInitialized) {
      console.error("🔥 AuthProvider: Firebase credentials not found. Authentication is disabled.");
      setLoading(false);
      return;
    }

    console.log('🔥 AuthProvider: Setting up auth state listener...');
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('🔥 AuthProvider: Auth state changed:', user ? `User logged in: ${user.email}` : 'User logged out');
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    console.log('🔥 AuthProvider: signInWithGoogle called');
    console.log('🔥 AuthProvider: Firebase initialized?', isFirebaseInitialized);

    if (!isFirebaseInitialized) {
      console.error('🔥 AuthProvider: Firebase not initialized, showing error toast');
      toast({ title: "Erro de Configuração", description: "A autenticação não está configurada.", variant: "destructive" });
      return;
    }

    console.log('🔥 AuthProvider: Creating Google provider...');
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
      console.log('🔥 AuthProvider: Starting Google sign in popup...');
      const result = await signInWithPopup(auth, provider);
      console.log('🔥 AuthProvider: Google sign in successful!', result.user.email);
      toast({ title: "Login bem-sucedido!", variant: "default" });
      router.push('/'); // Redirect to home after login
    } catch (error: any) {
      console.error("🔥 AuthProvider: Error signing in with Google:", error);
      console.error("🔥 AuthProvider: Error code:", error.code);
      console.error("🔥 AuthProvider: Error message:", error.message);

      if (error.code !== 'auth/popup-closed-by-user') {
        toast({ title: "Falha no Login", description: error.message, variant: "destructive" });
      } else {
        console.log('🔥 AuthProvider: Popup was closed by user');
      }
    }
  };

  const logout = async () => {
    if (!isFirebaseInitialized) return;
    try {
      await signOut(auth);
      router.push('/login'); // Redirect to login after logout
    } catch (error: any) {
      console.error('Error signing out:', error);
      toast({ title: "Falha no Logout", description: error.message, variant: "destructive" });
    }
  };

  const value: AuthContextType = { user, loading, signInWithGoogle, logout };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
