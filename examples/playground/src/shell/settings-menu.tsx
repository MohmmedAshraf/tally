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
    <div className="flex items-center justify-between gap-4">
      <Label>{label}</Label>
      {children}
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
      <PopoverContent align="end">
        <Row label="Direction">
          <ToggleGroup
            variant="outline"
            size="sm"
            value={[settings.dir]}
            onValueChange={(value) => {
              const next = value[0]
              if (next === 'ltr' || next === 'rtl') onSettings({ dir: next satisfies Direction })
            }}
          >
            <ToggleGroupItem value="ltr">LTR</ToggleGroupItem>
            <ToggleGroupItem value="rtl">RTL</ToggleGroupItem>
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
            <SelectTrigger size="sm">
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
            value={[remote ? settings.transport : 'array']}
            onValueChange={(value) => {
              const next = value[0]
              if (next === 'array' || next === 'http') {
                onSettings({ transport: next satisfies Transport })
              }
            }}
          >
            <ToggleGroupItem value="array">Array</ToggleGroupItem>
            <ToggleGroupItem value="http" disabled={!remote}>
              HTTP
            </ToggleGroupItem>
          </ToggleGroup>
        </Row>
        <Row label="Pagination">
          <ToggleGroup
            variant="outline"
            size="sm"
            value={[settings.pagination]}
            disabled={settings.transport === 'http' && remote}
            onValueChange={(value) => {
              const next = PAGINATIONS.find((entry) => entry === value[0])
              if (next !== undefined) onSettings({ pagination: next })
            }}
          >
            {PAGINATIONS.map((pagination) => (
              <ToggleGroupItem key={pagination} value={pagination} className="capitalize">
                {pagination}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
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
