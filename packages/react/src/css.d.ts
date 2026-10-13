export {}

declare module 'react' {
  interface CSSProperties {
    [token: `--tally-${string}`]: string | number | undefined
  }
}
