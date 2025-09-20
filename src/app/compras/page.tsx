import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import ComprasPageClient from '@/components/features/compras/ComprasPageClient';

// This is the main page for the /compras route.
// It wraps the main client component in a Suspense boundary to allow
// the use of client-side hooks like useSearchParams.
export default function ComprasPage() {
  return (
    <div>
      <Suspense fallback={
          <div className="flex w-full h-screen items-center justify-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
      }>
          <ComprasPageClient />
      </Suspense>
    </div>
  );
}
