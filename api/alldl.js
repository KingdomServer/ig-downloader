export default async function handler(req, res) {
  const input = req.query?.url;

  if (!input || typeof input !== "string") {
    return res.status(400).json({
      success: false,
      message: "Missing Instagram URL."
    });
  }

  try {
    const instagramUrl = new URL(input);

    const host = instagramUrl.hostname.toLowerCase();

    if (
      host !== "instagram.com" &&
      !host.endsWith(".instagram.com")
    ) {
      return res.status(400).json({
        success: false,
        message: "Only Instagram URLs are allowed."
      });
    }

    const apiUrl =
      "https://ahm7xmakki.com/api/alldl?url=" +
      encodeURIComponent(instagramUrl.toString());

    const response = await fetch(apiUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      return res.status(502).json({
        success: false,
        message: "Downloader API returned an invalid response."
      });
    }

    return res.status(response.status).json(data);

  } catch (error) {
    return res.status(502).json({
      success: false,
      message: error.message || "Failed to contact downloader API."
    });
  }
}
