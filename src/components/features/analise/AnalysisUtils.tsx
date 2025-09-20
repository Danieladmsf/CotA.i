import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  AlertTriangle,
  CheckCircle,
  DollarSign,
  BarChart3,
  Clock,
  Star,
  Shield,
  Target
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { PriceAnalysisItem, SupplierAnalysis } from '@/hooks/use-price-analysis';

// Componente para exibir tendência com ícone e cor
export function TrendBadge({ 
  trend, 
  percentage 
}: { 
  trend: 'up' | 'down' | 'stable'; 
  percentage: number; 
}) {
  const getTrendConfig = () => {
    switch (trend) {
      case 'up':
        return {
          variant: 'destructive' as const,
          icon: <TrendingUp className="h-3 w-3 mr-1" />,
          color: 'text-red-600'
        };
      case 'down':
        return {
          variant: 'default' as const,
          icon: <TrendingDown className="h-3 w-3 mr-1" />,
          color: 'text-green-600'
        };
      default:
        return {
          variant: 'secondary' as const,
          icon: <Minus className="h-3 w-3 mr-1" />,
          color: 'text-gray-600'
        };
    }
  };

  const config = getTrendConfig();

  return (
    <Badge variant={config.variant}>
      {config.icon}
      {percentage >= 0 ? '+' : ''}{percentage.toFixed(1)}%
    </Badge>
  );
}

// Componente para exibir nível de competição
export function CompetitionBadge({ 
  level 
}: { 
  level: 'low' | 'medium' | 'high'; 
}) {
  const getCompetitionConfig = () => {
    switch (level) {
      case 'high':
        return {
          variant: 'default' as const,
          icon: <Users className="w-3 h-3" />,
          label: 'Alta',
          color: 'text-green-600'
        };
      case 'medium':
        return {
          variant: 'secondary' as const,
          icon: <Users className="w-3 h-3" />,
          label: 'Média',
          color: 'text-yellow-600'
        };
      default:
        return {
          variant: 'outline' as const,
          icon: <Users className="w-3 h-3" />,
          label: 'Baixa',
          color: 'text-red-600'
        };
    }
  };

  const config = getCompetitionConfig();

  return (
    <Badge variant={config.variant}>
      {config.icon}
      <span className="ml-1">{config.label}</span>
    </Badge>
  );
}

// Componente para exibir posição de mercado
export function MarketPositionBadge({ 
  position 
}: { 
  position: 'cheap' | 'average' | 'expensive'; 
}) {
  const getPositionConfig = () => {
    switch (position) {
      case 'cheap':
        return {
          variant: 'default' as const,
          icon: <CheckCircle className="w-3 h-3" />,
          label: 'Econômico',
          color: 'bg-green-500'
        };
      case 'expensive':
        return {
          variant: 'destructive' as const,
          icon: <AlertTriangle className="w-3 h-3" />,
          label: 'Caro',
          color: 'bg-red-500'
        };
      default:
        return {
          variant: 'secondary' as const,
          icon: <Target className="w-3 h-3" />,
          label: 'Médio',
          color: 'bg-blue-500'
        };
    }
  };

  const config = getPositionConfig();

  return (
    <Badge variant={config.variant}>
      {config.icon}
      <span className="ml-1">{config.label}</span>
    </Badge>
  );
}

// Componente para exibir nível de volatilidade
export function VolatilityIndicator({ 
  volatility 
}: { 
  volatility: number; 
}) {
  const getVolatilityLevel = () => {
    if (volatility < 5) return { level: 'Muito Baixa', color: 'bg-green-500', percentage: 20 };
    if (volatility < 10) return { level: 'Baixa', color: 'bg-blue-500', percentage: 40 };
    if (volatility < 20) return { level: 'Moderada', color: 'bg-yellow-500', percentage: 60 };
    if (volatility < 35) return { level: 'Alta', color: 'bg-orange-500', percentage: 80 };
    return { level: 'Muito Alta', color: 'bg-red-500', percentage: 100 };
  };

  const { level, color, percentage } = getVolatilityLevel();

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <div className="flex justify-between text-xs mb-1">
          <span>Volatilidade</span>
          <span className="font-medium">{volatility.toFixed(1)}%</span>
        </div>
        <Progress value={percentage} className="h-2" />
      </div>
      <Badge variant="outline" className="text-xs">
        {level}
      </Badge>
    </div>
  );
}

// Componente para card de produto resumido
export function ProductSummaryCard({ 
  product 
}: { 
  product: PriceAnalysisItem; 
}) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <h3 className="font-semibold text-lg truncate">{product.name}</h3>
            <p className="text-sm text-muted-foreground">{product.category || 'Sem categoria'}</p>
          </div>
          <div className="flex flex-col gap-1">
            <TrendBadge trend={product.trend} percentage={product.lastVariationPercent} />
            <CompetitionBadge level={product.competitionLevel} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Preço Atual</p>
            <p className="font-semibold text-lg text-green-600">{formatCurrency(product.currentPrice)}</p>
            <p className="text-xs text-muted-foreground">por {product.unit}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Posição</p>
            <MarketPositionBadge position={product.marketPosition} />
            <p className="text-xs text-muted-foreground mt-1">{product.totalOffers} ofertas</p>
          </div>
        </div>

        <div className="space-y-3">
          <VolatilityIndicator volatility={product.volatility} />
          
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Melhor Fornecedor</p>
            <p className="text-sm font-medium text-blue-600">{product.bestSupplier}</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(product.bestSupplierPrice)}</p>
          </div>

          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>Atualizado em {formatDate(product.lastUpdate)}</span>
            </div>
            <div className="flex items-center gap-1">
              <BarChart3 className="w-3 h-3" />
              <span>Faixa: {formatCurrency(product.priceRange.min)} - {formatCurrency(product.priceRange.max)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Componente para card de fornecedor
export function SupplierCard({ 
  supplier, 
  rank 
}: { 
  supplier: SupplierAnalysis; 
  rank: number; 
}) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const getRankColor = (position: number) => {
    switch (position) {
      case 1: return 'bg-yellow-500 text-white';
      case 2: return 'bg-gray-400 text-white';
      case 3: return 'bg-amber-600 text-white';
      default: return 'bg-blue-500 text-white';
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-3 mb-4">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${getRankColor(rank)}`}>
            {rank}
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg">{supplier.name}</h3>
            <p className="text-sm text-muted-foreground">{supplier.productCount} produtos</p>
          </div>
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 text-yellow-500" />
            <span className="text-sm font-medium">{supplier.competitiveness.toFixed(1)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Preço Médio</p>
            <p className="font-semibold text-green-600">{formatCurrency(supplier.averagePrice)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Ofertas</p>
            <p className="font-semibold">{supplier.totalOffers}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Confiabilidade</span>
              <span className="font-medium">{supplier.reliability.toFixed(1)}%</span>
            </div>
            <Progress value={supplier.reliability} className="h-2" />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Consistência de Preços</span>
              <span className="font-medium">{supplier.priceConsistency.toFixed(1)}%</span>
            </div>
            <Progress value={supplier.priceConsistency} className="h-2" />
          </div>

          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Categorias</p>
            <div className="flex flex-wrap gap-1">
              {supplier.categories.slice(0, 3).map(category => (
                <Badge key={category} variant="outline" className="text-xs">
                  {category}
                </Badge>
              ))}
              {supplier.categories.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{supplier.categories.length - 3}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Componente para card de estatística
export function StatCard({
  title,
  value,
  icon,
  description,
  trend,
  color = 'blue'
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description?: string;
  trend?: { value: number; positive: boolean };
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'gray';
}) {
  const getColorClasses = () => {
    const colors = {
      blue: 'text-blue-500',
      green: 'text-green-500',
      red: 'text-red-500',
      yellow: 'text-yellow-500',
      purple: 'text-purple-500',
      gray: 'text-gray-500'
    };
    return colors[color];
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            )}
            {trend && (
              <div className={`flex items-center gap-1 mt-1 ${trend.positive ? 'text-green-600' : 'text-red-600'}`}>
                {trend.positive ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                <span className="text-xs font-medium">
                  {trend.positive ? '+' : ''}{trend.value.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
          <div className={`h-8 w-8 ${getColorClasses()}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Componente para alertas de análise
export function AnalysisAlert({
  type,
  title,
  description,
  count
}: {
  type: 'warning' | 'info' | 'success' | 'error';
  title: string;
  description: string;
  count?: number;
}) {
  const getAlertConfig = () => {
    switch (type) {
      case 'warning':
        return {
          color: 'bg-yellow-50 border-yellow-200',
          iconColor: 'text-yellow-600',
          titleColor: 'text-yellow-800',
          descColor: 'text-yellow-700',
          icon: <AlertTriangle className="h-4 w-4" />
        };
      case 'error':
        return {
          color: 'bg-red-50 border-red-200',
          iconColor: 'text-red-600',
          titleColor: 'text-red-800',
          descColor: 'text-red-700',
          icon: <AlertTriangle className="h-4 w-4" />
        };
      case 'success':
        return {
          color: 'bg-green-50 border-green-200',
          iconColor: 'text-green-600',
          titleColor: 'text-green-800',
          descColor: 'text-green-700',
          icon: <CheckCircle className="h-4 w-4" />
        };
      default:
        return {
          color: 'bg-blue-50 border-blue-200',
          iconColor: 'text-blue-600',
          titleColor: 'text-blue-800',
          descColor: 'text-blue-700',
          icon: <BarChart3 className="h-4 w-4" />
        };
    }
  };

  const config = getAlertConfig();

  return (
    <div className={`p-4 rounded-lg border ${config.color}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={config.iconColor}>
          {config.icon}
        </div>
        <h4 className={`font-semibold ${config.titleColor}`}>
          {title}
          {count !== undefined && (
            <span className="ml-2 text-sm font-normal">({count})</span>
          )}
        </h4>
      </div>
      <p className={`text-sm ${config.descColor}`}>
        {description}
      </p>
    </div>
  );
}

// Componente para mostrar progresso de carregamento
export function AnalysisLoader({ 
  message = "Carregando análise..." 
}: { 
  message?: string; 
}) {
  return (
    <div className="flex items-center justify-center min-h-96">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

// Componente para estado vazio
export function EmptyAnalysis({ 
  title = "Nenhum dado encontrado",
  description = "Ajuste os filtros para ver mais resultados.",
  icon
}: { 
  title?: string;
  description?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="text-center py-12">
      <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        {icon || <BarChart3 className="w-12 h-12 text-gray-400" />}
      </div>
      <h3 className="text-lg font-medium mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}