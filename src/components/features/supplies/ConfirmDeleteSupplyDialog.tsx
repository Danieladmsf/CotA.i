
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface ConfirmDeleteSupplyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  supplyName: string;
}

export default function ConfirmDeleteSupplyDialog({ isOpen, onClose, onConfirm, supplyName }: ConfirmDeleteSupplyDialogProps) {
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };
  return (
    <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="bg-card border-border shadow-xl rounded-xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-2xl font-bold tracking-tight text-foreground">Confirmar Exclusão de Insumo</AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground pt-2">
            Tem certeza que deseja remover o insumo &quot;{supplyName}&quot;? Esta ação não poderá ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="pt-4">
          <AlertDialogCancel asChild>
            <Button variant="outline" onClick={onClose} className="rounded-full px-6 py-3 text-base border-border hover:bg-muted/80">Cancelar</Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button variant="destructive" onClick={onConfirm} className="rounded-full px-6 py-3 text-base bg-destructive hover:bg-destructive/90 text-destructive-foreground">Remover Insumo</Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
