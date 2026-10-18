import js from "@eslint/js";
import tseslint from "typescript-eslint";
import hooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/.expo/**",
      "**/.local/**",
      "**/.build/**",
      "**/dist/**",
      "**/ios/**",
      "**/android/**",
      "tools/**",
      "**/plugins/**",
    ],
  },
  { ...js.configs.recommended, files: ["**/*.ts", "**/*.tsx", "*.mjs"] },
  ...tseslint.configs.recommended,
  {
    files: ["apps/mobile/src/**/*.ts", "apps/mobile/src/**/*.tsx"],
    plugins: { "react-hooks": hooks },
    rules: {
      ...hooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react",
              importNames: ["useMemo", "useCallback", "memo"],
              message: "The React Compiler handles memoization.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.name='useEffect']",
          message:
            "Use queries for device data; explain any necessary external subscription with an eslint-disable comment.",
        },
      ],
    },
  },
);
