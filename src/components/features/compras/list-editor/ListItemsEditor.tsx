"use client";

/**
 * ListItemsEditor Component
 *
 * Card da direita - Editor de itens da lista de compras.
 * Exibe todos os itens adicionados com campos editáveis.
 * Suporta modo read-only para cotações históricas.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Info } from 'lucide-react';
import ListItemCard from './ListItemCard';
import type { UnitOfMeasure } from '@/types';
import { Timestamp } from 'firebase/firestore';

interface ListItem {
  id?: string;
  supplyId: string;
  name: string;
  quantity: number | string;
  unit: UnitOfMeasure;
  preferredBrands?: string;
  notes?: string;
  status: 'Pendente' | 'Cotado' | 'Comprado' | 'Recebido' | 'Cancelado' | 'Encerrado';
  deliveryDate?: Timestamp;
  hasSpecificDate?: boolean;
  quotationId?: string;
}

interface ListItemsEditorProps {
  items: ListItem[];
  selectedDate: Date;
  isLoading?: boolean;
  isReadOnly?: boolean;
  hasActiveQuotation?: boolean;
  highlightedItemId?: string | null;
  onUpdate: (supplyId: string, field: keyof ListItem, value: any) => void;
  onDelete: (item: ListItem) => void;
  onItemFocus?: (supplyId: string) => void;
  onQuantityKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  quantityInputRefs?: React.MutableRefObject<Record<string, HTMLInputElement | null>>;
}

export default function ListItemsEditor({
  items,
  selectedDate,
  isLoading = false,
  isReadOnly = false,
  hasActiveQuotation = false,
  highlightedItemId = null,
  onUpdate,
  onDelete,
  onItemFocus,
  onQuantityKeyDown,
  quantityInputRefs,
}: ListItemsEditorProps) {
  const [openCalendarId, setOpenCalendarId] = useState<string | null>(null);

  return (
    <Card className="shadow-lg rounded-xl">
      <CardHeader className="border-b p-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">Itens da Lista ({items.length})</CardTitle>
          {hasActiveQuotation && (
            <Badge className="bg-green-500 text-white animate-pulse">
              🟢 Em Cotação
            </Badge>
          )}
        </div>
        <CardDescription>
          {isReadOnly
            ? 'Visualização de cotação encerrada - somente leitura'
            : 'Defina as quantidades, datas de entrega e observações para cada item.'}
        </CardDescription>
      </CardHeader>

      <CardContent className="p-4 space-y-3 max-h-[calc(100vh-260px)] overflow-y-auto">
        {/* Read-only warning banner */}
        {isReadOnly && (
          <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <Info className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <strong>Cotação Encerrada:</strong> Esta lista está em modo somente leitura.
              Para editar, crie uma nova lista de compras.
            </div>
          </div>
        )}

        {/* Active quotation info banner */}
        {hasActiveQuotation && !isReadOnly && (
          <div className="flex items-start gap-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
            <Info className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-purple-800">
              <strong>Cotação em andamento:</strong> Você pode adicionar ou excluir itens.
              Os fornecedores serão notificados automaticamente.
            </p>
          </div>
        )}

        {/* No date selected */}
        {!selectedDate ? (
          <p className="text-muted-foreground text-center py-8">
            Selecione uma data para ver os itens da lista.
          </p>
        ) : isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Sua lista está vazia. Adicione insumos do painel à esquerda.
          </p>
        ) : (
          /* List items */
          items.map((item) => (
            <ListItemCard
              key={item.supplyId}
              item={item}
              selectedDate={selectedDate}
              isHighlighted={highlightedItemId === item.supplyId}
              isReadOnly={isReadOnly}
              openCalendarId={openCalendarId}
              onCalendarOpenChange={setOpenCalendarId}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onFocus={onItemFocus}
              onQuantityKeyDown={onQuantityKeyDown}
              quantityInputRef={
                quantityInputRefs
                  ? (el) => {
                      if (quantityInputRefs.current) {
                        quantityInputRefs.current[item.supplyId] = el;
                      }
                    }
                  : undefined
              }
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}
