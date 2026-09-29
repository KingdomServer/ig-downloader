export default async function handler(req, res) {
  const input = req.query?.url;
  const download = req.query?.download === "1";

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

    if (!response.ok || !data.success) {
      return res.status(response.status || 502).json(data);
    }

    const videoUrl =
      data?.mediaInfo?.videoUrl ||
      data?.data?.downloadUrl ||
      data?.downloadUrl ||
      data?.media_url ||
      data?.url;

    // Normal API request — return the JSON as before.
    if (!download) {
      return res.status(200).json(data);
    }

    if (!videoUrl || typeof videoUrl !== "string") {
      return res.status(502).json({
        success: false,
        message: "The API did not return a video URL."
      });
    }

    // Fetch the actual video on the server.
    const videoResponse = await fetch(videoUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    if (!videoResponse.ok || !videoResponse.body) {
      return res.status(502).json({
        success: false,
        message: "Could not fetch the video file."
      });
    }

    const shortcode =
      instagramUrl.pathname
        .split("/")
        .filter(Boolean)
        .pop() || "reel";

    const contentType =
      videoResponse.headers.get("content-type") ||
      "video/mp4";

    const contentLength =
      videoResponse.headers.get("content-length");

    res.setHeader("Content-Type", contentType);

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="instagram-reel-${shortcode}.mp4"`
    );

    res.setHeader("Cache-Control", "no-store");

    if (contentLength) {
      res.setHeader("Content-Length", contentLength);
    }

    // Stream the video directly to the browser.
    const reader = videoResponse.body.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        res.write(Buffer.from(value));
      }
    } finally {
      reader.releaseLock();
    }

    return res.end();

  } catch (error) {
    if (!res.headersSent) {
      return res.status(502).json({
        success: false,
        message:
          error.message ||
          "Failed to contact downloader API."
      });
    }

    return res.end();
  }
}
