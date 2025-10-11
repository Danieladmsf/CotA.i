'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import Image from 'next/image';

type BrandRequestStatus = 'pending' | 'approved' | 'rejected';

interface BrandRequestCardProps {
  id: string;
  brandName: string;
  supplierName: string;
  supplierInitials: string;
  imageUrl?: string;
  status: BrandRequestStatus;
  unitsInPackaging?: number;
  unitWeight?: number;
  totalPackagingPrice?: number;
  pricePerUnit?: number;
  productUnit: string;
  formatCurrency: (value: number) => string;
  abbreviateUnit: (unit: string) => string;
  formatPackaging: (units: number, weight: number, unit: string) => string;
}

export function BrandRequestCard({
  id,
  brandName,
  supplierName,
  supplierInitials,
  imageUrl,
  status,
  unitsInPackaging,
  unitWeight,
  totalPackagingPrice,
  pricePerUnit,
  productUnit,
  formatCurrency,
  abbreviateUnit,
  formatPackaging
}: BrandRequestCardProps) {
  // Define colors based on status (only pending or rejected shown)
  const isPending = status === 'pending';
  const isRejected = status === 'rejected';

  const cardBg = isPending ? 'bg-orange-50/50' : 'bg-red-50/50';
  const borderColor = isPending ? 'border-orange-500' : 'border-red-500';
  const textColor = isPending ? 'text-orange-600' : 'text-red-600';
  const badgeBorder = isPending ? 'border-orange-600' : 'border-red-600';
  const badgeText = isPending ? 'text-orange-700' : 'text-red-700';
  const badgeLabel = isPending ? 'Aguardando Aprovação' : '✗ Rejeitada';

  // Calculate price per unit if not provided
  const calculatePricePerUnit = (): string => {
    // Use provided pricePerUnit if valid
    if (pricePerUnit && !isNaN(pricePerUnit)) {
      return formatCurrency(pricePerUnit);
    }
    // Recalculate if we have the necessary data
    if (totalPackagingPrice && unitsInPackaging && unitWeight) {
      const calculated = totalPackagingPrice / (unitsInPackaging * unitWeight);
      return formatCurrency(calculated);
    }
    return "-";
  };

  return (
    <div key={id} className={`flex items-start justify-between p-3 rounded-md ${cardBg} border-l-4 ${borderColor} min-w-[280px] gap-3`}>
      <div className="flex items-start gap-3 flex-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Avatar className="h-8 w-8 shrink-0 cursor-pointer">
                {imageUrl ? (
                  <Image
                    src={imageUrl}
                    alt={brandName}
                    width={40}
                    height={40}
                    className="object-cover w-full h-full rounded-full"
                  />
                ) : (
                  <AvatarFallback className="text-xs bg-orange-100">{supplierInitials}</AvatarFallback>
                )}
              </Avatar>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-background border text-foreground shadow-lg rounded-md text-xs p-2">
              <p className="font-semibold">{supplierName}</p>
              <p className="text-muted-foreground">Nova marca proposta</p>
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
        <p className={`text-base font-bold ${textColor} leading-tight`}>
          {calculatePricePerUnit()} / {abbreviateUnit(productUnit)}
        </p>
        <div className="mt-1">
          <Badge variant="outline" className={`text-xs ${badgeBorder} ${badgeText}`}>
            {badgeLabel}
          </Badge>
        </div>
      </div>
    </div>
  );
}
