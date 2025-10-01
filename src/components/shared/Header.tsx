'use client';

import NotificationSystem from './NotificationSystem';

interface HeaderProps {
  title: string;
  description: string;
  showNotifications?: boolean;
}

export default function Header({ title, description, showNotifications = true }: HeaderProps) {
  return (
    <header className="flex items-center justify-between p-4 bg-background border-b">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {showNotifications && (
        <div className="flex items-center gap-4">
          <NotificationSystem />
        </div>
      )}
    </header>
  );
}
