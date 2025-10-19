'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/config/firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  doc, 
  updateDoc, 
  addDoc,
  Timestamp,
  limit,
  startAfter,
  DocumentSnapshot
} from 'firebase/firestore';
import type { SystemNotification } from '@/types';

export interface NotificationFilters {
  targetSupplierId?: string; // For anonymous supplier portal access
  quotationId?: string;
  type?: string;
  isRead?: boolean;
  startDate?: Date;
  endDate?: Date;
}

export const useNotifications = (filters: NotificationFilters = {}, pageSize: number = 20) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);

  // Load notifications with filters
  useEffect(() => {
    const canQueryByUser = user?.uid;
    const canQueryBySupplier = filters.targetSupplierId;

    if (!canQueryByUser && !canQueryBySupplier) {
      setIsLoading(false);
      setNotifications([]);
      return;
    }

    try {
      let queryConstraints: any[] = [];

      // Determine the primary query filter
      if (canQueryBySupplier) {
        queryConstraints.push(where('targetSupplierId', '==', filters.targetSupplierId));
        queryConstraints.push(orderBy('createdAt', 'desc'));
      } else if (canQueryByUser) {
        queryConstraints.push(where('userId', '==', user.uid));
        queryConstraints.push(orderBy('createdAt', 'desc'));
      }

      // Apply additional filters
      if (filters.quotationId) {
        queryConstraints.push(where('quotationId', '==', filters.quotationId));
      }
      if (filters.type) {
        queryConstraints.push(where('type', '==', filters.type));
      }
      if (filters.isRead !== undefined) {
        queryConstraints.push(where('isRead', '==', filters.isRead));
      }

      // Add limit (no startAfter for real-time updates)
      queryConstraints.push(limit(pageSize));

      const notificationQuery = query(collection(db, 'notifications'), ...queryConstraints);

      const unsubscribe = onSnapshot(
        notificationQuery,
        (snapshot) => {
          const newNotifications = snapshot.docs.map(doc => {
            const data = doc.data();

            return {
              id: doc.id,
              ...data
            } as SystemNotification;
          });

          // Always replace the notifications for real-time updates
          setNotifications(newNotifications);

          setHasMore(snapshot.docs.length === pageSize);
          if (snapshot.docs.length > 0) {
            setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
          }
          setIsLoading(false);
        },
        (error) => {
          console.error('❌ [useNotifications] Error in snapshot:', error);
          // Handle specific error types
          if (error.code === 'permission-denied') {
            setNotifications([]);
            setUnreadCount(0);
            setIsLoading(false);
            return;
          }

          if (error.code === 'failed-precondition') {
            // Fallback to simpler query without complex filters
            if (user?.uid) { // Check if user exists before this query
              const simpleQuery = query(
                collection(db, 'notifications'),
                where('userId', '==', user.uid),
                orderBy('createdAt', 'desc'),
                limit(pageSize)
              );
              
              const fallbackUnsubscribe = onSnapshot(
                simpleQuery,
                (snapshot) => {
                  const allNotifications = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                  } as SystemNotification));
                  
                  // Apply filters client-side
                  let filteredNotifications = allNotifications;
                  if (filters.quotationId) {
                    filteredNotifications = filteredNotifications.filter(n => n.quotationId === filters.quotationId);
                  }
                  if (filters.type) {
                    filteredNotifications = filteredNotifications.filter(n => n.type === filters.type);
                  }
                  if (filters.isRead !== undefined) {
                    filteredNotifications = filteredNotifications.filter(n => n.isRead === filters.isRead);
                  }
                  
                  setNotifications(filteredNotifications);
                  setHasMore(false); // Disable pagination for fallback
                  setIsLoading(false);
                },
                (fallbackError) => {
                  setNotifications([]);
                  setIsLoading(false);
                }
              );
              
              return () => fallbackUnsubscribe();
            } else {
              // If no user, cannot perform fallback query
              setNotifications([]);
              setIsLoading(false);
            }
          }
          
          // For other errors, set empty state and stop retrying to prevent infinite loops
          setNotifications([]);
          setIsLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (error) {
      setNotifications([]);
      setIsLoading(false);
    }
  }, [
    user?.uid,
    filters.targetSupplierId,
    filters.quotationId,
    filters.type,
    filters.isRead,
    filters.startDate,
    filters.endDate,
    pageSize
  ]);

  // Count unread notifications separately (without pagination)
  useEffect(() => {
    if (!user?.uid) return;

    try {
      const unreadQuery = query(
        collection(db, 'notifications'),
        where('userId', '==', user.uid),
        where('isRead', '==', false)
      );

      const unsubscribe = onSnapshot(
        unreadQuery, 
        (snapshot) => {
          setUnreadCount(snapshot.size);
        },
        (error) => {
          if (error.code === 'permission-denied') {
            setUnreadCount(0);
            return;
          }

                if (error.code === 'failed-precondition') {
                  // Fallback: get all user notifications and count unread client-side
                  if (user?.uid) { // Check if user exists before this query
                      const fallbackQuery = query(
                        collection(db, 'notifications'),
                        where('userId', '==', user.uid),
                        orderBy('createdAt', 'desc'),
                        limit(100) // Limit to recent notifications for performance
                      );
                      
                      const fallbackUnsubscribe = onSnapshot(
                        fallbackQuery,
                        (snapshot) => {
                          const unreadCount = snapshot.docs.filter(doc => !doc.data().isRead).length;
                          setUnreadCount(unreadCount);
                        },
                        (fallbackError) => {
                          setUnreadCount(0);
                        }
                      );
                      
                      return () => fallbackUnsubscribe();
                  } else {
                      setUnreadCount(0); // If no user, no unread count
                  }
                }          
          setUnreadCount(0);
        }
      );

      return () => unsubscribe();
    } catch (error) {
      setUnreadCount(0);
    }
  }, [user?.uid]);

  const markAsRead = async (notificationId: string) => {
    try {
      // Optimistic update - update local state immediately for instant feedback
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId
            ? { ...n, isRead: true, readAt: Timestamp.now() }
            : n
        )
      );

      // Update in Firestore (onSnapshot will sync it back)
      await updateDoc(doc(db, 'notifications', notificationId), {
        isRead: true,
        readAt: Timestamp.now()
      });
    } catch (error) {
      // Silent error handling - onSnapshot will revert the optimistic update if it failed
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadNotifications = notifications.filter(n => !n.isRead);

      // Optimistic update - update local state immediately
      setNotifications(prev =>
        prev.map(n => ({ ...n, isRead: true, readAt: Timestamp.now() }))
      );

      // Update in Firestore
      const updatePromises = unreadNotifications.map(notification =>
        updateDoc(doc(db, 'notifications', notification.id), {
          isRead: true,
          readAt: Timestamp.now()
        })
      );
      await Promise.all(updatePromises);
    } catch (error) {
      // Silent error handling - onSnapshot will revert if it failed
    }
  };

  const loadMore = () => {
    if (hasMore && !isLoading) {
      // The useEffect will trigger with the updated lastDoc
      setIsLoading(true);
    }
  };

  const refresh = () => {
    setLastDoc(null);
    setNotifications([]);
    setIsLoading(true);
  };

  return {
    notifications,
    unreadCount,
    isLoading,
    hasMore,
    markAsRead,
    markAllAsRead,
    loadMore,
    refresh
  };
};

// Helper function to create notifications
export const createNotification = async (notification: Omit<SystemNotification, 'id' | 'createdAt'>) => {
  try {
    const docRef = await addDoc(collection(db, 'notifications'), {
      ...notification,
      createdAt: Timestamp.now()
    });
    return docRef.id;
  } catch (error) {
    throw error;
  }
};