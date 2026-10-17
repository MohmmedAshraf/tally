import { Drawer } from '@base-ui/react/drawer'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { columnLabel, type Column, type Grid, type RowItem } from 'tally-core'
import { Tile, subtitleOf } from './cells/renderers.tsx'
import { useShell } from './context.ts'
import { useLabels } from './labels.ts'

export interface DetailProps {
  readonly grid: Grid
  readonly item: RowItem
  readonly close: () => void
}

export type DetailRenderer = (props: DetailProps) => ReactNode

export interface CardDetailProps {
  readonly grid: Grid
  readonly item: RowItem | undefined
  readonly title: Column | undefined
  readonly hero: Column | undefined
  readonly fields: readonly Column[]
  readonly onClose: () => void
  readonly textOf: (item: RowItem, column: Column) => string
  readonly signOf: (item: RowItem, column: Column) => { readonly 'data-sign'?: string }
  readonly value: (item: RowItem, column: Column) => ReactNode
}

export function CardDetail({
  grid,
  item,
  title,
  hero,
  fields,
  onClose,
  textOf,
  signOf,
  value,
}: CardDetailProps): ReactNode {
  const { root, detail } = useShell()
  const labels = useLabels()
  const heading = item === undefined || title === undefined ? '' : textOf(item, title)
  const subtitle =
    item === undefined || title === undefined ? undefined : subtitleOf(item.row, title)
  return (
    <Drawer.Root
      open={item !== undefined}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <Drawer.Portal container={root}>
        <Drawer.Backdrop className="tally-detail-backdrop" />
        <Drawer.Viewport className="tally-detail-viewport">
          <Drawer.Popup className="tally-detail" aria-label={heading}>
            <Drawer.Content className="tally-detail-content">
              {item === undefined ? null : (
                <>
                  <header className="tally-detail-head">
                    {title?.avatar === true && heading !== '' ? <Tile text={heading} /> : null}
                    <Drawer.Title className="tally-detail-title">
                      <span className="tally-text">{heading}</span>
                      {subtitle === undefined ? null : (
                        <span className="tally-sub">{subtitle}</span>
                      )}
                    </Drawer.Title>
                    <Drawer.Close className="tally-icon-button" aria-label={labels.close}>
                      <X size={16} aria-hidden />
                    </Drawer.Close>
                  </header>
                  {typeof detail === 'function' ? (
                    detail({ grid, item, close: onClose })
                  ) : (
                    <>
                      {hero === undefined ? null : (
                        <div className="tally-detail-hero" {...signOf(item, hero)}>
                          <span className="tally-detail-hero-value">{value(item, hero)}</span>
                          <span className="tally-detail-hero-label">{columnLabel(hero)}</span>
                        </div>
                      )}
                      <dl className="tally-detail-fields">
                        {fields.map((column) => (
                          <div
                            key={column.id}
                            className="tally-detail-field"
                            {...signOf(item, column)}
                          >
                            <dt>{columnLabel(column)}</dt>
                            <dd>{value(item, column)}</dd>
                          </div>
                        ))}
                      </dl>
                    </>
                  )}
                </>
              )}
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
