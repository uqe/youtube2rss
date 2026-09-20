const elements = {
  count: document.querySelector("#video-count"),
  form: document.querySelector("#add-form"),
  input: document.querySelector("#video-url"),
  list: document.querySelector("#video-list"),
  refresh: document.querySelector("#refresh-button"),
  status: document.querySelector("#form-status"),
  progress: document.querySelector("#job-progress"),
  progressTrack: document.querySelector("#progress-track"),
  progressFill: document.querySelector("#progress-fill"),
  progressLabel: document.querySelector("#progress-label"),
  progressValue: document.querySelector("#progress-value"),
  emptyTemplate: document.querySelector("#empty-template"),
};

const request = async (url, options) => {
  const apiUrl = new URL(url, window.location.origin);
  const response = await fetch(apiUrl, {
    credentials: "same-origin",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? `HTTP ${response.status}`);
  }
  return data;
};

const formatDuration = (seconds) => {
  const value = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const rest = Math.floor(value % 60);
  return [hours, minutes, rest].map((part) => String(part).padStart(2, "0")).join(":");
};

const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const setStatus = (message = "", state = "") => {
  elements.status.textContent = message;
  elements.status.dataset.state = state;
};

const setProgress = ({ percent = 0, message = "Waiting to start", stage = "queued" }, state) => {
  const value = Math.min(100, Math.max(0, Number(percent) || 0));
  const progressState = state ?? (stage === "completed" ? "success" : stage === "failed" ? "error" : "processing");

  elements.progress.hidden = false;
  elements.progress.dataset.state = progressState;
  elements.progressFill.style.width = `${value}%`;
  elements.progressLabel.textContent = message;
  elements.progressValue.textContent = `${value}%`;
  elements.progressTrack.setAttribute("aria-valuenow", String(value));
  elements.progressTrack.setAttribute("aria-valuetext", message);
};

const createTextElement = (tag, className, text) => {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
};

let selectedCollection = "";
let collections = [];
let allFeedUrl = "/rss.xml";
let jobsSignature = "";
let libraryRequest = 0;

const enqueueAction = async (path, method, body) => {
  await request(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  setStatus("Added to the queue. You can close this page; progress is saved.", "success");
  await loadJobs();
};

const deleteVideo = async (video, button) => {
  const collectionId = selectedCollection;
  const confirmed = window.confirm(
    collectionId
      ? `Remove “${video.title}” from this collection? The episode will remain in your library.`
      : `Delete “${video.title}” from all feeds and remove its audio and artwork?`,
  );
  if (!confirmed) {
    return;
  }
  button.disabled = true;
  try {
    await enqueueAction(
      collectionId
        ? `/api/admin/collections/${collectionId}/videos/${encodeURIComponent(video.id)}`
        : `/api/admin/videos/${encodeURIComponent(video.id)}`,
      "DELETE",
    );
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Could not queue removal.", "error");
  } finally {
    button.disabled = false;
  }
};

const createVideoRow = (video, index) => {
  const row = document.createElement("article");
  row.className = "video-row";

  row.append(createTextElement("span", "row-index", String(index + 1).padStart(2, "0")));

  const title = document.createElement("div");
  title.className = "row-title";
  const link = document.createElement("a");
  link.href = video.url;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.textContent = video.title;
  title.append(
    link,
    createTextElement("span", "row-id", video.publicationStatus === "pending" ? "Publication pending" : video.id),
  );
  if (video.publicationStatus === "pending") {
    const retry = createTextElement("button", "quiet-button", "Retry publication");
    retry.type = "button";
    retry.addEventListener("click", async () => {
      retry.disabled = true;
      try {
        await enqueueAction("/api/admin/videos", "POST", { url: video.url });
      } catch (error) {
        setStatus(error.message, "error");
      } finally {
        retry.disabled = false;
      }
    });
    title.append(retry);
  }
  if (collections.length) {
    const chooser = document.createElement("details");
    chooser.className = "episode-collections";
    const summary = createTextElement("summary", "collection-toggle", "Add to collection");
    const choices = document.createElement("div");
    choices.className = "collection-popover";
    for (const collection of collections) {
      const choice = createTextElement("button", "quiet-button", collection.name);
      choice.type = "button";
      choice.addEventListener("click", async () => {
        choice.disabled = true;
        try {
          await enqueueAction(`/api/admin/collections/${collection.id}/videos/${encodeURIComponent(video.id)}`, "PUT");
          chooser.open = false;
        } catch (error) {
          setStatus(error.message, "error");
        } finally {
          choice.disabled = false;
        }
      });
      choices.append(choice);
    }
    chooser.append(summary, choices);
    title.append(chooser);
  }
  row.append(title);

  const metadata = document.createElement("div");
  metadata.className = "row-meta";
  metadata.append(
    createTextElement("time", "row-date", formatDate(video.addedAt)),
    createTextElement("span", "row-duration", formatDuration(video.duration)),
  );
  row.append(metadata);

  const deleteButton = createTextElement("button", "delete-button", selectedCollection ? "Remove" : "Delete");
  deleteButton.type = "button";
  deleteButton.addEventListener("click", () => deleteVideo(video, deleteButton));
  row.append(deleteButton);

  return row;
};

const renderVideos = (videos) => {
  elements.list.replaceChildren();
  elements.list.setAttribute("aria-busy", "false");
  elements.count.textContent = String(videos.length).padStart(2, "0");

  if (videos.length === 0) {
    elements.list.append(elements.emptyTemplate.content.cloneNode(true));
    return;
  }

  videos.forEach((video, index) => elements.list.append(createVideoRow(video, index)));
};

const renderLoadError = (error) => {
  elements.list.replaceChildren();
  elements.list.setAttribute("aria-busy", "false");
  const state = document.createElement("div");
  state.className = "error-state";
  state.append(
    createTextElement("h3", "", "Could not load the feed"),
    createTextElement("p", "", error instanceof Error ? error.message : "Try refreshing the page."),
  );
  elements.list.append(state);
  elements.count.textContent = "—";
};

const loadVideos = async () => {
  elements.refresh.disabled = true;
  const requestId = ++libraryRequest;
  try {
    const { videos } = await request(
      `/api/admin/videos${selectedCollection ? `?collection=${selectedCollection}` : ""}`,
    );
    if (requestId === libraryRequest) {
      renderVideos(videos);
    }
  } catch (error) {
    renderLoadError(error);
  } finally {
    elements.refresh.disabled = false;
  }
};

const loadCollections = async () => {
  const data = await request("/api/admin/collections");
  collections = data.collections;
  allFeedUrl = data.feedUrl;
  const list = document.querySelector("#collection-list");
  list.replaceChildren();
  for (const collection of [{ id: "", name: "All episodes", feedUrl: allFeedUrl }, ...collections]) {
    const button = createTextElement("button", "quiet-button", collection.name);
    button.type = "button";
    button.dataset.collection = collection.id;
    button.setAttribute("aria-pressed", String(collection.id === selectedCollection));
    button.addEventListener("click", async () => {
      selectedCollection = collection.id;
      for (const item of list.querySelectorAll("button")) {
        item.setAttribute("aria-pressed", String(item === button));
      }
      document.querySelector("#feed-link").href = collection.feedUrl;
      document.querySelector("#feed-title").textContent = collection.name;
      document.querySelector("#add-title").textContent = collection.id ? `Add to ${collection.name}` : "Add to feed";
      document.querySelector("#collection-hint").textContent = collection.id
        ? "New links will be added to this collection and the main feed."
        : "Each collection has its own RSS subscription.";
      await loadVideos();
    });
    list.append(button);
  }
  document.querySelector("#feed-link").href =
    collections.find((item) => item.id === selectedCollection)?.feedUrl ?? allFeedUrl;
};

const loadJobs = async () => {
  const { jobs } = await request("/api/admin/jobs");
  document.querySelector("#queue-status").textContent = "";
  const signature = JSON.stringify(jobs);
  if (signature === jobsSignature) {
    return;
  }
  const hadJobs = Boolean(jobsSignature);
  jobsSignature = signature;
  const list = document.querySelector("#job-list");
  list.replaceChildren();
  const visibleJobs = [
    ...jobs.filter((job) => job.status !== "completed" || job.result === "failed"),
    ...jobs.filter((job) => job.status === "completed" && job.result !== "failed").slice(0, 3),
  ];
  if (!visibleJobs.length) {
    list.append(createTextElement("p", "collection-hint", "Nothing in the queue. Add a link to get started."));
  }
  for (const job of visibleJobs) {
    const row = document.createElement("article");
    row.className = "job-row";
    row.dataset.state = job.result === "failed" ? "error" : job.status;
    const labels = {
      download: "Add episode",
      delete: "Delete episode",
      refresh: "Update feeds",
      "collection-add": "Add to collection",
      "collection-remove": "Remove from collection",
    };
    const description = document.createElement("div");
    description.append(
      createTextElement("strong", "job-title", `${labels[job.kind]}${job.videoId ? ` · ${job.videoId}` : ""}`),
    );
    description.append(
      createTextElement(
        "span",
        "job-detail",
        `${job.progress.message}${job.attempts > 1 ? ` · Attempt ${job.attempts}` : ""}`,
      ),
    );
    row.append(description);
    if (job.result === "failed") {
      const retry = createTextElement("button", "quiet-button", "Retry");
      retry.type = "button";
      retry.addEventListener("click", async () => {
        retry.disabled = true;
        try {
          await enqueueAction(`/api/admin/jobs/${job.id}/retry`, "POST");
        } catch (error) {
          setStatus(error.message, "error");
          retry.disabled = false;
        }
      });
      row.append(retry);
    } else {
      row.append(
        createTextElement(
          "span",
          "job-percent",
          job.status === "queued" ? "Queued" : job.status === "completed" ? "Done" : `${job.progress.percent}%`,
        ),
      );
    }
    list.append(row);
  }
  const active = jobs.find((job) => job.status === "processing");
  if (active) {
    setProgress(active.progress);
  } else {
    elements.progress.hidden = true;
  }
  if (hadJobs) {
    await loadVideos();
  }
};

const refresh = async () => {
  try {
    await loadCollections();
    await loadVideos();
    await loadJobs();
  } catch (error) {
    setStatus(error.message, "error");
  }
};

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = elements.form.querySelector("button[type=submit]");
  button.disabled = true;
  setStatus();
  try {
    await enqueueAction("/api/admin/videos", "POST", {
      url: elements.input.value,
      ...(selectedCollection ? { collectionId: selectedCollection } : {}),
    });
    elements.form.reset();
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    button.disabled = false;
    elements.input.focus();
  }
});

document.querySelector("#collection-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button");
  button.disabled = true;
  try {
    await request("/api/admin/collections", {
      method: "POST",
      body: JSON.stringify({ name: document.querySelector("#collection-name").value }),
    });
    form.reset();
    form.closest("details").open = false;
    document.querySelector("#collection-status").textContent = "";
    await refresh();
  } catch (error) {
    document.querySelector("#collection-status").textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

elements.refresh.addEventListener("click", refresh);
let polling = false;
setInterval(async () => {
  if (document.hidden || polling) {
    return;
  }
  polling = true;
  try {
    await loadJobs();
  } catch {
    document.querySelector("#queue-status").textContent = "Connection lost. Retrying…";
  } finally {
    polling = false;
  }
}, 2000);
void refresh();
