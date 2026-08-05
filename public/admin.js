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
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short", year: "numeric" }).format(date);
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

const deleteVideo = async (video, button) => {
  const confirmed = window.confirm(`Remove “${video.title}” from the RSS feed and delete its audio and artwork?`);
  if (!confirmed) return;

  button.disabled = true;
  button.textContent = "Deleting…";
  try {
    await request(`/api/admin/videos/${encodeURIComponent(video.id)}`, { method: "DELETE" });
    setStatus("The episode was removed from the RSS feed and storage.", "success");
    await loadVideos();
  } catch (error) {
    button.disabled = false;
    button.textContent = "Delete";
    setStatus(error instanceof Error ? error.message : "Could not delete the episode.", "error");
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
  title.append(link, createTextElement("span", "row-id", video.id));
  row.append(title);

  const metadata = document.createElement("div");
  metadata.className = "row-meta";
  metadata.append(
    createTextElement("time", "row-date", formatDate(video.addedAt)),
    createTextElement("span", "row-duration", formatDuration(video.duration))
  );
  row.append(metadata);

  const deleteButton = createTextElement("button", "delete-button", "Delete");
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
    createTextElement("p", "", error instanceof Error ? error.message : "Try refreshing the page.")
  );
  elements.list.append(state);
  elements.count.textContent = "—";
};

const loadVideos = async () => {
  elements.refresh.disabled = true;
  try {
    const { videos } = await request("/api/admin/videos");
    renderVideos(videos);
  } catch (error) {
    renderLoadError(error);
  } finally {
    elements.refresh.disabled = false;
  }
};

const waitForJob = async (initialJob) => {
  setProgress(initialJob.progress);
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const { job } = await request(`/api/admin/jobs/${encodeURIComponent(initialJob.id)}`);
    setProgress(job.progress);
    if (job.status === "completed") return job;
  }
};

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = elements.form.querySelector("button[type=submit]");
  const submitLabel = submitButton.querySelector(".button-label");
  submitButton.disabled = true;
  submitLabel.textContent = "Adding…";
  elements.input.disabled = true;
  setStatus();
  setProgress({ stage: "queued", percent: 0, message: "Waiting to start" });

  try {
    const { job } = await request("/api/admin/videos", {
      method: "POST",
      body: JSON.stringify({ url: elements.input.value }),
    });
    const completedJob = await waitForJob(job);
    if (!["published", "recovered"].includes(completedJob.result)) {
      throw new Error(
        completedJob.result === "already-published"
          ? "This video has already been added."
          : "Could not download or publish the video."
      );
    }

    elements.form.reset();
    setStatus();
    await loadVideos();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not add the video.";
    setProgress(
      {
        stage: "failed",
        percent: Number(elements.progressTrack.getAttribute("aria-valuenow")),
        message,
      },
      "error"
    );
    setStatus();
  } finally {
    submitButton.disabled = false;
    submitLabel.textContent = "Add";
    elements.input.disabled = false;
    elements.input.focus();
  }
});

elements.refresh.addEventListener("click", loadVideos);
void loadVideos();
