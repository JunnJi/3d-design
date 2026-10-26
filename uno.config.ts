import { defineConfig, presetWind3 } from 'unocss'

export default defineConfig({
  presets: [presetWind3()],
  theme: {
    colors: {
      ink: '#0c0e13',
      panel: '#141820',
      line: '#2a3142',
    },
  },
  shortcuts: {
    'field-label': 'mb-1.5 block text-sm font-medium text-zinc-200',
    field:
      'h-11 w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 text-base text-zinc-50 outline-none transition placeholder:text-zinc-400 focus:border-amber-300 focus:bg-white/[0.08]',
    swatch: 'h-11 w-full cursor-pointer rounded-xl border border-white/10 bg-transparent p-1',
    btn: 'inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-base font-medium transition disabled:cursor-not-allowed disabled:opacity-35',
    'btn-solid': 'bg-amber-400 text-zinc-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] hover:bg-amber-300',
    'btn-ghost': 'text-zinc-100 hover:bg-white/10',
    'btn-line': 'border border-white/12 bg-white/[0.04] text-zinc-100 hover:border-amber-300/50 hover:bg-white/[0.08]',
    'tool-btn':
      'flex w-full flex-col items-center gap-1.5 rounded-2xl px-1 py-2.5 text-base font-medium leading-none text-zinc-100 transition hover:bg-white/8 hover:text-white',
    'tool-btn-on': 'bg-amber-400 !text-zinc-950 shadow-[0_8px_20px_rgba(245,176,50,0.22)] hover:bg-amber-300 hover:!text-zinc-950',
    chip: 'rounded-full px-3.5 py-1.5 text-sm font-medium text-zinc-100 transition hover:bg-white/10',
    'chip-on': 'bg-amber-400 !text-zinc-950 hover:bg-amber-300 hover:!text-zinc-950',
  },
  preflights: [
    {
      getCSS: () => `
        html, body, #app { height: 100%; }
        body {
          margin: 0;
          background: #0c0e13;
          color: #e7ebf3;
          color-scheme: dark;
          font-family: "SF Pro Text", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
          font-size: 16px;
          -webkit-font-smoothing: antialiased;
        }
        button, input, select, textarea { font: inherit; color: inherit; }
        button { cursor: pointer; background: none; border: 0; padding: 0; }
        canvas { display: block; outline: none; }
        * { scrollbar-width: thin; scrollbar-color: #3c4458 transparent; }
      `,
    },
  ],
})
