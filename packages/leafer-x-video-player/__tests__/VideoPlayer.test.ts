import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VideoPlayer } from "../src";
import type { VideoPlayerConfig } from "../src";

/**
 * 把 Leafer 的 Rect 换成最小桩，只保留 VideoPlayer 依赖的 width/height/set/destroy。
 * 不测引擎像素，只测视频节点自身的状态与绘制接线。
 */
vi.mock("@leafer-ui/core", () => {
  class MockRect {
    destroyed = false;
    fill: unknown;
    // 构造时由 Object.assign(this, data) 注入，tsc 无法追踪，用明确赋值断言。
    width!: number;
    height!: number;

    constructor(data: Record<string, unknown>) {
      Object.assign(this, data);
    }

    set(patch: Record<string, unknown>) {
      Object.assign(this, patch);
    }

    destroy() {
      this.destroyed = true;
    }
  }

  return { Rect: MockRect };
});

/** jsdom 拿不到真实 2d 上下文，给整块 canvas 打一个假上下文，绘制照常走。 */
const createContext = () => ({
  drawImage: vi.fn(),
  fillRect: vi.fn(),
  fillStyle: "",
});

let context = createContext();
const raf = vi.fn((_cb?: FrameRequestCallback) => 1);
const caf = vi.fn();

let playSpy: ReturnType<typeof vi.spyOn>;
let pauseSpy: ReturnType<typeof vi.spyOn>;
let loadSpy: ReturnType<typeof vi.spyOn>;

/** 给 jsdom 的 video 元素补上默认只读、需要被读写的坐标/时长字段。 */
const setVideoProp = (
  video: HTMLVideoElement,
  key: "currentTime" | "duration" | "videoWidth" | "videoHeight" | "paused" | "ended",
  value: number | boolean,
) => {
  Object.defineProperty(video, key, { configurable: true, value, writable: true });
};

const createPlayer = (config: Partial<VideoPlayerConfig> = {}) =>
  new VideoPlayer({ height: 300, src: "https://example.com/video.mp4", width: 400, ...config });

beforeEach(() => {
  context = createContext();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
  playSpy = vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
  pauseSpy = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  loadSpy = vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  vi.stubGlobal("requestAnimationFrame", raf);
  vi.stubGlobal("cancelAnimationFrame", caf);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  raf.mockClear();
  caf.mockClear();
});

describe("VideoPlayer 构造", () => {
  it("把离屏 canvas 作为逐帧图像填充交给 Leafer（changeful 标记为动态）", () => {
    const player = createPlayer();
    const fill = player.fill as { changeful: boolean; type: string; url: unknown };

    expect(fill.type).toBe("image");
    expect(fill.changeful).toBe(true);
    expect(fill.url).toBe((player as unknown as { canvas: HTMLCanvasElement }).canvas);
  });

  it("默认 resizeMode 为 contain", () => {
    const player = createPlayer();
    expect((player as unknown as { resizeMode: string }).resizeMode).toBe("contain");
  });

  it("支持 cover 模式", () => {
    const player = createPlayer({ resizeMode: "cover" });
    expect((player as unknown as { resizeMode: string }).resizeMode).toBe("cover");
  });

  it("video 元素配置 crossOrigin / playsInline / preload / src", () => {
    const video = (player_video(createPlayer())) as HTMLVideoElement;

    expect(video.crossOrigin).toBe("anonymous");
    expect(video.playsInline).toBe(true);
    expect(video.preload).toBe("metadata");
    expect(video.src).toContain("video.mp4");
  });

  it("默认 muted=true、loop=false", () => {
    const video = player_video(createPlayer());
    expect(video.muted).toBe(true);
    expect(video.loop).toBe(false);
  });

  it("config.muted=false 写入 video.muted", () => {
    expect(player_video(createPlayer({ muted: false })).muted).toBe(false);
  });

  it("config.loop=true 写入 video.loop", () => {
    expect(player_video(createPlayer({ loop: true })).loop).toBe(true);
  });

  it("config.poster 写入 video.poster，缺省不写", () => {
    expect(player_video(createPlayer({ poster: "poster.jpg" })).poster).toContain("poster.jpg");
    expect(player_video(createPlayer()).poster).toBe("");
  });

  it("拿不到 2d 上下文时构造抛错", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    expect(() => createPlayer()).toThrow("无法创建视频 Canvas 画笔");
  });
});

describe("VideoPlayer 播放控制", () => {
  it("play() 调用 video.play()", () => {
    const player = createPlayer();
    playSpy.mockClear();
    player.play();
    expect(playSpy).toHaveBeenCalledTimes(1);
  });

  it("pause() 调用 video.pause()", () => {
    const player = createPlayer();
    pauseSpy.mockClear();
    player.pause();
    expect(pauseSpy).toHaveBeenCalledTimes(1);
  });

  it("seek 负数被夹成 0", () => {
    const player = createPlayer();
    const video = player_video(player);
    setVideoProp(video, "currentTime", 0);
    player.seek(-3);
    expect(video.currentTime).toBe(0);
  });

  it("seek 正数写入 video.currentTime", () => {
    const player = createPlayer();
    const video = player_video(player);
    setVideoProp(video, "currentTime", 0);
    player.seek(12.5);
    expect(video.currentTime).toBe(12.5);
  });

  it("currentTime 读取 video.currentTime", () => {
    const player = createPlayer();
    const video = player_video(player);
    setVideoProp(video, "currentTime", 7);
    expect(player.currentTime).toBe(7);
  });

  it("duration 可解析时透传，非有限值兜底为 0", () => {
    const player = createPlayer();
    const video = player_video(player);

    setVideoProp(video, "duration", 42);
    expect(player.duration).toBe(42);

    setVideoProp(video, "duration", Infinity);
    expect(player.duration).toBe(0);

    setVideoProp(video, "duration", NaN);
    expect(player.duration).toBe(0);
  });
});

describe("VideoPlayer 渲染接线", () => {
  it("loadeddata 事件触发首帧绘制，并按 contain 计算绘制矩形", () => {
    const player = createPlayer();
    const video = player_video(player);
    setVideoProp(video, "videoWidth", 200);
    setVideoProp(video, "videoHeight", 100);

    // 目标 400x300，源 200x100，contain => scale=2 => 400x200，居中 dy=50
    video.dispatchEvent(new Event("loadeddata"));

    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 400, 300);
    expect(context.drawImage).toHaveBeenCalledWith(video, 0, 50, 400, 200);
    expect((player.fill as { changeful: boolean }).changeful).toBe(true);
  });

  it("视频尺寸未知时只铺黑底，不绘制视频也不更新填充", () => {
    const player = createPlayer();
    const before = player.fill;

    (player as unknown as { renderFrame: () => void }).renderFrame();

    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 400, 300);
    expect(context.drawImage).not.toHaveBeenCalled();
    expect(player.fill).toBe(before);
  });

  it("play 事件启动渲染循环，pause 事件停止", () => {
    const player = createPlayer();
    const video = player_video(player);
    setVideoProp(video, "paused", false);

    video.dispatchEvent(new Event("play"));
    expect(raf).toHaveBeenCalledTimes(1);

    video.dispatchEvent(new Event("pause"));
    expect(caf).toHaveBeenCalledTimes(1);
  });

  it("播放中绘制完一帧后会继续排下一帧", () => {
    const player = createPlayer();
    const video = player_video(player);
    setVideoProp(video, "videoWidth", 200);
    setVideoProp(video, "videoHeight", 100);
    setVideoProp(video, "paused", false);

    // 续帧回调只执行一次，避免无限递归。
    let frame = 0;
    raf.mockImplementation((cb?: FrameRequestCallback) => {
      if (frame === 0) {
        frame += 1;
        cb?.(0);
      }
      return frame;
    });

    (player as unknown as { renderFrame: () => void }).renderFrame();

    expect(raf).toHaveBeenCalledTimes(2);
    expect(context.drawImage).toHaveBeenCalledTimes(2);
  });
});

describe("VideoPlayer 销毁", () => {
  it("destroy 解绑监听、卸载视频源并销毁 Leafer 节点", () => {
    const player = createPlayer();
    const video = player_video(player);
    const removeSpy = vi.spyOn(video, "removeEventListener");

    player.destroy();

    expect(removeSpy).toHaveBeenCalledWith(
      "loadeddata",
      (player as unknown as { renderFrame: () => void }).renderFrame,
    );
    expect(removeSpy).toHaveBeenCalledWith(
      "play",
      (player as unknown as { startRenderLoop: () => void }).startRenderLoop,
    );
    expect(removeSpy).toHaveBeenCalledWith(
      "pause",
      (player as unknown as { stopRenderLoop: () => void }).stopRenderLoop,
    );
    expect(loadSpy).toHaveBeenCalled();
    expect(pauseSpy).toHaveBeenCalled();
    expect((player as unknown as { isDestroyed: boolean }).isDestroyed).toBe(true);
  });

  it("destroy 重复调用是安全的（只销毁一次）", () => {
    const player = createPlayer();
    player.destroy();
    expect((player as unknown as { isDestroyed: boolean }).isDestroyed).toBe(true);
    expect(() => player.destroy()).not.toThrow();
  });

  it("destroy 后 renderFrame 直接返回，不再绘制", () => {
    const player = createPlayer();
    const video = player_video(player);
    setVideoProp(video, "videoWidth", 200);
    setVideoProp(video, "videoHeight", 100);

    player.destroy();
    context.fillRect.mockClear();
    context.drawImage.mockClear();

    (player as unknown as { renderFrame: () => void }).renderFrame();

    expect(context.fillRect).not.toHaveBeenCalled();
    expect(context.drawImage).not.toHaveBeenCalled();
  });
});

/** 取内部 video 元素的辅助，集中处理私有字段访问。 */
function player_video(player: VideoPlayer): HTMLVideoElement {
  return (player as unknown as { video: HTMLVideoElement }).video;
}
