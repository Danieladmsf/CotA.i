import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get('host') || '';

  // Detectar ambiente
  const isLocalhost = hostname.includes('localhost') || hostname.includes('127.0.0.1');
  const isNipIo = hostname.includes('nip.io');
  const isVercelDomain = hostname.includes('vercel.app');

  // Em desenvolvimento local e domínios Vercel, permitir tudo
  if (isLocalhost || isNipIo || isVercelDomain) {
    return NextResponse.next();
  }

  // TEMPORARILY BYPASS MIDDLEWARE FOR TESTING
  return NextResponse.next();

  /*
  // Extrair subdomínio
  const subdomain = hostname.split('.')[0];


  // Definir subdomínios permitidos
  const SUPPLIER_SUBDOMAINS = ['fornecedor', 'portal', 'supplier'];
  const APP_SUBDOMAINS = ['app', 'admin', 'www'];

  const isSupplierSubdomain = SUPPLIER_SUBDOMAINS.includes(subdomain);
  const isAppSubdomain = APP_SUBDOMAINS.includes(subdomain) || subdomain === 'cota';

  // REGRA 1: Subdomínio de fornecedor só acessa /portal
  if (isSupplierSubdomain) {
    // Permitir apenas rotas do portal
    if (pathname.startsWith('/portal')) {
      return NextResponse.next();
    }

    // Redirecionar qualquer outra rota para página de informação do portal
    const url = request.nextUrl.clone();
    url.pathname = '/portal';
    return NextResponse.redirect(url);
  }

  // REGRA 2: Subdomínio da aplicação NÃO acessa /portal
  if (isAppSubdomain) {
    // Bloquear acesso ao portal
    if (pathname.startsWith('/portal')) {
      const url = request.nextUrl.clone();
      url.pathname = '/compras';
      return NextResponse.redirect(url);
    }

    // Permitir todas as outras rotas
    return NextResponse.next();
  }

  // REGRA 3: Domínio raiz sem subdomínio
  // Se acessar cota.i diretamente, redirecionar para app.cota.i
  if (!isSupplierSubdomain && !isAppSubdomain) {
    const url = request.nextUrl.clone();
    url.hostname = `app.${hostname}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
  */
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*|__/auth).*)',
  ],
};
