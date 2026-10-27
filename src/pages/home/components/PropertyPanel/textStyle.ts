import type { ICharStyle, IStyleRange } from "leafer-x-richTextPlus";
import type { CharacterSelection } from "leafer-x-curved-text";

/** 与 RichText 的字符索引保持一致，优先按用户感知的 grapheme 拆分文本。 */
export const splitGraphemes = (text: string): string[] => {
  const Segmenter = (Intl as any).Segmenter;
  if (Segmenter) {
    const segments = new Segmenter(undefined, { granularity: "grapheme" }).segment(
      text,
    ) as Iterable<{ segment: string }>;
    return Array.from(segments, ({ segment }) => segment);
  }
  return Array.from(text);
};

const styleOf = ({ start: _start, end: _end, ...style }: IStyleRange): ICharStyle => style;

/** 把选区样式展开、覆盖，再压缩回连续范围，避免覆盖选区外的已有样式。 */
export const applyTextStyleRange = (
  text: string,
  ranges: IStyleRange[],
  selection: CharacterSelection,
  patch: Partial<ICharStyle>,
): IStyleRange[] => {
  const styles = new Map<number, ICharStyle>();
  const count = splitGraphemes(text).length;
  ranges.forEach(({ start, end, ...style }) => {
    for (let index = Math.max(0, start); index < Math.min(end, count); index += 1) {
      styles.set(index, { ...styles.get(index), ...style });
    }
  });
  for (
    let index = Math.max(0, selection.start);
    index < Math.min(selection.end, count);
    index += 1
  ) {
    styles.set(index, { ...styles.get(index), ...patch });
  }
  const result: IStyleRange[] = [];
  [...styles.entries()]
    .sort(([left], [right]) => left - right)
    .forEach(([index, style]) => {
      const previous = result.at(-1);
      if (
        previous &&
        previous.end === index &&
        JSON.stringify(styleOf(previous)) === JSON.stringify(style)
      ) {
        previous.end = index + 1;
      } else {
        result.push({ start: index, end: index + 1, ...style });
      }
    });
  return result;
};
