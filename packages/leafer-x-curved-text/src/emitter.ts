type Listener<T> = (event: T) => void;

export class Emitter<Events extends object> {
  private listeners = new Map<keyof Events, Set<Listener<never>>>();

  on<K extends keyof Events>(type: K, listener: Listener<Events[K]>) {
    const group = this.listeners.get(type) ?? new Set<Listener<never>>();
    group.add(listener as Listener<never>);
    this.listeners.set(type, group);
    return this;
  }

  off<K extends keyof Events>(type: K, listener: Listener<Events[K]>) {
    this.listeners.get(type)?.delete(listener as Listener<never>);
    return this;
  }

  emit<K extends keyof Events>(type: K, event: Events[K]) {
    this.listeners.get(type)?.forEach((listener) => (listener as Listener<Events[K]>)(event));
  }

  clearListeners() {
    this.listeners.clear();
  }
}
