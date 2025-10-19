"use client";

/**
 * SupplySelector Component
 *
 * Card da esquerda - Seletor de insumos.
 * Permite buscar e filtrar insumos por categoria para adicionar à lista.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CheckCircle, PlusCircle, Loader2 } from 'lucide-react';
import type { Supply, SupplyCategory } from '@/types';

interface SupplySelectorProps {
  supplies: Supply[];
  categories: SupplyCategory[];
  selectedDate: Date | undefined;
  isLoading?: boolean;
  isReadOnly?: boolean;
  currentListItemIds: string[]; // IDs dos insumos já adicionados
  activeTab: string;
  searchTerm: string;
  onTabChange: (tab: string) => void;
  onSearchChange: (term: string) => void;
  onSupplyAdd: (supply: Supply) => void;
  searchInputRef?: React.RefObject<HTMLInputElement>;
}

export default function SupplySelector({
  supplies,
  categories,
  selectedDate,
  isLoading = false,
  isReadOnly = false,
  currentListItemIds,
  activeTab,
  searchTerm,
  onTabChange,
  onSearchChange,
  onSupplyAdd,
  searchInputRef,
}: SupplySelectorProps) {
  return (
    <Card className="shadow-lg rounded-xl">
      <CardHeader className="border-b p-4">
        <CardTitle className="text-xl">Selecionar Insumos</CardTitle>
        <div className="mt-2">
          <Input
            ref={searchInputRef}
            placeholder="Buscar insumo por nome ou marca..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            disabled={(isLoading && supplies.length === 0) || !selectedDate || isReadOnly}
          />
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
          {/* Category tabs */}
          <div className="border-b overflow-x-auto">
            <TabsList className="h-auto rounded-none p-2 bg-muted/50 justify-start">
              <TabsTrigger value="all" disabled={!selectedDate || isReadOnly}>
                Todos
              </TabsTrigger>
              {categories.map(cat => (
                <TabsTrigger
                  key={cat.id}
                  value={cat.id}
                  disabled={!selectedDate || isReadOnly}
                >
                  {cat.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* Supplies list */}
          <TabsContent
            value={activeTab}
            className="mt-0 p-4 max-h-[calc(100vh-380px)] min-h-[300px] overflow-y-auto"
          >
            {!selectedDate ? (
              <p className="text-muted-foreground text-center py-8">
                Selecione uma data para começar.
              </p>
            ) : isLoading && supplies.length === 0 ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : supplies.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Nenhum insumo encontrado.
              </p>
            ) : (
              <ul className="space-y-2">
                {supplies.map(supply => {
                  const isAdded = currentListItemIds.includes(supply.id);

                  return (
                    <li
                      key={supply.id}
                      className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${
                        isAdded ? 'bg-green-100 border-green-200' : 'hover:bg-muted/50'
                      }`}
                    >
                      <div>
                        <p className="font-medium">
                          {supply.name}{' '}
                          <span className="text-xs text-muted-foreground">
                            ({supply.unit})
                          </span>
                        </p>
                        {supply.preferredBrands && (
                          <p className="text-xs text-blue-600">
                            Marcas: {supply.preferredBrands}
                          </p>
                        )}
                      </div>

                      <Button
                        size="sm"
                        variant={isAdded ? "secondary" : "outline"}
                        onClick={() => onSupplyAdd(supply)}
                        disabled={isAdded || isReadOnly}
                      >
                        {isAdded ? (
                          <>
                            <CheckCircle className="h-4 w-4 mr-1.5" /> Adicionado
                          </>
                        ) : (
                          <>
                            <PlusCircle className="h-4 w-4 mr-1.5" /> Adicionar
                          </>
                        )}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
