import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";

countries.registerLocale(enLocale);

// Non-standard codes found in the data
const CODE_ALIASES: Record<string, string> = {
  UK: "GB",
};

export function countryName(code: string | undefined | null): string {
  if (!code) return "";
  const normalized = CODE_ALIASES[code.toUpperCase()] ?? code.toUpperCase();
  return countries.getName(normalized, "en") ?? code;
}
