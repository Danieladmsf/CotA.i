'use client';

import { Volume2, VolumeX } from 'lucide-react';
import { useVoiceAssistant } from '@/hooks/useVoiceAssistant';
import { Button } from '@/components/ui/button';
import NotificationSystem from './NotificationSystem';

interface HeaderProps {
  title: string;
  description: string;
  showNotifications?: boolean;
  notificationContext?: 'buyer' | 'supplier';
  supplierId?: string;
}

export default function Header({ title, description, showNotifications = true, notificationContext = 'buyer', supplierId }: HeaderProps) {
  const { isEnabled, toggle, isSupported } = useVoiceAssistant();

  return (
    <header className="flex items-center justify-between p-4 bg-background border-b">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {showNotifications && (
        <div className="flex items-center gap-4">
          {isSupported && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              title={isEnabled ? "Desativar assistente de voz" : "Ativar assistente de voz"}
            >
              {isEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            </Button>
          )}
          <NotificationSystem context={notificationContext} supplierId={supplierId} />
        </div>
      )}
    </header>
  );
}
