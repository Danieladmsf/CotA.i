import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Package, Link2, Mail } from "lucide-react";

export default function PortalHomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-100">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Package className="h-16 w-16 text-blue-600" />
          </div>
          <CardTitle className="text-3xl">Portal do Fornecedor</CardTitle>
          <CardDescription className="text-lg mt-2">
            Sistema de Cotações Online
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">
              Bem-vindo ao Portal do Fornecedor! Para acessar uma cotação específica,
              você precisa do link único enviado por email ou WhatsApp.
            </p>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Link2 className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-left">
                  <p className="font-semibold text-blue-900 mb-1">Como acessar?</p>
                  <p className="text-sm text-blue-700">
                    O link de acesso é único e pessoal. Verifique sua caixa de entrada
                    ou mensagens do WhatsApp para encontrar o link da cotação.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-left">
                  <p className="font-semibold text-amber-900 mb-1">Não recebeu o link?</p>
                  <p className="text-sm text-amber-700">
                    Entre em contato com o comprador para solicitar um novo link de acesso à cotação.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t text-center text-sm text-muted-foreground">
            <p>Sistema de Cotações • Desenvolvido com Next.js e Firebase</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
