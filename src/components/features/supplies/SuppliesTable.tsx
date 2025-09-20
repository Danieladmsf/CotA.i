
import type { Supply } from '@/types';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Edit, Trash2 as DeleteIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SuppliesTableProps {
  supplies: Supply[];
  onEdit: (supply: Supply) => void;
  onDelete: (supply: Supply) => void;
}

export default function SuppliesTable({ supplies, onEdit, onDelete }: SuppliesTableProps) {
  if (supplies.length === 0) {
    return <p className="text-center text-muted-foreground py-8">Nenhum insumo encontrado para esta categoria ou filtro.</p>;
  }

  return (
    <div className="rounded-md border overflow-hidden shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/60">
            <TableHead className="w-[250px] px-4 py-3 font-semibold">Nome do Insumo</TableHead>
            <TableHead className="px-4 py-3 font-semibold">Unidade</TableHead>
            <TableHead className="px-4 py-3 hidden md:table-cell font-semibold">Categoria</TableHead>
            <TableHead className="px-4 py-3 hidden lg:table-cell font-semibold">Marcas Preferidas</TableHead>
            <TableHead className="px-4 py-3 hidden xl:table-cell font-semibold">Estoque</TableHead>
            <TableHead className="text-right w-[120px] px-4 py-3 font-semibold">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {supplies.map((supply) => (
            <TableRow key={supply.id} className="hover:bg-muted/20 transition-colors duration-150">
              <TableCell className="font-medium px-4 py-3">{supply.name}</TableCell>
              <TableCell className="px-4 py-3">{supply.unit}</TableCell>
              <TableCell className="px-4 py-3 hidden md:table-cell">
                <Badge variant="secondary" className="font-normal">{supply.categoryName}</Badge>
              </TableCell>
              <TableCell className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground truncate max-w-xs">
                {supply.preferredBrands || "-"}
              </TableCell>
              <TableCell className="px-4 py-3 hidden xl:table-cell">{supply.quantityInStock ?? 0}</TableCell>
              <TableCell className="text-right px-4 py-3">
                <Button variant="ghost" size="icon" onClick={() => onEdit(supply)} className="text-primary hover:text-primary/80 mr-1">
                  <Edit className="h-4 w-4" />
                  <span className="sr-only">Editar</span>
                </Button>
                <Button variant="ghost" size="icon" onClick={() => onDelete(supply)} className="text-destructive hover:text-destructive/80">
                  <DeleteIcon className="h-4 w-4" />
                   <span className="sr-only">Excluir</span>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
