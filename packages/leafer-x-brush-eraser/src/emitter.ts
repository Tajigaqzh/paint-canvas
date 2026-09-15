type Listener<T> = (event: T) => void;

/**
 * 极简类型化事件总线。
 *
 * 插件不引第三方依赖，对外只暴露 on / off；emit 留给子类使用。
 */
export class Emitter<Events extends object> {
  private listeners = new Map<keyof Events, Set<Listener<never>>>();

  /** 订阅事件。 */
  on<K extends keyof Events>(type: K, listener: Listener<Events[K]>) {
    const group = this.listeners.get(type) ?? new Set<Listener<never>>();

    group.add(listener as Listener<never>);
    this.listeners.set(type, group);

    return this;
  }

  /** 取消订阅。 */
  off<K extends keyof Events>(type: K, listener: Listener<Events[K]>) {
    this.listeners.get(type)?.delete(listener as Listener<never>);

    return this;
  }

  protected emit<K extends keyof Events>(type: K, event: Events[K]) {
    this.listeners.get(type)?.forEach((listener) => {
      (listener as Listener<Events[K]>)(event);
    });
  }

  /** 解绑全部监听，dispose 时调用。 */
  protected clearListeners() {
    this.listeners.clear();
  }
}
