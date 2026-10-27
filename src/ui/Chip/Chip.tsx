import type { ButtonHTMLAttributes } from 'react'
import styles from './Chip.module.css'

export function Chip({
  selected = false,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={[styles.chip, selected && styles.selected, className].filter(Boolean).join(' ')}
      {...rest}
    />
  )
}
