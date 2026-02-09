import { cookies, headers } from "next/headers";
import { createTranslator, resolveLocale } from "./index";

export const getServerLocale = () => {
  const cookieLocale = cookies().get("audion_locale")?.value;
  const acceptLanguage = headers().get("accept-language");
  return resolveLocale(cookieLocale, acceptLanguage);
};

export const getServerT = () => createTranslator(getServerLocale());
