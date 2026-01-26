type EventHandler<T = any> = (data: T) => void | Promise<void>;

export class EventBus {
  private handlers: Map<string, EventHandler[]> = new Map();

  on<T>(event: string, handler: EventHandler<T>): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(handler);
  }

  off(event: string, handler: EventHandler): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  async emit<T>(event: string, data: T): Promise<void> {
    const handlers = this.handlers.get(event) || [];
    await Promise.all(handlers.map(handler => {
      try {
        return handler(data);
      } catch {
        return Promise.resolve();
      }
    }));
  }
}

export const eventBus = new EventBus();
