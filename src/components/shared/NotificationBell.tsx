'use client';

import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/config/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import type { PendingBrandRequest } from '@/types';

export default function NotificationBell() {
  const { user } = useAuth();
  const router = useRouter();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!user?.uid) return;

    const pendingRequestsQuery = query(
      collection(db, 'pending_brand_requests'),
      where('userId', '==', user.uid),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(pendingRequestsQuery, (snapshot) => {
      const count = snapshot.size;
      setPendingCount(count);
      console.log('🔔 Pending brand requests:', count);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const handleNotificationClick = () => {
    router.push('/cotacao?tab=aprovacoes');
  };

  if (pendingCount === 0) return null;

  return (
    <div className="relative">
      <Button 
        variant="ghost" 
        size="icon"
        onClick={handleNotificationClick}
        className="relative hover:bg-orange-50"
      >
        <Bell className="h-5 w-5" />
        {pendingCount > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs bg-orange-600 hover:bg-orange-700"
          >
            {pendingCount > 9 ? '9+' : pendingCount}
          </Badge>
        )}
      </Button>
    </div>
  );
}