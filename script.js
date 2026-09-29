const API = "https://ahm7xmakki.com/api/alldl";

const urlsInput = document.getElementById("urls");
const downloadBtn = document.getElementById("downloadBtn");
const clearBtn = document.getElementById("clearBtn");
const results = document.getElementById("results");
const summary = document.getElementById("summary");

function getUrls() {
  return [...new Set(
    urlsInput.value
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean)
  )];
}

function isInstagramUrl(value) {
  try {
    const url = new URL(value);
    return (
      (url.hostname === "instagram.com" || url.hostname.endsWith(".instagram.com")) &&
      /\/(reel|reels|p|tv)\//i.test(url.pathname)
    );
  } catch {
    return false;
  }
}

function createItem(url, index) {
  const el = document.createElement("div");
  el.className = "item";
  el.innerHTML = `
    <span class="status"></span>
    <div class="item-text">
      <div class="item-title">${index + 1}. ${escapeHtml(url)}</div>
      <div class="item-sub">Waiting...</div>
    </div>
  `;
  results.appendChild(el);
  return el;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function setItem(item, state, message, downloadUrl = null) {
  item.className = `item ${state}`;
  const sub = item.querySelector(".item-sub");
  sub.textContent = message;

  if (downloadUrl) {
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = "Open";
    item.appendChild(link);
  }
}

async function resolveReel(url) {
  const response = await fetch(`${API}?url=${encodeURIComponent(url)}`, {
    method: "GET"
  });

  if (!response.ok) {
    throw new Error(`API returned HTTP ${response.status}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.message || data.error || "Could not resolve this Reel.");
  }

  const videoUrl =
    data?.mediaInfo?.videoUrl ||
    data?.data?.downloadUrl ||
    data?.downloadUrl ||
    data?.media_url;

  if (!videoUrl) {
    throw new Error("The API did not return a video URL.");
  }

  return {
    videoUrl,
    title: data?.mediaInfo?.title || data?.title || "Instagram Reel"
  };
}

/*
  Browsers generally allow several downloads initiated from the same
  user click, but some browsers show a "multiple downloads" permission.
*/
function triggerDownload(url, filename) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "instagram-reel.mp4";
  a.target = "_blank";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function handleDownload() {
  const urls = getUrls();

  if (!urls.length) {
    alert("Paste at least one Instagram Reel link.");
    return;
  }

  const invalid = urls.filter(url => !isInstagramUrl(url));
  if (invalid.length) {
    alert(`${invalid.length} link(s) do not look like valid public Instagram Reel/post URLs.`);
    return;
  }

  results.innerHTML = "";
  summary.classList.remove("hidden");
  summary.textContent = `Starting ${urls.length} download${urls.length === 1 ? "" : "s"}...`;
  downloadBtn.disabled = true;

  const items = urls.map(createItem);

  // Resolve every URL concurrently.
  const jobs = urls.map(async (url, index) => {
    const item = items[index];

    try {
      setItem(item, "running", "Resolving video...");

      const result = await resolveReel(url);

      setItem(item, "running", "Starting download...", result.videoUrl);

      const safeName = `${String(index + 1).padStart(2, "0")}-instagram-reel.mp4`;
      triggerDownload(result.videoUrl, safeName);

      setItem(item, "done", "Download triggered.", result.videoUrl);
      return { ok: true };
    } catch (error) {
      setItem(item, "error", error.message || "Download failed.");
      return { ok: false };
    }
  });

  const completed = await Promise.all(jobs);
  const success = completed.filter(x => x.ok).length;
  const failed = completed.length - success;

  summary.textContent =
    `${success} download${success === 1 ? "" : "s"} started` +
    (failed ? ` • ${failed} failed` : "");

  downloadBtn.disabled = false;
}

downloadBtn.addEventListener("click", handleDownload);

clearBtn.addEventListener("click", () => {
  urlsInput.value = "";
  results.innerHTML = "";
  summary.classList.add("hidden");
  summary.textContent = "";
});
