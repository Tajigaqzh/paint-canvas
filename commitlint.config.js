/** Conventional Commits：type(scope): 摘要。中文摘要关闭大小写检查。 */
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "header-max-length": [2, "always", 120],
    "subject-case": [0],
  },
};
