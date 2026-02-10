import { cookies, headers } from "next/headers";
import { createTranslator, resolveLocale } from "./index";

export const getServerLocale = async () => {
  const cookieStore = await cookies();
  const headersList = await headers();
  const cookieLocale = cookieStore.get("audion_locale")?.value;
  const acceptLanguage = headersList.get("accept-language");
  return resolveLocale(cookieLocale, acceptLanguage);
};

export const getServerT = async () => createTranslator(await getServerLocale());
