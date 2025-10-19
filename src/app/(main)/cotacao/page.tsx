
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import CotacaoClient from '@/components/features/cotacao/CotacaoClient';

// This page wraps the client component in a Suspense boundary
// to handle the use of searchParams, which is a client-side hook.
export default function CotacaoPage() {
  return (
    <Suspense fallback={
        <div className="flex w-full h-screen items-center justify-center gradient-bg">
            <div className="loading-modern p-8 rounded-lg modern-shadow-xl">
                <Loader2 className="h-10 w-10 animate-spin text-primary pulse-glow" />
            </div>
        </div>
    }>
        <CotacaoClient />
    </Suspense>
  );
}
