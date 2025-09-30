'use server';

import { adminDb } from '@/lib/config/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { createNotification } from './notificationService';

/**
 * Creates sample notifications for testing the notification system
 * Call this function after applying Firestore rules to test the system
 */
export async function createSampleNotifications(userId: string) {
  try {
    console.log('🧪 Creating sample notifications for user:', userId);
    
    const notifications = [
      {
        userId,
        type: 'system_message' as const,
        title: 'Bem-vindo ao Sistema de Notificações!',
        message: 'O sistema de notificações está funcionando corretamente. Você receberá atualizações sobre aprovações, cotações e ofertas.',
        priority: 'medium' as const,
        actionUrl: '/cotacao'
      },
      {
        userId,
        type: 'quotation_started' as const,
        title: 'Sistema de Notificações Ativo',
        message: 'As notificações agora são registradas automaticamente quando você inicia cotações, aprova marcas ou recebe ofertas.',
        quotationName: 'Sistema de Demonstração',
        priority: 'low' as const,
        actionUrl: '/cotacao'
      },
      {
        userId,
        type: 'system_message' as const,
        title: 'Funcionalidades Disponíveis',
        message: 'Agora você pode filtrar notificações por cotação, tipo e status. Clique aqui para explorar o histórico completo.',
        priority: 'low' as const,
        actionUrl: '/cotacao'
      }
    ];

    const results = [];
    for (const notification of notifications) {
      const result = await createNotification(notification);
      results.push(result);
      // Small delay between notifications
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('✅ Sample notifications created successfully');
    return { success: true, created: results.length };
    
  } catch (error: any) {
    console.error('❌ Error creating sample notifications:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Creates a welcome notification for new features
 */
export async function createWelcomeNotification(userId: string) {
  try {
    return await createNotification({
      userId,
      type: 'system_message',
      title: '🎉 Sistema de Notificações Ativado!',
      message: 'Agora você tem acesso a um histórico completo de notificações com filtros dinâmicos. Todas as ações importantes serão registradas automaticamente.',
      priority: 'high',
      actionUrl: '/cotacao'
    });
  } catch (error: any) {
    console.error('❌ Error creating welcome notification:', error);
    return { success: false, error: error.message };
  }
}