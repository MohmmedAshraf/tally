import type { ColumnType } from '../column-type.ts'
import { createTypeRegistry, type TypeRegistry } from '../registry.ts'
import { booleanType } from './boolean.ts'
import { dateType } from './date.ts'
import { enumType } from './enum.ts'
import { barType, currencyType, durationType, intType, numberType, percentType } from './number.ts'
import { emailType, idType, personType, textType, urlType } from './text.ts'

export const builtinTypes: readonly ColumnType[] = [
  textType,
  enumType,
  currencyType,
  intType,
  numberType,
  percentType,
  barType,
  dateType,
  booleanType,
  emailType,
  urlType,
  idType,
  personType,
  durationType,
]

export function createDefaultRegistry(): TypeRegistry {
  return createTypeRegistry(builtinTypes)
}

export { findOption, optionLabel } from './enum.ts'
export { parseBoolean } from './boolean.ts'
