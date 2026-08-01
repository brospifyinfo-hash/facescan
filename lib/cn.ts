type ClassValue = string | false | null | undefined | ClassValue[];

export function cn(...classes: ClassValue[]): string {
  return classes
    .flat(Infinity as 1)
    .filter((c): c is string => Boolean(c))
    .join(" ");
}
