import { defineConfig, presetWind3 } from 'unocss'

export default defineConfig({
  presets: [presetWind3()],
  theme: {
    colors: {
      ink: '#0a0f14',
      panel: '#121a22',
      surface: '#18232d',
      line: '#2b3948',
      accent: '#4fc3b8',
      'accent-soft': '#8ad9d1',
      mist: '#9aabbc',
    },
  },
  shortcuts: {
    'field-label': 'mb-1 block text-sm font-medium text-mist',
    field:
      'box-border h-10 w-full min-w-0 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-base leading-none text-[#e9eef5] outline-none transition placeholder:text-mist/80 focus:border-accent/70 focus:bg-white/[0.07]',
    swatch:
      'box-border h-10 w-full min-w-0 cursor-pointer appearance-none rounded-xl border border-white/10 bg-transparent p-1.5',
    'swatch-chip':
      'box-border h-10 w-full min-w-0 cursor-pointer appearance-none rounded-xl border border-white/10 bg-transparent p-1',
    btn: 'inline-flex h-10 items-center justify-center gap-1.5 rounded-xl px-3 text-base font-medium transition disabled:cursor-not-allowed disabled:opacity-35',
    'btn-solid': 'bg-accent text-[#06201d] hover:bg-accent-soft',
    'btn-ghost': 'text-[#e9eef5] hover:bg-white/8',
    'btn-line': 'border border-white/12 bg-white/[0.03] text-[#e9eef5] hover:border-accent/45 hover:bg-white/[0.06]',
    'tool-btn':
      'flex w-full flex-col items-center gap-1.5 rounded-2xl px-1 py-2.5 text-base font-medium leading-none text-[#d7e0ea] transition hover:bg-white/7 hover:text-white',
    'tool-btn-on': 'bg-accent !text-[#06201d] hover:bg-accent-soft hover:!text-[#06201d]',
    chip: 'rounded-full px-3.5 py-1.5 text-sm font-medium text-[#d7e0ea] transition hover:bg-white/10',
    'chip-on': 'bg-accent !text-[#06201d] hover:bg-accent-soft hover:!text-[#06201d]',
  },
  preflights: [
    {
      getCSS: () => `
        html, body, #app { height: 100%; }
        body {
          margin: 0;
          background: #0a0f14;
          color: #e9eef5;
          color-scheme: dark;
          font-family: "SF Pro Text", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
          font-size: 16px;
          -webkit-font-smoothing: antialiased;
        }
        button, input, select, textarea { font: inherit; color: inherit; }
        button { cursor: pointer; background: none; border: 0; padding: 0; }
        input[type="number"] {
          -moz-appearance: textfield;
          appearance: textfield;
        }
        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="color"]::-webkit-color-swatch-wrapper { padding: 0; }
        input[type="color"]::-webkit-color-swatch {
          border: 0;
          border-radius: 0.55rem;
        }
        canvas { display: block; outline: none; }
        * { scrollbar-width: thin; scrollbar-color: #3a4a5c transparent; }
      `,
    },
  ],
})
