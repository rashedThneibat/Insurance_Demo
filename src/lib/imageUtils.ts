/**
 * Fetches a local image and returns it as a base64 data URL so it can be
 * sent to vision-capable AI models (Claude, GPT-4o) via the image_url format.
 */
export async function fetchImageAsBase64(url: string): Promise<string | null> {
  // Already a data URL — pass through unchanged.
  if (url.startsWith("data:")) return url;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
