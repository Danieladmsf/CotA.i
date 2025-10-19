// Performance monitoring utility for Firebase queries
export class FirebasePerformanceMonitor {
  private static instance: FirebasePerformanceMonitor;
  private metrics: Map<string, any[]> = new Map();

  static getInstance(): FirebasePerformanceMonitor {
    if (!this.instance) {
      this.instance = new FirebasePerformanceMonitor();
    }
    return this.instance;
  }

  startQuery(queryId: string, details: any) {
    const startTime = Date.now();
    return {
      queryId,
      startTime,
      details,
      finish: (result: any) => this.finishQuery(queryId, startTime, details, result)
    };
  }

  private finishQuery(queryId: string, startTime: number, details: any, result: any) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    const metric = {
      queryId,
      duration,
      startTime,
      endTime,
      details,
      result,
      performance: this.categorizePerformance(duration),
      timestamp: new Date().toISOString()
    };

    // Armazenar métrica
    if (!this.metrics.has(queryId)) {
      this.metrics.set(queryId, []);
    }
    this.metrics.get(queryId)!.push(metric);

    // Alertas para performance ruim
    if (duration > 10000) {
      console.error(`🚨 [Performance] Query MUITO LENTA: ${queryId} (${duration}ms)`);
    } else if (duration > 5000) {
      console.warn(`⚠️ [Performance] Query lenta: ${queryId} (${duration}ms)`);
    }

    return metric;
  }

  private categorizePerformance(duration: number): string {
    if (duration < 500) return 'excelente';
    if (duration < 1000) return 'boa';
    if (duration < 3000) return 'aceitável';
    if (duration < 10000) return 'lenta';
    return 'muito-lenta';
  }

  getMetrics(queryId?: string) {
    if (queryId) {
      return this.metrics.get(queryId) || [];
    }
    return Object.fromEntries(this.metrics);
  }

  getAverageTime(queryId: string): number {
    const queryMetrics = this.metrics.get(queryId) || [];
    if (queryMetrics.length === 0) return 0;
    
    const totalTime = queryMetrics.reduce((sum, metric) => sum + metric.duration, 0);
    return Math.round(totalTime / queryMetrics.length);
  }

  getWorstPerformance(queryId: string) {
    const queryMetrics = this.metrics.get(queryId) || [];
    return queryMetrics.reduce((worst, current) => 
      current.duration > (worst?.duration || 0) ? current : worst, null);
  }

  clearMetrics(queryId?: string) {
    if (queryId) {
      this.metrics.delete(queryId);
    } else {
      this.metrics.clear();
    }
  }

  // Método para exibir relatório de performance no console
  printPerformanceReport() {
    console.group('Firebase Performance Report');

    for (const [queryId, metrics] of this.metrics) {
      console.group(`Query: ${queryId}`);
      
      const worst = this.getWorstPerformance(queryId);
      if (worst) {
      }
      
      const performanceDistribution = metrics.reduce((acc, metric) => {
        acc[metric.performance] = (acc[metric.performance] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.groupEnd();
    }
    
    console.groupEnd();
  }
}

// Hook para usar o monitor de performance
export function usePerformanceMonitor() {
  return FirebasePerformanceMonitor.getInstance();
}