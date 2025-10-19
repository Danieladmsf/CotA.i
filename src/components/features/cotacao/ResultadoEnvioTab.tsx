"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useQuotationExport } from "@/hooks/useQuotationExport";
import { useSupplierNotification } from "@/hooks/useSupplierNotification";
import Image from "next/image";
import {
  Send,
  FileText,
  Download,
  CheckCircle2,
  Package,
  Building2,
  TrendingDown,
} from "lucide-react";
import type { Quotation, ShoppingListItem, Offer, Fornecedor, UnitOfMeasure } from '@/types';

interface SupplierOrder {
  supplierId: string;
  supplierName: string;
  supplierFotoUrl?: string;
  supplierInitials: string;
  items: {
    productId: string;
    productName: string;
    quantity: number;
    unit: UnitOfMeasure;
    brand: string;
    pricePerUnit: number;
    totalPrice: number;
  }[];
  totalValue: number;
}

interface ResultadoEnvioTabProps {
  quotation: Pick<Quotation, 'id' | 'status' | 'deadline'>;
  products: ShoppingListItem[];
  offers: Map<string, Offer[]>; // productId -> offers
  suppliers: Map<string, Fornecedor>; // supplierId -> supplier
}

const formatCurrency = (value: number): string => {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const isValidImageUrl = (url?: string): url is string => {
  return !!url && (url.startsWith('http') || url.startsWith('data:'));
};

export default function ResultadoEnvioTab({
  quotation,
  products,
  offers,
  suppliers,
}: ResultadoEnvioTabProps) {
  const { toast } = useToast();
  const [selectedSuppliers, setSelectedSuppliers] = useState<Set<string>>(new Set());

  // Agrupar produtos por fornecedor (melhor oferta)
  const supplierOrders = useMemo((): SupplierOrder[] => {
    console.log('📦 [ResultadoEnvioTab] Processando dados:', {
      totalProducts: products.length,
      totalOffers: offers.size,
      quotationStatus: quotation.status,
      productsIds: products.map(p => p.id),
      offersKeys: Array.from(offers.keys()),
    });

    const ordersBySupplier = new Map<string, SupplierOrder>();

    products.forEach(product => {
      const productOffers = offers.get(product.id) || [];
      console.log(`📦 [ResultadoEnvioTab] Produto ${product.name}:`, {
        productId: product.id,
        totalOffers: productOffers.length,
        validOffers: productOffers.filter(o => o.pricePerUnit > 0).length,
      });
      const validOffers = productOffers.filter(o => o.pricePerUnit > 0);

      if (validOffers.length === 0) return;

      // Encontrar melhor oferta
      const bestOffer = validOffers.reduce((best, current) =>
        current.pricePerUnit < best.pricePerUnit ? current : best
      );

      const supplier = suppliers.get(bestOffer.supplierId);
      if (!supplier) return;

      // Criar ou atualizar pedido do fornecedor
      if (!ordersBySupplier.has(bestOffer.supplierId)) {
        ordersBySupplier.set(bestOffer.supplierId, {
          supplierId: bestOffer.supplierId,
          supplierName: supplier.empresa || 'Fornecedor',
          supplierFotoUrl: supplier.fotoUrl,
          supplierInitials: supplier.empresa?.substring(0, 2).toUpperCase() || 'FN',
          items: [],
          totalValue: 0,
        });
      }

      const order = ordersBySupplier.get(bestOffer.supplierId)!;
      const itemTotal = bestOffer.pricePerUnit * product.quantity;

      order.items.push({
        productId: product.id,
        productName: product.name,
        quantity: product.quantity,
        unit: product.unit,
        brand: bestOffer.brandOffered || 'Sem marca',
        pricePerUnit: bestOffer.pricePerUnit,
        totalPrice: itemTotal,
      });

      order.totalValue += itemTotal;
    });

    const result = Array.from(ordersBySupplier.values()).sort((a, b) =>
      b.totalValue - a.totalValue
    );

    console.log('📦 [ResultadoEnvioTab] Resultado final:', {
      totalSuppliers: result.length,
      suppliers: result.map(s => ({ name: s.supplierName, items: s.items.length, total: s.totalValue })),
    });

    return result;
  }, [products, offers, suppliers]);

  // Hooks para exportação e envio
  const { exportToPDF, exportToExcel, isExportingPDF, isExportingExcel } = useQuotationExport({
    quotation,
    supplierOrders,
    selectedSuppliers,
  });

  const { sendToSuppliers, sendViaWhatsApp, sendViaEmail, isSending } = useSupplierNotification({
    quotation,
    supplierOrders,
    suppliers,
  });

  // Cálculos do resumo
  const summary = useMemo(() => {
    const totalProducts = products.length;
    const totalSuppliers = supplierOrders.length;
    const totalValue = supplierOrders.reduce((sum, order) => sum + order.totalValue, 0);

    // Calcular economia (comparando com preço médio)
    let originalValue = 0;
    products.forEach(product => {
      const productOffers = offers.get(product.id) || [];
      const validPrices = productOffers
        .filter(o => o.pricePerUnit > 0)
        .map(o => o.pricePerUnit);

      if (validPrices.length > 0) {
        const avgPrice = validPrices.reduce((a, b) => a + b, 0) / validPrices.length;
        originalValue += avgPrice * product.quantity;
      }
    });

    const savings = originalValue - totalValue;
    const savingsPercentage = originalValue > 0 ? (savings / originalValue) * 100 : 0;

    return {
      totalProducts,
      totalSuppliers,
      totalValue,
      originalValue,
      savings,
      savingsPercentage,
    };
  }, [products, offers, supplierOrders]);

  const toggleSupplier = (supplierId: string) => {
    setSelectedSuppliers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(supplierId)) {
        newSet.delete(supplierId);
      } else {
        newSet.add(supplierId);
      }
      return newSet;
    });
  };

  const selectAllSuppliers = () => {
    setSelectedSuppliers(new Set(supplierOrders.map(o => o.supplierId)));
  };

  const deselectAllSuppliers = () => {
    setSelectedSuppliers(new Set());
  };

  const handleSendToSuppliers = () => {
    console.log('🔘 [ResultadoEnvioTab] Botão "Enviar" clicado:', {
      selectedCount: selectedSuppliers.size,
      selectedIds: Array.from(selectedSuppliers),
    });
    sendToSuppliers(selectedSuppliers);
  };

  const handleExportPDF = () => {
    console.log('🔘 [ResultadoEnvioTab] Botão "Exportar PDF" clicado:', {
      selectedCount: selectedSuppliers.size,
      selectedIds: Array.from(selectedSuppliers),
    });
    exportToPDF();
  };

  const handleExportExcel = () => {
    console.log('🔘 [ResultadoEnvioTab] Botão "Exportar Excel" clicado:', {
      selectedCount: selectedSuppliers.size,
      selectedIds: Array.from(selectedSuppliers),
    });
    exportToExcel();
  };

  if (quotation.status !== 'Fechada') {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Cotação ainda não finalizada</h3>
          <p className="text-muted-foreground mb-4">
            Esta aba ficará disponível após a cotação ser fechada.
          </p>
          <Badge variant="secondary">{quotation.status}</Badge>
        </CardContent>
      </Card>
    );
  }

  if (supplierOrders.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Nenhuma oferta disponível</h3>
          <p className="text-muted-foreground">
            Não há ofertas válidas para gerar pedidos.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumo da Cotação */}
      <Card className="card-professional">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Resumo da Cotação Finalizada
          </CardTitle>
          <CardDescription>
            Resultado final com melhores ofertas selecionadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-primary/5 rounded-lg">
              <p className="text-sm text-muted-foreground">Total de Produtos</p>
              <p className="text-3xl font-bold text-primary">{summary.totalProducts}</p>
            </div>
            <div className="text-center p-4 bg-blue-500/5 rounded-lg">
              <p className="text-sm text-muted-foreground">Fornecedores</p>
              <p className="text-3xl font-bold text-blue-600">{summary.totalSuppliers}</p>
            </div>
            <div className="text-center p-4 bg-green-500/5 rounded-lg">
              <p className="text-sm text-muted-foreground">Valor Total</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalValue)}</p>
            </div>
            <div className="text-center p-4 bg-orange-500/5 rounded-lg">
              <TrendingDown className="h-5 w-5 mx-auto mb-1 text-orange-600" />
              <p className="text-sm text-muted-foreground">Economia</p>
              <p className="text-xl font-bold text-orange-600">
                {formatCurrency(summary.savings)}
                <span className="text-sm ml-1">({summary.savingsPercentage.toFixed(1)}%)</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Compras por Fornecedor */}
      <Card className="card-professional">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Lista de Compras por Fornecedor</CardTitle>
              <CardDescription>
                Selecione os fornecedores para enviar os pedidos
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAllSuppliers}>
                Selecionar Todos
              </Button>
              <Button variant="outline" size="sm" onClick={deselectAllSuppliers}>
                Limpar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Marca</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead className="text-right">Preço Unit.</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supplierOrders.map((order) => (
                  <React.Fragment key={order.supplierId}>
                    {order.items.map((item, idx) => (
                      <TableRow key={`${order.supplierId}-${item.productId}`}>
                        {idx === 0 && (
                          <>
                            <TableCell rowSpan={order.items.length} className="align-top pt-4">
                              <Checkbox
                                checked={selectedSuppliers.has(order.supplierId)}
                                onCheckedChange={() => toggleSupplier(order.supplierId)}
                              />
                            </TableCell>
                            <TableCell rowSpan={order.items.length} className="align-top pt-4">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10">
                                  {isValidImageUrl(order.supplierFotoUrl) ? (
                                    <Image
                                      src={order.supplierFotoUrl}
                                      alt={order.supplierName}
                                      width={40}
                                      height={40}
                                    />
                                  ) : null}
                                  <AvatarFallback>{order.supplierInitials}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-semibold">{order.supplierName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {order.items.length} produto(s)
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                          </>
                        )}
                        <TableCell>{item.productName}</TableCell>
                        <TableCell>{item.brand}</TableCell>
                        <TableCell className="text-right">
                          {item.quantity} {item.unit}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.pricePerUnit)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(item.totalPrice)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/30 font-semibold">
                      <TableCell colSpan={6} className="text-right">
                        Total {order.supplierName}:
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(order.totalValue)}
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>

        {/* Rodapé com ações */}
        <div className="border-t bg-muted/30 p-4">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button
              onClick={handleSendToSuppliers}
              disabled={selectedSuppliers.size === 0 || isSending}
              size="lg"
            >
              {isSending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar para Selecionados ({selectedSuppliers.size})
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={handleExportPDF}
              disabled={selectedSuppliers.size === 0 || isExportingPDF}
            >
              {isExportingPDF ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                  Exportando...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Exportar PDF
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={handleExportExcel}
              disabled={selectedSuppliers.size === 0 || isExportingExcel}
            >
              {isExportingExcel ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                  Exportando...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Exportar Excel
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
