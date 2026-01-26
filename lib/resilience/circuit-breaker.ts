export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenMaxCalls: number;
}

export enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open',
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private halfOpenCalls: number = 0;

  constructor(private options: CircuitBreakerOptions) {}

  async execute<T>(fn: () => Promise<T> | T): Promise<T> {
    this.updateState();

    if (this.state === CircuitState.OPEN) {
      throw new Error('Circuit breaker is OPEN');
    }

    try {
      const result = await Promise.resolve(fn());
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private updateState(): void {
    const now = Date.now();

    if (this.state === CircuitState.OPEN) {
      if (now - this.lastFailureTime >= this.options.resetTimeoutMs) {
        this.state = CircuitState.HALF_OPEN;
        this.halfOpenCalls = 0;
      }
    }
  }

  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.CLOSED;
      this.failures = 0;
      this.halfOpenCalls = 0;
    } else {
      this.failures = 0;
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenCalls++;
      if (this.halfOpenCalls >= this.options.halfOpenMaxCalls) {
        this.state = CircuitState.OPEN;
      }
    } else if (this.failures >= this.options.failureThreshold) {
      this.state = CircuitState.OPEN;
    }
  }

  getState(): CircuitState {
    this.updateState();
    return this.state;
  }
}

export const whatsappCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeoutMs: 60000,
  halfOpenMaxCalls: 2,
});
