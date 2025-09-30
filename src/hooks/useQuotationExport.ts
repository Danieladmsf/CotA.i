import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { Quotation, Fornecedor } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SupplierOrder {
  supplierId: string;
  supplierName: string;
  supplierFotoUrl?: string;
  supplierInitials: string;
  items: {
    productId: string;
    productName: string;
    quantity: number;
    unit: string;
    brand: string;
    pricePerUnit: number;
    totalPrice: number;
  }[];
  totalValue: number;
}

interface UseQuotationExportProps {
  quotation: Pick<Quotation, 'id' | 'deadline' | 'status'>;
  supplierOrders: SupplierOrder[];
  selectedSuppliers: Set<string>;
}

export function useQuotationExport({
  quotation,
  supplierOrders,
  selectedSuppliers,
}: UseQuotationExportProps) {
  const { toast } = useToast();
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  const exportToPDF = async () => {
    setIsExportingPDF(true);

    try {
      // Filtrar apenas fornecedores selecionados
      const ordersToExport = supplierOrders.filter(order =>
        selectedSuppliers.has(order.supplierId)
      );

      if (ordersToExport.length === 0) {
        toast({
          title: "Nenhum fornecedor selecionado",
          description: "Selecione pelo menos um fornecedor para exportar.",
          variant: "destructive",
        });
        return;
      }

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      let yPos = 20;

      // Título principal
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Pedido de Compra', pageWidth / 2, yPos, { align: 'center' });

      yPos += 10;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Cotação: ${quotation.id}`, pageWidth / 2, yPos, { align: 'center' });

      yPos += 7;
      const deadlineDate = quotation.deadline?.toDate ? quotation.deadline.toDate() : new Date();
      doc.text(`Data: ${format(deadlineDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`, pageWidth / 2, yPos, { align: 'center' });

      yPos += 15;

      // Para cada fornecedor
      ordersToExport.forEach((order, index) => {
        if (index > 0) {
          doc.addPage();
          yPos = 20;
        }

        // Nome do fornecedor
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(`Fornecedor: ${order.supplierName}`, 14, yPos);
        yPos += 10;

        // Tabela de produtos
        const tableData = order.items.map(item => [
          item.productName,
          item.brand,
          `${item.quantity} ${item.unit}`,
          `R$ ${item.pricePerUnit.toFixed(2)}`,
          `R$ ${item.totalPrice.toFixed(2)}`,
        ]);

        autoTable(doc, {
          startY: yPos,
          head: [['Produto', 'Marca', 'Quantidade', 'Preço Unit.', 'Total']],
          body: tableData,
          foot: [['', '', '', 'Total Geral:', `R$ ${order.totalValue.toFixed(2)}`]],
          theme: 'grid',
          headStyles: { fillColor: [59, 130, 246] },
          footStyles: { fillColor: [229, 231, 235], textColor: [0, 0, 0], fontStyle: 'bold' },
        });
      });

      // Salvar PDF
      const fileName = `pedido_compra_${quotation.id}_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`;
      doc.save(fileName);

      toast({
        title: "PDF exportado com sucesso!",
        description: `${ordersToExport.length} pedido(s) exportado(s).`,
      });

      console.log('📄 [PDF Export] PDF gerado:', fileName);
    } catch (error) {
      console.error('❌ [PDF Export] Erro:', error);
      toast({
        title: "Erro ao exportar PDF",
        description: "Não foi possível gerar o arquivo PDF. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsExportingPDF(false);
    }
  };

  const exportToExcel = async () => {
    setIsExportingExcel(true);

    try {
      // Filtrar apenas fornecedores selecionados
      const ordersToExport = supplierOrders.filter(order =>
        selectedSuppliers.has(order.supplierId)
      );

      if (ordersToExport.length === 0) {
        toast({
          title: "Nenhum fornecedor selecionado",
          description: "Selecione pelo menos um fornecedor para exportar.",
          variant: "destructive",
        });
        return;
      }

      const workbook = XLSX.utils.book_new();

      // Planilha 1 - Resumo
      const deadlineDate = quotation.deadline?.toDate ? quotation.deadline.toDate() : new Date();
      const totalGeral = ordersToExport.reduce((sum, order) => sum + order.totalValue, 0);

      const resumoData = [
        ['RESUMO DA COTAÇÃO'],
        [''],
        ['ID da Cotação:', quotation.id],
        ['Data:', format(deadlineDate, "dd/MM/yyyy", { locale: ptBR })],
        ['Status:', quotation.status],
        [''],
        ['Total de Fornecedores:', ordersToExport.length],
        ['Total Geral:', `R$ ${totalGeral.toFixed(2)}`],
      ];

      const resumoSheet = XLSX.utils.aoa_to_sheet(resumoData);
      XLSX.utils.book_append_sheet(workbook, resumoSheet, 'Resumo');

      // Planilha por fornecedor
      ordersToExport.forEach((order, index) => {
        const sheetData = [
          [`PEDIDO - ${order.supplierName}`],
          [''],
          ['Produto', 'Marca', 'Quantidade', 'Unidade', 'Preço Unitário', 'Total'],
        ];

        order.items.forEach(item => {
          sheetData.push([
            item.productName,
            item.brand,
            item.quantity,
            item.unit,
            item.pricePerUnit,
            item.totalPrice,
          ]);
        });

        sheetData.push(['', '', '', '', 'TOTAL:', order.totalValue]);

        const sheet = XLSX.utils.aoa_to_sheet(sheetData);

        // Formatação de colunas
        sheet['!cols'] = [
          { wch: 30 }, // Produto
          { wch: 20 }, // Marca
          { wch: 12 }, // Quantidade
          { wch: 15 }, // Unidade
          { wch: 15 }, // Preço Unit.
          { wch: 15 }, // Total
        ];

        const sheetName = order.supplierName.substring(0, 31); // Excel limita a 31 caracteres
        XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
      });

      // Salvar arquivo
      const fileName = `pedido_compra_${quotation.id}_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      toast({
        title: "Excel exportado com sucesso!",
        description: `${ordersToExport.length} pedido(s) exportado(s).`,
      });

      console.log('📊 [Excel Export] Excel gerado:', fileName);
    } catch (error) {
      console.error('❌ [Excel Export] Erro:', error);
      toast({
        title: "Erro ao exportar Excel",
        description: "Não foi possível gerar o arquivo Excel. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsExportingExcel(false);
    }
  };

  return {
    exportToPDF,
    exportToExcel,
    isExportingPDF,
    isExportingExcel,
  };
}
