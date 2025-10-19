"use client";

/**
 * ListItemCard Component
 *
 * Card individual para cada item da lista de compras.
 * Mostra campos editáveis: quantidade, data de entrega e observações.
 * Suporta modo read-only para cotações fechadas.
 */

import React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Timestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Trash2, Calendar as CalendarIcon, Lock } from 'lucide-react';
import { abbreviateUnit } from '@/lib/utils/unitFormatters';
import type { UnitOfMeasure } from '@/types';

interface ListItemCardProps {
  item: {
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
  };
  selectedDate: Date;
  isHighlighted?: boolean;
  isReadOnly?: boolean;
  openCalendarId: string | null;
  onCalendarOpenChange: (id: string | null) => void;
  onUpdate: (supplyId: string, field: keyof ListItemCardProps['item'], value: any) => void;
  onDelete: (item: any) => void;
  onFocus?: (supplyId: string) => void;
  onQuantityKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  quantityInputRef?: (el: HTMLInputElement | null) => void;
}

export default function ListItemCard({
  item,
  selectedDate,
  isHighlighted = false,
  isReadOnly = false,
  openCalendarId,
  onCalendarOpenChange,
  onUpdate,
  onDelete,
  onFocus,
  onQuantityKeyDown,
  quantityInputRef,
}: ListItemCardProps) {
  const isLocked = item.status !== 'Pendente';

  return (
    <div
      id={`item-card-${item.supplyId}`}
      className={`relative p-3 border rounded-lg space-y-2 shadow-sm transition-all duration-300 ${
        isHighlighted ? 'bg-primary/10 border-primary/40' : 'bg-background'
      } ${isLocked || isReadOnly ? 'bg-muted/30 opacity-70' : ''}`}
    >
      {/* Status locked badge */}
      {isLocked && (
        <div className="absolute top-2 right-2 text-muted-foreground flex items-center gap-1 text-xs">
          <Lock size={12} /> {item.status}
        </div>
      )}

      {/* Read-only badge */}
      {isReadOnly && !isLocked && (
        <div className="absolute top-2 right-2 text-muted-foreground flex items-center gap-1 text-xs">
          <Lock size={12} /> Somente Leitura
        </div>
      )}

      {/* Item name and delete button */}
      <div className="flex items-center justify-between">
        <p className="font-medium text-base">{item.name}</p>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(item)}
          disabled={isReadOnly}
          className="text-destructive h-7 w-7"
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Remover {item.name} da lista</span>
        </Button>
      </div>

      {/* Quantity and delivery date inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Quantity input */}
        <div className="sm:col-span-1">
          <label
            htmlFor={`quantity-${item.supplyId}`}
            className="text-xs text-muted-foreground block mb-0.5"
          >
            Quantidade
          </label>
          <div className="relative">
            <Input
              id={`quantity-${item.supplyId}`}
              ref={quantityInputRef}
              type="text"
              inputMode="decimal"
              value={item.quantity}
              onFocus={() => onFocus?.(item.supplyId)}
              onChange={(e) => onUpdate(item.supplyId, 'quantity', e.target.value)}
              onKeyDown={onQuantityKeyDown}
              disabled={isLocked || isReadOnly}
              className="pr-12"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">
              {abbreviateUnit(item.unit)}
            </span>
          </div>
        </div>

        {/* Delivery date input */}
        <div className="sm:col-span-1">
          <label
            htmlFor={`date-${item.supplyId}`}
            className="text-xs text-muted-foreground block mb-0.5"
          >
            Data Entrega
          </label>
          <Popover
            open={openCalendarId === item.supplyId}
            onOpenChange={(isOpen) => onCalendarOpenChange(isOpen ? item.supplyId : null)}
          >
            <PopoverTrigger asChild>
              <Button
                variant={'outline'}
                className="w-full justify-start text-left font-normal"
                disabled={isLocked || isReadOnly}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {item.deliveryDate ? (
                  format(item.deliveryDate.toDate(), "dd/MM/yy", { locale: ptBR })
                ) : (
                  <span className="text-muted-foreground">Padrão da Lista</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={item.deliveryDate?.toDate()}
                onSelect={(date) => {
                  onUpdate(
                    item.supplyId,
                    'deliveryDate',
                    date ? Timestamp.fromDate(date) : undefined
                  );
                  onCalendarOpenChange(null);
                }}
                defaultMonth={selectedDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Notes textarea */}
      <div>
        <label
          htmlFor={`notes-${item.supplyId}`}
          className="text-xs text-muted-foreground block mb-0.5"
        >
          Observações
        </label>
        <Textarea
          id={`notes-${item.supplyId}`}
          value={item.notes || ''}
          onFocus={() => onFocus?.(item.supplyId)}
          onChange={(e) => onUpdate(item.supplyId, 'notes', e.target.value)}
          placeholder="Detalhes para este item..."
          rows={1}
          className="min-h-[40px]"
          disabled={isLocked || isReadOnly}
        />
      </div>
    </div>
  );
}
