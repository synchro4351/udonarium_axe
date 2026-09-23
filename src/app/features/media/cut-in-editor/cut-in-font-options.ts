export const CUT_IN_FONT_OPTIONS = [
  { name: 'default', value: '' },
  { name: 'gothic', value: '"Hiragino Sans", "Yu Gothic", Meiryo, sans-serif' },
  { name: 'mincho', value: '"Hiragino Mincho ProN", "Yu Mincho", serif' },
  { name: 'rounded', value: '"Hiragino Maru Gothic ProN", "M PLUS Rounded 1c", "Yu Gothic", sans-serif' },
  { name: 'monospace', value: '"SFMono-Regular", Consolas, "Liberation Mono", monospace' },
] as const;

export function cutInFontOption(value: string): string {
  return CUT_IN_FONT_OPTIONS.some((option) => option.value === value) ? value : 'custom';
}
