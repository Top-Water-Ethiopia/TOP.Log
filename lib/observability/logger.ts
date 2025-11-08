/**
 * Enterprise-grade structured logging system
 * Implements Google-style logging with levels, context, and observability
 */

type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL"

interface LogContext {
  [key: string]: unknown
  timestamp?: string
  level?: LogLevel
  message?: string
  error?: Error | unknown
  stack?: string
}

interface LoggerConfig {
  minLevel: LogLevel
  enableConsole: boolean
  enableRemote: boolean
  serviceName: string
  environment: string
}

const LOG_LEVELS: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  FATAL: 4,
}

class Logger {
  private config: LoggerConfig
  private sessionId: string

  constructor(config?: Partial<LoggerConfig>) {
    this.config = {
      minLevel: (process.env.NODE_ENV === "production" ? "INFO" : "DEBUG") as LogLevel,
      enableConsole: true,
      enableRemote: false,
      serviceName: "captain-log",
      environment: process.env.NODE_ENV || "development",
      ...config,
    }
    this.sessionId = this.generateSessionId()
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(7)}`
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.minLevel]
  }

  private formatLog(level: LogLevel, message: string, context?: LogContext): LogContext {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      sessionId: this.sessionId,
      service: this.config.serviceName,
      environment: this.config.environment,
      ...context,
    }
  }

  private writeLog(logEntry: LogContext): void {
    if (this.config.enableConsole) {
      const { level, message, ...rest } = logEntry
      const consoleMethod = level === "ERROR" || level === "FATAL" ? "error" : level === "WARN" ? "warn" : "log"

      console[consoleMethod](`[${level}] ${message}`, rest)
    }

    // Future: Send to remote logging service (DataDog, Sentry, etc.)
    if (this.config.enableRemote) {
      this.sendToRemote(logEntry)
    }
  }

  private sendToRemote(logEntry: LogContext): void {
    // Placeholder for remote logging integration
    // In production, this would send to services like:
    // - Google Cloud Logging
    // - DataDog
    // - Sentry
    // - AWS CloudWatch
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog("DEBUG")) {
      this.writeLog(this.formatLog("DEBUG", message, context))
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog("INFO")) {
      this.writeLog(this.formatLog("INFO", message, context))
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog("WARN")) {
      this.writeLog(this.formatLog("WARN", message, context))
    }
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (this.shouldLog("ERROR")) {
      const errorContext: LogContext = {
        ...context,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }
      this.writeLog(this.formatLog("ERROR", message, errorContext))
    }
  }

  fatal(message: string, error?: Error | unknown, context?: LogContext): void {
    if (this.shouldLog("FATAL")) {
      const errorContext: LogContext = {
        ...context,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }
      this.writeLog(this.formatLog("FATAL", message, errorContext))
    }
  }

  // Structured logging methods for specific use cases
  audit(operation: string, details: LogContext): void {
    this.info(`AUDIT: ${operation}`, { ...details, auditLog: true })
  }

  performance(operation: string, durationMs: number, context?: LogContext): void {
    this.info(`PERFORMANCE: ${operation}`, {
      ...context,
      durationMs,
      performanceMetric: true,
    })
  }

  security(message: string, context?: LogContext): void {
    this.warn(`SECURITY: ${message}`, { ...context, securityEvent: true })
  }
}

// Singleton instance
export const logger = new Logger()

// Export for testing or custom instances
export { Logger, type LogLevel, type LogContext, type LoggerConfig }
