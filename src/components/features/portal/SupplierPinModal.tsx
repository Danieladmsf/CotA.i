'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KeyRound, Loader2 } from 'lucide-react';

interface SupplierPinModalProps {
  isOpen: boolean;
  supplierName: string;
  onVerify: (pin: string) => Promise<boolean>;
  onClose?: () => void;
}

export default function SupplierPinModal({ isOpen, supplierName, onVerify, onClose }: SupplierPinModalProps) {
  const [pin, setPin] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (pin.length < 4 || pin.length > 6) {
      setError('A senha deve ter entre 4 e 6 dígitos');
      return;
    }

    setIsVerifying(true);
    setError('');

    try {
      const isValid = await onVerify(pin);

      if (!isValid) {
        setError('Senha incorreta. Tente novamente.');
        setPin('');
      }
      // If valid, the parent component will handle closing the modal
    } catch (err) {
      setError('Erro ao verificar a senha. Tente novamente.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handlePinChange = (value: string) => {
    // Only allow numbers
    const numbersOnly = value.replace(/\D/g, '');
    if (numbersOnly.length <= 6) {
      setPin(numbersOnly);
      setError('');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto bg-orange-100 p-3 rounded-full w-fit mb-2">
            <KeyRound className="h-8 w-8 text-orange-600" />
          </div>
          <DialogTitle className="text-center text-xl">Bem-vindo(a)!</DialogTitle>
          <DialogDescription className="text-center">
            {supplierName}
            <br />
            <span className="text-sm mt-2 block">Digite sua senha de acesso para continuar</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pin">Senha de Acesso</Label>
            <Input
              id="pin"
              type="password"
              inputMode="numeric"
              placeholder="Digite 4-6 números"
              value={pin}
              onChange={(e) => handlePinChange(e.target.value)}
              maxLength={6}
              className="text-center text-2xl tracking-widest"
              autoFocus
              disabled={isVerifying}
            />
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="submit"
              className="w-full bg-orange-600 hover:bg-orange-700"
              disabled={isVerifying || pin.length < 4}
            >
              {isVerifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verificando...
                </>
              ) : (
                'Acessar Portal'
              )}
            </Button>
          </DialogFooter>
        </form>

        <p className="text-xs text-center text-muted-foreground mt-4">
          Esqueceu sua senha? Entre em contato com o administrador
        </p>
      </DialogContent>
    </Dialog>
  );
}
