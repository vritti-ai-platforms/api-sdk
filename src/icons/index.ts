import { registerDecorator, type ValidationArguments, type ValidationOptions } from 'class-validator';
import iconNames from './icon-names.json';

export type IconKind = 'lucide' | 'sf' | 'material';

export const ICON_NAMES: Record<IconKind, string[]> = iconNames;

const iconNameSets = new Map<IconKind, Set<string>>();

// Returns the (cached) lookup Set for a given icon kind, building it on demand.
function getIconNameSet(kind: IconKind): Set<string> {
  let set = iconNameSets.get(kind);
  if (!set) {
    set = new Set(ICON_NAMES[kind]);
    iconNameSets.set(kind, set);
  }
  return set;
}

// O(1) check for whether a value is a known icon name within the given family.
export function isIconName(kind: IconKind, value: string): boolean {
  return getIconNameSet(kind).has(value);
}

// class-validator decorator: passes when the value is a string and a valid icon name for the kind.
export function IsIconName(kind: IconKind, validationOptions?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'isIconName',
      target: target.constructor,
      propertyName: String(propertyName),
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'string') return false;
          return isIconName(kind, value);
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} must be a valid ${kind} icon name`;
        },
      },
    });
  };
}
