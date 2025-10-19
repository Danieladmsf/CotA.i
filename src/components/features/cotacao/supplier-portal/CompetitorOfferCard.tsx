'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import Image from 'next/image';

interface CompetitorOfferCardProps {
  brandName: string;
  supplierId: string;
  supplierName: string;
  supplierInitials: string;
  supplierFotoUrl?: string;
  supplierFotoHint?: string;
  vendedor?: string;
  cnpj?: string;
  pricePerUnit: number;
  productUnit: string;
  unitsInPackaging?: number;
  unitWeight?: number;
  totalPackagingPrice?: number;
  isSelf: boolean;
  isLowestOverall: boolean;
  formatCurrency: (value: number) => string;
  abbreviateUnit: (unit: string) => string;
  formatPackaging: (units: number, weight: number, unit: string) => string;
  isValidImageUrl: (url?: string) => boolean;
}

export function CompetitorOfferCard({
  brandName,
  supplierId,
  supplierName,
  supplierInitials,
  supplierFotoUrl,
  supplierFotoHint,
  vendedor,
  cnpj,
  pricePerUnit,
  productUnit,
  unitsInPackaging,
  unitWeight,
  totalPackagingPrice,
  isSelf,
  isLowestOverall,
  formatCurrency,
  abbreviateUnit,
  formatPackaging,
  isValidImageUrl
}: CompetitorOfferCardProps) {
  // Determine card styling based on offer status
  let variantClasses = "border-muted-foreground/20";
  let textPriceClass = "text-foreground";

  if (isLowestOverall) {
    variantClasses = "border-green-500";
    textPriceClass = "text-green-600 dark:text-green-400";
  } else if (isSelf) {
    variantClasses = "border-primary";
    textPriceClass = "text-primary";
  }

  return (
    <div className={`flex items-start justify-between p-3 rounded-md bg-muted/20 border-l-4 min-w-[280px] gap-3 ${variantClasses}`}>
      <div className="flex items-start gap-3 flex-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Avatar className="h-8 w-8 shrink-0 cursor-pointer">
                <Image
                  src={isValidImageUrl(supplierFotoUrl) ? supplierFotoUrl! : 'https://placehold.co/40x40.png'}
                  alt={supplierName || 'Fornecedor'}
                  width={40}
                  height={40}
                  className="object-cover w-full h-full rounded-full"
                  data-ai-hint={supplierFotoHint || 'logo company'}
                />
                <AvatarFallback className="text-xs bg-muted">{supplierInitials}</AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-background border text-foreground shadow-lg rounded-md text-xs p-2">
              <p className="font-semibold">{vendedor}</p>
              <p>{supplierName}</p>
              <p className="text-muted-foreground">CNPJ: {cnpj}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="flex-1">
          <div className="mb-1">
            <h4 className="text-base font-semibold text-foreground" title={brandName}>
              {brandName}
              {unitsInPackaging && unitWeight && (
                <span className="text-sm text-muted-foreground font-normal">
                  {` - ${formatPackaging(unitsInPackaging, unitWeight, productUnit)}`}
                </span>
              )}
              {totalPackagingPrice && totalPackagingPrice > 0 && (
                <span className="text-sm text-muted-foreground font-normal">
                  {` | ${formatCurrency(totalPackagingPrice)}`}
                </span>
              )}
            </h4>
          </div>
          <p className="text-xs text-muted-foreground">por {supplierName}</p>
        </div>
      </div>

      <div className="text-right shrink-0">
        <p className={`text-base font-bold leading-tight ${textPriceClass}`}>
          {formatCurrency(pricePerUnit)} / {abbreviateUnit(productUnit)}
        </p>
        <div className="mt-1">
          {isLowestOverall && (
            <Badge
              variant={isSelf ? "default" : "outline"}
              className={`text-xs ${isSelf ? 'bg-green-600 text-white' : 'border-green-600 text-green-700'}`}
            >
              Melhor Preço
            </Badge>
          )}
          {!isLowestOverall && isSelf && (
            <Badge variant="default" className="text-xs">Sua Oferta</Badge>
          )}
        </div>
      </div>
    </div>
  );
}
