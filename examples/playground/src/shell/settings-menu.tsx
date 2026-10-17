import type { ReactElement, ReactNode } from 'react'
import type { Pagination } from 'tally-core'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { LOCALES, type Direction, type Settings, type Transport } from './settings.ts'

export interface SettingsMenuProps {
  readonly settings: Settings
  readonly onSettings: (patch: Partial<Settings>) => void
  readonly remote: boolean
}

const PAGINATIONS: readonly Pagination[] = ['none', 'offset', 'cursor']

function Row({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className="flex h-9 items-center justify-between gap-3 px-2">
      <Label className="shrink-0 font-normal">{label}</Label>
      <div className="flex min-w-0 flex-1 justify-end">{children}</div>
    </div>
  )
}

export function SettingsMenu({
  settings,
  onSettings,
  remote,
  children,
}: SettingsMenuProps & { readonly children: ReactElement }): ReactNode {
  return (
    <Popover>
      <PopoverTrigger render={children} />
      <PopoverContent
        side="top"
        align="start"
        sideOffset={6}
        className="w-(--anchor-width) gap-0.5 p-1.5"
      >
        <Row label="Direction">
          <ToggleGroup
            variant="outline"
            size="sm"
            spacing={0}
            className="w-full"
            value={[settings.dir]}
            onValueChange={(value) => {
              const next = value[0]
              if (next === 'ltr' || next === 'rtl') onSettings({ dir: next satisfies Direction })
            }}
          >
            <ToggleGroupItem value="ltr" className="flex-1">
              LTR
            </ToggleGroupItem>
            <ToggleGroupItem value="rtl" className="flex-1">
              RTL
            </ToggleGroupItem>
          </ToggleGroup>
        </Row>
        <Row label="Locale">
          <Select
            value={settings.locale}
            onValueChange={(value) => {
              const next = LOCALES.find((entry) => entry === value)
              if (next !== undefined) onSettings({ locale: next })
            }}
          >
            <SelectTrigger size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOCALES.map((locale) => (
                <SelectItem key={locale} value={locale}>
                  {locale}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>
        <Row label="Transport">
          <ToggleGroup
            variant="outline"
            size="sm"
            spacing={0}
            className="w-full"
            value={[remote ? settings.transport : 'array']}
            onValueChange={(value) => {
              const next = value[0]
              if (next === 'array' || next === 'http') {
                onSettings({ transport: next satisfies Transport })
              }
            }}
          >
            <ToggleGroupItem value="array" className="flex-1">
              Array
            </ToggleGroupItem>
            <ToggleGroupItem value="http" disabled={!remote} className="flex-1">
              HTTP
            </ToggleGroupItem>
          </ToggleGroup>
        </Row>
        <Row label="Pagination">
          <Select
            value={settings.pagination}
            disabled={settings.transport === 'http' && remote}
            onValueChange={(value) => {
              const next = PAGINATIONS.find((entry) => entry === value)
              if (next !== undefined) onSettings({ pagination: next })
            }}
          >
            <SelectTrigger size="sm" className="w-full capitalize">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGINATIONS.map((pagination) => (
                <SelectItem key={pagination} value={pagination} className="capitalize">
                  {pagination}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>
        <Row label="Phone frame">
          <Switch
            checked={settings.phone}
            onCheckedChange={(checked) => onSettings({ phone: checked })}
          />
        </Row>
      </PopoverContent>
    </Popover>
  )
}
