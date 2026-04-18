/**
 * Merge UI locale into JSON bodies for persona-api / Next proxies.
 * Wire key is always snake_case `output_locale` ("en" | "de") to match FastAPI models.
 * `T` may be a typed request (e.g. `JourneyAiGenerateRequest`) or a plain record.
 */
export function withOutputLocale<T extends object>(
  body: T,
  locale: string
): T & { output_locale: string } {
  return { ...body, output_locale: locale };
}
