const DEFAULT_INDEXING_API_URL = "http://localhost:8000";
const DEFAULT_CHAT_API_URL = "http://localhost:8001";

export const getIndexingApiBase = () => {
  const configured = process.env.NEXT_BACKEND_INTERNAL_URL?.trim();
  return (configured && configured.length > 0 ? configured : DEFAULT_INDEXING_API_URL).replace(/\/$/, "");
};

export const getChatApiBase = () => {
  // Check for internal URL first (for server-side), then public URL (for client-side)
  const internal = process.env.NEXT_CHAT_API_INTERNAL_URL?.trim();
  const publicUrl = process.env.NEXT_PUBLIC_CHAT_API_URL?.trim();
  const configured = internal || publicUrl;
  return (configured && configured.length > 0 ? configured : DEFAULT_CHAT_API_URL).replace(/\/$/, "");
};

export const getVoiceApiBase = () => {
  // Voice API uses /api/voice endpoint (different from chat API)
  // Check for public URL first, then derive from chat API URL
  const publicVoiceUrl = process.env.NEXT_PUBLIC_VOICE_API_URL?.trim();
  if (publicVoiceUrl && publicVoiceUrl.length > 0) {
    return publicVoiceUrl.replace(/\/$/, "");
  }
  // Fallback: derive from chat API URL (replace /chat with /voice)
  const chatApiBase = getChatApiBase();
  return chatApiBase.replace(/\/chat$/, "/voice");
};

