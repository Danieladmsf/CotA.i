import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PageContentProps {
  title: string;
  icon?: React.ReactNode;
}

export default function PageContent({ title, icon }: PageContentProps) {
  return (
    <div className="space-y-6">
      <header className="fade-in">
        <h1 className="text-5xl text-display text-gradient mb-3 flex items-center gap-4">
          <span className="float scale-hover">{icon}</span>
          {title}
        </h1>
        <p className="text-body-large text-muted-foreground">
          Funcionalidade em desenvolvimento - em breve disponível
        </p>
      </header>
      
      <Card className="w-full card-professional modern-shadow-xl hover-lift">
        <CardHeader className="header-modern">
          <CardTitle className="flex items-center gap-2 text-2xl font-headline text-gradient">
            <span className="rotate-hover">{icon}</span>
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="bounce-in">
          <div className="text-center py-12">
            <div className="shimmer rounded-lg p-8 mb-4 modern-shadow">
              <p className="text-lg text-muted-foreground">Em criação...</p>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Esta página está atualmente em desenvolvimento. Volte em breve para conferir as novidades!
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
