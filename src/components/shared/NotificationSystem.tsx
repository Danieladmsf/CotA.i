'use client';

import React from 'react';
import NotificationBell from './NotificationBell';

interface NotificationErrorFallbackProps {
  error: Error;
  resetError: () => void;
}

function NotificationErrorFallback({ error, resetError }: NotificationErrorFallbackProps) {
  console.error('Notification system error:', error);
  
  // Return a simple bell icon without notifications functionality
  return (
    <div className="relative">
      <button 
        className="p-2 hover:bg-orange-50 rounded-full transition-colors"
        onClick={resetError}
        title="Sistema de notificações indisponível - clique para tentar novamente"
      >
        <svg 
          className="h-5 w-5 text-gray-600" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M15 17h5l-5 5v-5zm0-16a6 6 0 11-12 0 6 6 0 0112 0z" 
          />
        </svg>
      </button>
    </div>
  );
}

// Error Boundary Component using class component as required by React
class NotificationErrorBoundary extends React.Component<
  { 
    children: React.ReactNode; 
    fallback: React.ComponentType<NotificationErrorFallbackProps>;
  },
  { 
    hasError: boolean; 
    error: Error | null;
  }
> {
  constructor(props: { 
    children: React.ReactNode; 
    fallback: React.ComponentType<NotificationErrorFallbackProps>;
  }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Notification system error boundary caught:', error, errorInfo);
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const FallbackComponent = this.props.fallback;
      return <FallbackComponent error={this.state.error} resetError={this.resetError} />;
    }

    return this.props.children;
  }
}

/**
 * Wrapper component that provides error handling for the notification system
 * Falls back gracefully when notifications system encounters errors
 */
export default function NotificationSystem() {
  return (
    <NotificationErrorBoundary fallback={NotificationErrorFallback}>
      <NotificationBell />
    </NotificationErrorBoundary>
  );
}