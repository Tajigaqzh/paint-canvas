import type { CanvasAnimationItem, NodeUIInput } from "@/types";

/** 属性面板用毫秒，Leafer animation 的 duration / delay 用秒。 */
const millisecondsToSeconds = (milliseconds: number) => milliseconds / 1000;

/**
 * 把业务循环次数转成 Leafer 的 loop。
 * 0 表示播一次，-1 表示无限循环，大于 0 表示循环次数。
 */
const getLeaferLoop = (loop: number) => {
  if (loop < 0) return true;
  if (loop === 0) return false;

  return loop;
};

/** 把关键帧里的毫秒时长转成秒，纯样式关键帧原样透传。 */
const toLeaferKeyframe = (
  keyframe: NonNullable<CanvasAnimationItem["animation"]["keyframes"]>[number],
) => {
  if (!("style" in keyframe) || keyframe.style === undefined) {
    return keyframe;
  }

  return {
    ...keyframe,
    delay: keyframe.delay == null ? undefined : millisecondsToSeconds(keyframe.delay),
    duration: keyframe.duration == null ? undefined : millisecondsToSeconds(keyframe.duration),
  };
};

/**
 * 把一条业务动画转成 Leafer 的 IAnimation。
 *
 * 文档要求通过元素的 animation 属性创建入场/过渡/关键帧动画，
 * 并支持多条动画叠加，所以这里保持 style / keyframes 两种形态。
 */
const toLeaferAnimation = (item: CanvasAnimationItem, sequenceDelayMs: number): NodeUIInput => {
  const animation = item.animation;
  const options = {
    delay: millisecondsToSeconds(sequenceDelayMs + item.delay),
    duration: millisecondsToSeconds(item.duration),
    join: item.preset === "rotate",
    loop: getLeaferLoop(item.loop),
  };

  if (animation.keyframes?.length) {
    return {
      ...options,
      keyframes: animation.keyframes.map(toLeaferKeyframe),
    };
  }

  return {
    ...options,
    style: animation.style ?? {},
  };
};

/**
 * 把节点上的 animationList 转成 Leafer UI 的 animation。
 * 没有动画时返回 undefined，用来清掉已经挂上的动画。
 * 多条动画按列表顺序依次开始：后一条会等前一条的延时 + 时长后再播。
 */
export const getLeaferAnimation = (animationList?: CanvasAnimationItem[]) => {
  if (!animationList?.length) return undefined;

  let sequenceDelayMs = 0;
  const animations = animationList.map((item) => {
    const animation = toLeaferAnimation(item, sequenceDelayMs);

    sequenceDelayMs += item.delay + item.duration;

    return animation;
  });

  return animations.length === 1 ? animations[0] : animations;
};

/** 用序列化结果判断动画配置有没有变，避免每次节点同步都重启动画。 */
export const getAnimationSignature = (animationList?: CanvasAnimationItem[]) =>
  JSON.stringify(animationList ?? []);
