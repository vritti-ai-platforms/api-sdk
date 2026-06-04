import { type CurrencyCode, minorToMajor } from '../money';

export class CurrencyAmountDto {
  currency: string;
  value: string;

  static from(minor: bigint, currencyCode: string): CurrencyAmountDto;
  static from(minor: bigint | null | undefined, currencyCode: string): CurrencyAmountDto | null;
  static from(minor: bigint | null | undefined, currencyCode: string): CurrencyAmountDto | null {
    if (minor == null) return null;
    const dto = new CurrencyAmountDto();
    dto.currency = currencyCode;
    dto.value = minorToMajor(minor, currencyCode as CurrencyCode);
    return dto;
  }
}
