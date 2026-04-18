interface ChromaticTitleProps {
  lines: string[]
  accentLine?: number
  as?: 'h1' | 'h2' | 'div'
  class?: string
}

export function ChromaticTitle({ lines, accentLine, as = 'div', class: className = '' }: ChromaticTitleProps) {
  const Tag = as

  return (
    <Tag class={`chromatic-title ${className}`.trim()}>
      {lines.map((line, index) => (
        <span key={index} class={`chromatic-title__line${accentLine === index ? ' chromatic-title__line--accent' : ''}`}>
          <span aria-hidden="true" class="chromatic-title__layer chromatic-title__layer--cyan">
            {line}
          </span>
          <span aria-hidden="true" class="chromatic-title__layer chromatic-title__layer--pink">
            {line}
          </span>
          <span class="chromatic-title__main">{line}</span>
        </span>
      ))}
    </Tag>
  )
}
