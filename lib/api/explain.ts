export async function fetchAIExplanations(mdText: string, locale: string): Promise<Record<string, string>> {
  const res = await fetch("/api/ai/explain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: mdText, locale })
  });
  
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to fetch AI definitions");

  return data.definitions || {};
}
