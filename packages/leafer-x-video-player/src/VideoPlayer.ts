import { Rect } from "@leafer-ui/core";
import { getVideoDrawRect } from "./geometry";
import type { VideoPlayerConfig } from "./types";

export class VideoPlayer extends Rect {
  private readonly video: HTMLVideoElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly resizeMode: "cover" | "contain";
  private frameId: number | undefined;
  private destroyed = false;

  constructor(config: VideoPlayerConfig) {
    super({ ...config, fill: "#000" });
    this.resizeMode = config.resizeMode ?? "contain";
    this.canvas = document.createElement("canvas");
    this.canvas.width = config.width;
    this.canvas.height = config.height;
    const context = this.canvas.getContext("2d");
    if (!context) throw new Error("无法创建视频 Canvas 画笔");
    this.context = context;
    this.video = document.createElement("video");
    this.video.crossOrigin = "anonymous";
    this.video.playsInline = true;
    this.video.muted = config.muted ?? true;
    this.video.loop = config.loop ?? false;
    this.video.preload = "metadata";
    this.video.src = config.src;
    if (config.poster) this.video.poster = config.poster;
    this.video.addEventListener("loadeddata", this.renderFrame);
    this.video.addEventListener("play", this.startRenderLoop);
    this.video.addEventListener("pause", this.stopRenderLoop);
    this.set({ fill: this.canvas });
  }

  play() { void this.video.play(); }
  pause() { this.video.pause(); }
  seek(seconds: number) { this.video.currentTime = Math.max(0, seconds); }
  get currentTime() { return this.video.currentTime; }
  get duration() { return Number.isFinite(this.video.duration) ? this.video.duration : 0; }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stopRenderLoop();
    this.video.pause();
    this.video.removeEventListener("loadeddata", this.renderFrame);
    this.video.removeEventListener("play", this.startRenderLoop);
    this.video.removeEventListener("pause", this.stopRenderLoop);
    this.video.removeAttribute("src");
    this.video.load();
    super.destroy();
  }

  private readonly startRenderLoop = () => {
    if (this.frameId === undefined) this.frameId = requestAnimationFrame(this.renderFrame);
  };
  private readonly stopRenderLoop = () => {
    if (this.frameId !== undefined) cancelAnimationFrame(this.frameId);
    this.frameId = undefined;
  };
  private readonly renderFrame = () => {
    if (this.destroyed) return;
    const width = this.width ?? this.canvas.width;
    const height = this.height ?? this.canvas.height;
    this.canvas.width = width;
    this.canvas.height = height;
    this.context.fillStyle = "#000";
    this.context.fillRect(0, 0, width, height);
    if (this.video.videoWidth > 0 && this.video.videoHeight > 0) {
      const rect = getVideoDrawRect(this.video.videoWidth, this.video.videoHeight, width, height, this.resizeMode);
      this.context.drawImage(this.video, rect.dx, rect.dy, rect.width, rect.height);
      this.set({ fill: this.canvas });
    }
    if (!this.video.paused && !this.video.ended) this.frameId = requestAnimationFrame(this.renderFrame);
    else this.frameId = undefined;
  };
}
