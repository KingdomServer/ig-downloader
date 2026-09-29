const API = "/api/alldl";

const urlsInput = document.getElementById("urls");
const downloadBtn = document.getElementById("downloadBtn");
const clearBtn = document.getElementById("clearBtn");
const results = document.getElementById("results");
const summary = document.getElementById("summary");


function getUrls() {
  return [
    ...new Set(
      urlsInput.value
        .split(/\r?\n/)
        .map(s => s.trim())
        .filter(Boolean)
    )
  ];
}


function isInstagramUrl(value) {
  try {
    const url = new URL(value);

    return (
      (
        url.hostname === "instagram.com" ||
        url.hostname.endsWith(".instagram.com")
      ) &&
      /\/(reel|reels|p|tv)\//i.test(url.pathname)
    );

  } catch {
    return false;
  }
}


function randomDelay() {
  return Math.floor(Math.random() * 2001) + 1000;
}


function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


function createItem(url, index) {
  const el = document.createElement("div");

  el.className = "item";

  el.innerHTML = `
    <div class="item-number">
      ${index + 1}
    </div>

    <div class="item-content">
      <div class="item-title">
        ${escapeHtml(url)}
      </div>

      <div class="item-status">
        Waiting...
      </div>
    </div>

    <div class="item-indicator"></div>
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


function setItem(item, state, message) {
  item.className = `item ${state}`;

  const status = item.querySelector(".item-status");

  status.textContent = message;
}


async function resolveReel(url, retries = 2) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {

    try {

      const response = await fetch(
        `${API}?url=${encodeURIComponent(url)}`,
        {
          method: "GET",
          cache: "no-store"
        }
      );

      const text = await response.text();

      let data;

      try {
        data = JSON.parse(text);

      } catch {
        throw new Error(
          "Downloader API returned an invalid response."
        );
      }


      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
          data.error ||
          `Downloader API returned HTTP ${response.status}.`
        );
      }


      const videoUrl =
        data?.mediaInfo?.videoUrl ||
        data?.data?.downloadUrl ||
        data?.downloadUrl ||
        data?.media_url ||
        data?.url;


      if (!videoUrl) {
        throw new Error(
          "The API did not return a video URL."
        );
      }


      return {
        videoUrl,

        title:
          data?.mediaInfo?.title ||
          data?.title ||
          "Instagram Reel"
      };


    } catch (error) {

      lastError = error;

      if (attempt < retries) {
        await wait(1000 * (attempt + 1));
      }
    }
  }


  throw (
    lastError ||
    new Error("Could not resolve this Reel.")
  );
}


/*
  Download through our own Vercel API.

  The browser never opens the Instagram/CDN
  video URL directly.

  Vercel fetches the video and sends it back
  with Content-Disposition: attachment.
*/
function triggerDownload(instagramUrl, filename) {

  const downloadUrl =
    API +
    "?url=" +
    encodeURIComponent(instagramUrl) +
    "&download=1";


  const a = document.createElement("a");

  a.href = downloadUrl;

  a.download = filename;


  document.body.appendChild(a);

  a.click();

  a.remove();
}


async function processReel(url, index, item) {

  try {

    /*
      Reel #1 starts immediately.

      Every following Reel gets its own
      random 1–3 second delay.

      They DO NOT wait for the previous
      Reel to finish.
    */

    if (index > 0) {

      const delay = randomDelay();

      setItem(
        item,
        "waiting",
        `Starting in ${Math.ceil(delay / 1000)}s...`
      );

      await wait(delay);
    }


    setItem(
      item,
      "running",
      "Resolving video..."
    );


    /*
      First request:

      Get the video URL from the downloader API.
    */

    const result = await resolveReel(url);


    /*
      Second request:

      Send the original Instagram URL to our
      Vercel download endpoint.

      Vercel will fetch and stream the actual
      video to the browser.
    */

    setItem(
      item,
      "running",
      "Starting download..."
    );


    const filename =
      `${String(index + 1).padStart(2, "0")}-instagram-reel.mp4`;


    triggerDownload(
      url,
      filename
    );


    setItem(
      item,
      "done",
      "Download started"
    );


    return true;


  } catch (error) {

    setItem(
      item,
      "error",
      error.message || "Download failed."
    );

    return false;
  }
}


async function handleDownload() {

  const urls = getUrls();


  if (!urls.length) {
    urlsInput.focus();
    return;
  }


  const invalid =
    urls.filter(url => !isInstagramUrl(url));


  if (invalid.length) {

    alert(
      `${invalid.length} invalid Instagram link(s).`
    );

    return;
  }


  results.innerHTML = "";

  summary.classList.remove("hidden");

  downloadBtn.disabled = true;


  const items =
    urls.map(createItem);


  summary.textContent =
    `0 / ${urls.length} started`;


  /*
    Start every Reel independently.

    Only the first starts immediately.
    The others have their own random delay.
  */

  const jobs = urls.map((url, index) => {

    return processReel(
      url,
      index,
      items[index]
    ).then(success => {

      return {
        success
      };

    });

  });


  /*
    Keep the summary updated as each
    individual Reel finishes.
  */

  let completed = 0;
  let successful = 0;
  let failed = 0;


  jobs.forEach(job => {

    job.then(result => {

      completed++;


      if (result.success) {
        successful++;
      } else {
        failed++;
      }


      summary.textContent =
        `${completed} / ${urls.length} processed` +

        (
          successful
            ? ` • ${successful} started`
            : ""
        ) +

        (
          failed
            ? ` • ${failed} failed`
            : ""
        );

    });

  });


  await Promise.all(jobs);


  summary.textContent =
    `${successful} download${successful === 1 ? "" : "s"} started` +

    (
      failed
        ? ` • ${failed} failed`
        : ""
    );


  downloadBtn.disabled = false;
}


downloadBtn.addEventListener(
  "click",
  handleDownload
);


clearBtn.addEventListener(
  "click",
  () => {

    urlsInput.value = "";

    results.innerHTML = "";

    summary.classList.add("hidden");

    summary.textContent = "";
  }
);
