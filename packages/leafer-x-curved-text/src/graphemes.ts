const EXTEND = /\p{Grapheme_Extend}/u;
const REGIONAL_INDICATOR = /\p{Regional_Indicator}/u;

const isVariationSelector = (character: string) => {
  const codePoint = character.codePointAt(0) ?? 0;

  return (
    (codePoint >= 0xfe00 && codePoint <= 0xfe0f) || (codePoint >= 0xe0100 && codePoint <= 0xe01ef)
  );
};

const isEmojiTag = (character: string) => {
  const codePoint = character.codePointAt(0) ?? 0;

  return codePoint >= 0xe0020 && codePoint <= 0xe007f;
};

const isEmojiModifier = (character: string) => {
  const codePoint = character.codePointAt(0) ?? 0;

  return codePoint >= 0x1f3fb && codePoint <= 0x1f3ff;
};

const splitGraphemesFallback = (text: string) => {
  const codePoints = Array.from(text);
  const graphemes: string[] = [];
  let regionalIndicatorCount = 0;

  for (let index = 0; index < codePoints.length; index += 1) {
    const character = codePoints[index];
    const previous = graphemes.at(-1);

    if (character === "\n" && previous === "\r") {
      graphemes[graphemes.length - 1] += character;
      regionalIndicatorCount = 0;
      continue;
    }

    if (
      EXTEND.test(character) ||
      isVariationSelector(character) ||
      isEmojiModifier(character) ||
      isEmojiTag(character)
    ) {
      if (previous) graphemes[graphemes.length - 1] += character;
      else graphemes.push(character);
      continue;
    }

    if (character === "\u200d") {
      if (previous) graphemes[graphemes.length - 1] += character;
      else graphemes.push(character);
      continue;
    }

    if (previous?.endsWith("\u200d")) {
      graphemes[graphemes.length - 1] += character;
      continue;
    }

    if (REGIONAL_INDICATOR.test(character)) {
      if (regionalIndicatorCount % 2 === 1 && previous) {
        graphemes[graphemes.length - 1] += character;
      } else {
        graphemes.push(character);
      }
      regionalIndicatorCount += 1;
      continue;
    }

    regionalIndicatorCount = 0;
    graphemes.push(character);
  }

  return graphemes;
};

/** 按 Unicode 字素簇切分，组合 emoji、肤色、旗帜和组合附加符都保持为单个单元。 */
export const splitGraphemes = (text: string, locale?: string) => {
  if (text.length === 0) return [];

  if (typeof Intl.Segmenter === "function") {
    const segmenter = new Intl.Segmenter(locale, { granularity: "grapheme" });

    return Array.from(segmenter.segment(text), ({ segment }) => segment);
  }

  return splitGraphemesFallback(text);
};
