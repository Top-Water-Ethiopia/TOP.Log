/**
 * Enterprise metrics and monitoring system
 * Implements Google SRE-style metrics collection
 */

interface MetricTags {
  [key: string]: string | number
}

interface Metric {
  name: string
  value: number
  timestamp: number
  tags: MetricTags
  type: "counter" | "gauge" | "histogram" | "timer"
}

interface TimerHandle {
  stop: () => number
}

class MetricsCollector {
  private metrics: Metric[] = []
  private counters: Map<string, number> = new Map()
  private gauges: Map<string, number> = new Map()
  private flushInterval: number = 60000 // 1 minute
  private maxMetrics: number = 10000

  constructor() {
    if (typeof window !== "undefined") {
      this.setupAutoFlush()
    }
  }

  private setupAutoFlush(): void {
    setInterval(() => {
      this.flush()
    }, this.flushInterval)
  }

  /**
   * Increment a counter metric
   */
  increment(name: string, value: number = 1, tags: MetricTags = {}): void {
    const key = this.getMetricKey(name, tags)
    const current = this.counters.get(key) || 0
    this.counters.set(key, current + value)

    this.recordMetric({
      name,
      value: current + value,
      timestamp: Date.now(),
      tags,
      type: "counter",
    })
  }

  /**
   * Set a gauge metric (current value)
   */
  gauge(name: string, value: number, tags: MetricTags = {}): void {
    const key = this.getMetricKey(name, tags)
    this.gauges.set(key, value)

    this.recordMetric({
      name,
      value,
      timestamp: Date.now(),
      tags,
      type: "gauge",
    })
  }

  /**
   * Record a histogram value (distribution)
   */
  histogram(name: string, value: number, tags: MetricTags = {}): void {
    this.recordMetric({
      name,
      value,
      timestamp: Date.now(),
      tags,
      type: "histogram",
    })
  }

  /**
   * Start a timer and return a handle to stop it
   */
  startTimer(name: string, tags: MetricTags = {}): TimerHandle {
    const startTime = performance.now()

    return {
      stop: () => {
        const duration = performance.now() - startTime
        this.histogram(name, duration, tags)
        return duration
      },
    }
  }

  /**
   * Time an async operation
   */
  async timeAsync<T>(name: string, fn: () => Promise<T>, tags: MetricTags = {}): Promise<T> {
    const timer = this.startTimer(name, tags)
    try {
      const result = await fn()
      timer.stop()
      return result
    } catch (error) {
      timer.stop()
      this.increment(`${name}.error`, 1, tags)
      throw error
    }
  }

  /**
   * Time a synchronous operation
   */
  time<T>(name: string, fn: () => T, tags: MetricTags = {}): T {
    const timer = this.startTimer(name, tags)
    try {
      const result = fn()
      timer.stop()
      return result
    } catch (error) {
      timer.stop()
      this.increment(`${name}.error`, 1, tags)
      throw error
    }
  }

  private getMetricKey(name: string, tags: MetricTags): string {
    const tagString = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join(",")
    return `${name}{${tagString}}`
  }

  private recordMetric(metric: Metric): void {
    this.metrics.push(metric)

    // Prevent memory leaks by limiting stored metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics / 2)
    }
  }

  /**
   * Get all recorded metrics
   */
  getMetrics(): Metric[] {
    return [...this.metrics]
  }

  /**
   * Get metrics summary
   */
  getSummary(): {
    totalMetrics: number
    counters: number
    gauges: number
    histograms: number
    timers: number
  } {
    const counters = this.metrics.filter((m) => m.type === "counter").length
    const gauges = this.metrics.filter((m) => m.type === "gauge").length
    const histograms = this.metrics.filter((m) => m.type === "histogram").length
    const timers = this.metrics.filter((m) => m.type === "timer").length

    return {
      totalMetrics: this.metrics.length,
      counters,
      gauges,
      histograms,
      timers,
    }
  }

  /**
   * Flush metrics to monitoring service
   */
  flush(): void {
    if (this.metrics.length === 0) return

    // In production, send to monitoring service:
    // - Google Cloud Monitoring
    // - Prometheus
    // - DataDog
    // - New Relic

    console.debug(`[METRICS] Flushing ${this.metrics.length} metrics`, this.getSummary())

    // Clear old metrics after flush
    this.metrics = []
  }

  /**
   * Record common application metrics
   */
  recordOperation(operation: string, success: boolean, duration: number, tags: MetricTags = {}): void {
    const status = success ? "success" : "failure"

    this.increment(`operation.${operation}.${status}`, 1, tags)
    this.histogram(`operation.${operation}.duration`, duration, { ...tags, status })
  }

  /**
   * Record API call metrics
   */
  recordApiCall(endpoint: string, method: string, statusCode: number, duration: number): void {
    this.increment("api.calls", 1, { endpoint, method, status: statusCode.toString() })
    this.histogram("api.latency", duration, { endpoint, method })

    if (statusCode >= 400) {
      this.increment("api.errors", 1, { endpoint, method, status: statusCode.toString() })
    }
  }

  /**
   * Record data operation metrics
   */
  recordDataOperation(operation: "create" | "read" | "update" | "delete", entity: string, duration: number): void {
    this.increment(`data.${operation}`, 1, { entity })
    this.histogram(`data.${operation}.duration`, duration, { entity })
  }
}

// Singleton instance
export const metrics = new MetricsCollector()

// Export types and class
export { MetricsCollector, type Metric, type MetricTags, type TimerHandle }
