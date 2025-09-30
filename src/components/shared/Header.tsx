'use client';

import NotificationSystem from './NotificationSystem';

interface HeaderProps {
  title: string;
  description: string;
}

export default function Header({ title, description }: HeaderProps) {
  return (
    <header className="flex items-center justify-between p-4 bg-background border-b">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-4">
        <NotificationSystem />
      </div>
    </header>
  );
}
