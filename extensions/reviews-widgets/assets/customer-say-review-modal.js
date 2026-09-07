(function () {
  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function shopDomain() {
    return window.Shopify && window.Shopify.shop
      ? window.Shopify.shop
      : window.location.hostname;
  }

  function proxyUrl(path) {
    return new URL(path, window.location.origin).toString();
  }

  function createSessionId() {
    if (window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID().replace(/-/g, "");
    }
    return "ws" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function parseJsonResponse(raw) {
    try {
      return raw ? JSON.parse(raw) : {};
    } catch (error) {
      if (/^You are about to visit/i.test(raw)) {
        throw new Error("App proxy blocked by ngrok. Clear Direct app URL in block settings.");
      }
      throw new Error("Unexpected response from app server.");
    }
  }

  var MAX_IMAGE_EDGE = 1920;
  var IMAGE_QUALITY = 0.82;
  var MAX_MEDIA_FILES = 8;

  function canvasToBlob(canvas, type, quality) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(
        function (blob) {
          if (!blob) {
            reject(new Error("Could not compress image"));
            return;
          }
          resolve(blob);
        },
        type,
        quality,
      );
    });
  }

  async function compressImageFile(file) {
    // Keep animated GIFs intact
    if (file.type === "image/gif") {
      return { blob: file, contentType: file.type };
    }

    if (!file.type || file.type.indexOf("image/") !== 0) {
      return { blob: file, contentType: file.type || "application/octet-stream" };
    }

    var bitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch (error) {
      return { blob: file, contentType: file.type };
    }

    try {
      var scale = Math.min(
        1,
        MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height),
      );
      var width = Math.max(1, Math.round(bitmap.width * scale));
      var height = Math.max(1, Math.round(bitmap.height * scale));
      var canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      var ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) {
        return { blob: file, contentType: file.type };
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(bitmap, 0, 0, width, height);

      var outputType = "image/jpeg";
      var blob = await canvasToBlob(canvas, outputType, IMAGE_QUALITY);

      // Prefer original if compression did not help
      if (scale === 1 && blob.size >= file.size * 0.95) {
        return { blob: file, contentType: file.type };
      }

      return { blob: blob, contentType: outputType };
    } finally {
      if (bitmap && bitmap.close) bitmap.close();
    }
  }

  async function prepareUploadFile(file, kind) {
    if (kind === "video" || (file.type && file.type.indexOf("video/") === 0)) {
      // Browser video re-encode needs heavy tooling; upload original.
      return { blob: file, contentType: file.type || "video/mp4" };
    }

    return compressImageFile(file);
  }

  var STEPS = ["rating", "media", "body", "contact", "thanks"];

  function ReviewModal(config) {
    this.config = config;
    this.state = {
      step: "rating",
      rating: 0,
      body: "",
      firstName: "",
      lastName: "",
      email: "",
      media: [],
      uploadSessionId: createSessionId(),
      uploadBatch: { total: 0, completed: 0, failed: 0 },
      toast: null,
      toastTimer: null,
      submitting: false,
      error: null,
      message: null,
    };
    this.overlay = null;
    this._mediaSeq = 0;
  }

  ReviewModal.prototype.nextLocalId = function () {
    this._mediaSeq += 1;
    return "local-" + this._mediaSeq;
  };

  ReviewModal.prototype.countMediaByStatus = function (status) {
    return this.state.media.filter(function (item) {
      return item.status === status;
    }).length;
  };

  ReviewModal.prototype.hasUploadingMedia = function () {
    return this.countMediaByStatus("uploading") > 0;
  };

  ReviewModal.prototype.readyMedia = function () {
    return this.state.media.filter(function (item) {
      return item.status === "done" && item.mediaKey;
    });
  };

  ReviewModal.prototype.showToast = function (message) {
    var self = this;
    this.state.toast = message;
    if (this.state.toastTimer) {
      clearTimeout(this.state.toastTimer);
    }
    this.syncToast();
    this.state.toastTimer = setTimeout(function () {
      self.state.toast = null;
      self.state.toastTimer = null;
      self.syncToast();
    }, 3200);
  };

  ReviewModal.prototype.syncToast = function () {
    if (!this.overlay) return;
    var content = this.overlay.querySelector("[data-or-review-content]");
    if (!content) return;
    var existing = content.querySelector(".or-review-modal__toast");
    if (!this.state.toast) {
      if (existing) existing.remove();
      return;
    }
    if (existing) {
      existing.textContent = this.state.toast;
      return;
    }
    var toast = document.createElement("div");
    toast.className = "or-review-modal__toast";
    toast.setAttribute("role", "status");
    toast.textContent = this.state.toast;
    content.appendChild(toast);
  };

  ReviewModal.prototype.open = function () {
    if (this.overlay) return;
    this.overlay = document.createElement("div");
    this.overlay.className = "or-review-modal";
    this.overlay.innerHTML =
      '<div class="or-review-modal__backdrop" data-or-review-close></div>' +
      '<div class="or-review-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="or-review-modal-title">' +
      '<button type="button" class="or-review-modal__close" data-or-review-close aria-label="Close">&times;</button>' +
      '<div class="or-review-modal__scroll">' +
      '<div class="or-review-modal__content" data-or-review-content></div>' +
      "</div>" +
      '<div class="or-review-modal__chrome" data-or-review-chrome></div>' +
      "</div>";
    document.body.appendChild(this.overlay);
    document.body.classList.add("or-review-modal-open");

    var self = this;
    this.overlay.addEventListener("click", function (event) {
      var target = event.target;
      if (target && target.closest && target.closest("[data-or-review-close]")) {
        self.close();
      }
    });

    this.render();
  };

  ReviewModal.prototype.close = function () {
    if (this.state.toastTimer) {
      clearTimeout(this.state.toastTimer);
      this.state.toastTimer = null;
    }
    if (this.overlay) {
      this.state.media.forEach(function (item) {
        if (item.previewUrl && String(item.previewUrl).indexOf("blob:") === 0) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
      this.overlay.remove();
      this.overlay = null;
    }
    document.body.classList.remove("or-review-modal-open");
  };

  ReviewModal.prototype.setStep = function (step) {
    this.state.step = step;
    this.state.error = null;
    this.render();
  };

  ReviewModal.prototype.render = function () {
    if (!this.overlay) return;
    var content = this.overlay.querySelector("[data-or-review-content]");
    var chrome = this.overlay.querySelector("[data-or-review-chrome]");
    var scroll = this.overlay.querySelector(".or-review-modal__scroll");
    var dialog = this.overlay.querySelector(".or-review-modal__dialog");
    if (!content || !chrome) return;

    var previousStep = this._renderedStep || null;
    var scrollTop = scroll ? scroll.scrollTop : 0;

    this.overlay.classList.toggle(
      "or-review-modal--thanks",
      this.state.step === "thanks",
    );
    if (dialog) {
      dialog.classList.toggle(
        "or-review-modal__dialog--media",
        this.state.step === "media",
      );
      dialog.classList.toggle(
        "or-review-modal__dialog--thanks",
        this.state.step === "thanks",
      );
    }

    if (this.state.step === "thanks") {
      content.innerHTML = this.renderThanks();
      chrome.innerHTML = "";
      this._renderedStep = "thanks";
      this.bindThanks(content);
      return;
    }

    content.innerHTML =
      this.renderHeader() +
      this.renderProgress() +
      this.renderStepBody() +
      (this.state.toast
        ? '<div class="or-review-modal__toast" role="status">' +
          escapeHtml(this.state.toast) +
          "</div>"
        : "");
    chrome.innerHTML = this.renderFooter();
    this._renderedStep = this.state.step;

    this.bindStep(this.overlay);

    if (scroll && previousStep === this.state.step) {
      scroll.scrollTop = scrollTop;
    }
  };

  ReviewModal.prototype.getMediaProgressState = function () {
    var uploadingCount = this.countMediaByStatus("uploading");
    var doneCount = this.countMediaByStatus("done");
    var failedCount = this.countMediaByStatus("failed");
    var totalSelected = this.state.media.length;
    var batch = this.state.uploadBatch;
    var remainingUploads = Math.max(
      0,
      batch.total - batch.completed - batch.failed,
    );
    var slotsLeft = Math.max(0, MAX_MEDIA_FILES - totalSelected);
    var barPct = 0;
    if (batch.total > 0) {
      barPct = Math.round(
        ((batch.completed + batch.failed) / batch.total) * 100,
      );
    } else if (totalSelected > 0) {
      barPct = Math.round((doneCount / totalSelected) * 100);
    }

    var slotLabel =
      slotsLeft === 1 ? "1 slot left" : slotsLeft + " slots left";
    var statusLine;
    if (totalSelected === 0 && batch.total === 0) {
      statusLine = "Ready for up to " + MAX_MEDIA_FILES + " files";
    } else {
      statusLine =
        doneCount +
        " of " +
        MAX_MEDIA_FILES +
        " uploaded" +
        (uploadingCount ? " · " + uploadingCount + " uploading" : "") +
        (failedCount ? " · " + failedCount + " failed" : "") +
        (remainingUploads && batch.total
          ? " · " + remainingUploads + " left in batch"
          : slotsLeft
            ? " · " + slotLabel
            : " · limit reached");
    }

    return {
      uploadingCount: uploadingCount,
      doneCount: doneCount,
      failedCount: failedCount,
      totalSelected: totalSelected,
      slotsLeft: slotsLeft,
      barPct: barPct,
      statusLine: statusLine,
      inputsDisabled: uploadingCount > 0 || totalSelected >= MAX_MEDIA_FILES,
    };
  };

  ReviewModal.prototype.renderUploadProgressHtml = function () {
    var progress = this.getMediaProgressState();
    return (
      '<div class="or-review-modal__upload-progress" data-or-review-upload-progress aria-live="polite">' +
      '<div class="or-review-modal__upload-progress-top">' +
      '<span class="or-review-modal__upload-progress-text">' +
      progress.statusLine +
      "</span>" +
      '<span class="or-review-modal__upload-progress-pct">' +
      progress.barPct +
      "%</span></div>" +
      '<div class="or-review-modal__upload-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' +
      progress.barPct +
      '"><span style="width:' +
      progress.barPct +
      '%"></span></div></div>'
    );
  };

  ReviewModal.prototype.renderMediaPreviewHtml = function (item, index) {
    var label = item.mediaType === "video" ? "Video" : "Photo";
    var status = item.status || "done";
    var previewSrc = item.previewUrl || item.publicUrl || "";
    var mediaContent =
      item.mediaType === "video"
        ? '<div class="or-review-modal__media-video">' +
          (previewSrc
            ? '<video src="' +
              escapeHtml(previewSrc) +
              '" muted playsinline preload="metadata"></video>'
            : "Video") +
          "</div>"
        : previewSrc
          ? '<img src="' + escapeHtml(previewSrc) + '" alt="" />'
          : '<div class="or-review-modal__media-video">Photo</div>';

    return (
      '<div class="or-review-modal__media-preview' +
      (status === "uploading" ? " is-uploading" : "") +
      (status === "failed" ? " is-failed" : "") +
      (status === "done" ? " is-done" : "") +
      '" data-or-review-media-id="' +
      escapeHtml(item.localId || String(index)) +
      '">' +
      mediaContent +
      (status === "uploading"
        ? '<div class="or-review-modal__media-loader" aria-hidden="true">' +
          '<span class="or-review-modal__spinner"></span>' +
          "<span>Uploading</span></div>"
        : "") +
      (status === "failed"
        ? '<div class="or-review-modal__media-failed">Failed</div>'
        : "") +
      (status !== "uploading"
        ? '<button type="button" class="or-review-modal__media-remove" data-or-review-remove-media="' +
          index +
          '" aria-label="Remove ' +
          label +
          '">&times;</button>'
        : "") +
      "</div>"
    );
  };

  ReviewModal.prototype.renderMediaTrayHtml = function () {
    if (!this.state.media.length) {
      return (
        '<div class="or-review-modal__media-tray" data-or-review-media-tray>' +
        '<div class="or-review-modal__media-empty">No files yet — add a few highlights from your experience.</div>' +
        "</div>"
      );
    }

    var self = this;
    var previews = this.state.media
      .map(function (item, index) {
        return self.renderMediaPreviewHtml(item, index);
      })
      .join("");

    return (
      '<div class="or-review-modal__media-tray" data-or-review-media-tray>' +
      '<div class="or-review-modal__media-previews">' +
      previews +
      "</div></div>"
    );
  };

  ReviewModal.prototype.syncMediaLiveUi = function () {
    if (!this.overlay || this.state.step !== "media") {
      this.render();
      return;
    }

    var progressRoot = this.overlay.querySelector(
      "[data-or-review-upload-progress]",
    );
    var trayRoot = this.overlay.querySelector("[data-or-review-media-tray]");
    var chrome = this.overlay.querySelector("[data-or-review-chrome]");
    if (!progressRoot || !trayRoot || !chrome) {
      this.render();
      return;
    }

    var progress = this.getMediaProgressState();
    var textEl = progressRoot.querySelector(
      ".or-review-modal__upload-progress-text",
    );
    var pctEl = progressRoot.querySelector(
      ".or-review-modal__upload-progress-pct",
    );
    var bar = progressRoot.querySelector(".or-review-modal__upload-bar");
    var barFill = progressRoot.querySelector(".or-review-modal__upload-bar > span");
    if (textEl) textEl.textContent = progress.statusLine;
    if (pctEl) pctEl.textContent = progress.barPct + "%";
    if (bar) bar.setAttribute("aria-valuenow", String(progress.barPct));
    if (barFill) barFill.style.width = progress.barPct + "%";

    var trayScroll = trayRoot.scrollTop;
    trayRoot.outerHTML = this.renderMediaTrayHtml();
    var nextTray = this.overlay.querySelector("[data-or-review-media-tray]");
    if (nextTray) nextTray.scrollTop = trayScroll;

    this.overlay.querySelectorAll("[data-or-review-upload]").forEach(function (input) {
      input.disabled = progress.inputsDisabled;
      var card = input.closest(".or-review-modal__upload-card");
      if (card) {
        card.classList.toggle("is-disabled", progress.inputsDisabled);
      }
    });

    chrome.innerHTML = this.renderFooter();
    this.bindMediaChrome(this.overlay);
    this.bindMediaTray(this.overlay);
  };

  ReviewModal.prototype.bindMediaTray = function (root) {
    var self = this;
    root.querySelectorAll("[data-or-review-remove-media]").forEach(function (button) {
      button.addEventListener("click", function () {
        var index = Number(button.getAttribute("data-or-review-remove-media"));
        var removed = self.state.media[index];
        if (!removed || removed.status === "uploading") return;
        if (
          removed.previewUrl &&
          String(removed.previewUrl).indexOf("blob:") === 0
        ) {
          URL.revokeObjectURL(removed.previewUrl);
        }
        self.state.media.splice(index, 1);
        self.syncMediaLiveUi();
      });
    });
  };

  ReviewModal.prototype.bindMediaChrome = function (root) {
    var self = this;
    var back = root.querySelector("[data-or-review-back]");
    if (back) {
      back.addEventListener("click", function () {
        if (self.hasUploadingMedia() || self.state.submitting) return;
        var target = back.getAttribute("data-or-review-back");
        if (target) self.setStep(target);
      });
    }

    var skip = root.querySelector("[data-or-review-skip]");
    if (skip) {
      skip.addEventListener("click", function () {
        if (self.hasUploadingMedia()) return;
        self.setStep("body");
      });
    }

    var next = root.querySelector("[data-or-review-next]");
    if (next) {
      next.addEventListener("click", function () {
        if (self.hasUploadingMedia()) return;
        if (self.state.step === "media") {
          if (
            self.countMediaByStatus("failed") > 0 &&
            self.readyMedia().length === 0
          ) {
            self.state.error =
              "Some uploads failed. Remove failed items or try again.";
            self.syncMediaLiveUi();
            return;
          }
          if (self.readyMedia().length === 0) return;
          self.setStep("body");
        }
      });
    }
  };

  ReviewModal.prototype.renderProgress = function () {
    var steps = [
      { id: "rating", label: "Rate" },
      { id: "media", label: "Photos" },
      { id: "body", label: "Review" },
      { id: "contact", label: "Details" },
    ];
    var currentIndex = STEPS.indexOf(this.state.step);
    var html =
      '<div class="or-review-modal__progress" aria-label="Review steps">' +
      '<div class="or-review-modal__progress-track" role="list">';
    for (var i = 0; i < steps.length; i += 1) {
      var state =
        i < currentIndex ? "is-done" : i === currentIndex ? "is-current" : "";
      html +=
        '<div class="or-review-modal__progress-item ' +
        state +
        '" role="listitem">' +
        '<span class="or-review-modal__progress-dot" aria-hidden="true">' +
        (i < currentIndex ? "✓" : String(i + 1)) +
        "</span>" +
        '<span class="or-review-modal__progress-label">' +
        steps[i].label +
        "</span></div>";
      if (i < steps.length - 1) {
        html +=
          '<div class="or-review-modal__progress-line' +
          (i < currentIndex ? " is-done" : "") +
          '" aria-hidden="true"></div>';
      }
    }
    html += "</div></div>";
    return html;
  };

  ReviewModal.prototype.renderHeader = function () {
    var image = this.config.productImage
      ? '<img class="or-review-modal__product-image" src="' +
        escapeHtml(this.config.productImage) +
        '" alt="" />'
      : '<div class="or-review-modal__product-image or-review-modal__product-image--empty" aria-hidden="true"></div>';

    var compact = this.state.step !== "rating";

    return (
      '<div class="or-review-modal__header' +
      (compact ? " is-compact" : "") +
      '">' +
      image +
      '<div class="or-review-modal__header-copy">' +
      '<p class="or-review-modal__eyebrow">Write a review</p>' +
      '<h2 id="or-review-modal-title" class="or-review-modal__title">' +
      escapeHtml(this.config.productTitle || "Product") +
      "</h2>" +
      (compact
        ? ""
        : '<p class="or-review-modal__subtitle">Share your experience to help other shoppers.</p>') +
      "</div></div>"
    );
  };

  ReviewModal.prototype.renderRatingChip = function () {
    if (!this.state.rating) return "";
    var labels = ["Poor", "Fair", "Good", "Great", "Excellent"];
    var stars = "";
    for (var i = 1; i <= 5; i += 1) {
      stars +=
        '<span class="or-review-modal__chip-star' +
        (i <= this.state.rating ? " is-active" : "") +
        '" aria-hidden="true">★</span>';
    }
    return (
      '<div class="or-review-modal__rating-chip" aria-label="Rated ' +
      this.state.rating +
      ' out of 5">' +
      '<span class="or-review-modal__chip-stars">' +
      stars +
      "</span>" +
      '<span class="or-review-modal__chip-text">' +
      this.state.rating +
      "/5 · " +
      labels[this.state.rating - 1] +
      "</span></div>"
    );
  };

  ReviewModal.prototype.renderStars = function (interactive) {
    var labels = ["Poor", "Fair", "Good", "Great", "Excellent"];
    var html =
      '<div class="or-review-modal__stars' +
      (interactive ? " is-interactive" : "") +
      '" role="group" aria-label="Rating">';
    for (var i = 1; i <= 5; i += 1) {
      var active = i <= this.state.rating;
      html +=
        '<button type="button" class="or-review-modal__star' +
        (active ? " is-active" : "") +
        '" data-or-review-star="' +
        i +
        '" aria-label="' +
        i +
        ' stars"' +
        (interactive ? "" : " tabindex=\"-1\" disabled") +
        ">" +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.6l2.9 5.88 6.49.94-4.7 4.58 1.11 6.47L12 17.77l-5.8 3.05 1.11-6.47-4.7-4.58 6.49-.94L12 2.6z"/></svg>' +
        "</button>";
    }
    html += "</div>";
    if (this.state.rating > 0) {
      html +=
        '<p class="or-review-modal__rating-label">' +
        '<span class="or-review-modal__rating-value">' +
        this.state.rating +
        " / 5</span>" +
        '<span class="or-review-modal__rating-word">' +
        labels[this.state.rating - 1] +
        "</span></p>";
    } else if (interactive) {
      html +=
        '<p class="or-review-modal__rating-label or-review-modal__rating-label--hint">Tap a star to rate</p>';
    }
    return html;
  };

  ReviewModal.prototype.renderStepBody = function () {
    if (this.state.step === "rating") {
      return (
        '<div class="or-review-modal__step or-review-modal__step--rating">' +
        '<p class="or-review-modal__prompt">How would you rate this product?</p>' +
        '<p class="or-review-modal__support">Your honest rating helps other customers decide.</p>' +
        this.renderStars(true) +
        "</div>"
      );
    }

    if (this.state.step === "media") {
      var progress = this.getMediaProgressState();
      var photoIcon =
        '<span class="or-review-modal__upload-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h1.2l.7-1.4A1.5 1.5 0 0 1 9.7 3h4.6a1.5 1.5 0 0 1 1.3.6L16.3 5h1.2A2.5 2.5 0 0 1 20 7.5v9A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-9Zm8 9.2a3.7 3.7 0 1 0 0-7.4 3.7 3.7 0 0 0 0 7.4Z"/></svg></span>';
      var videoIcon =
        '<span class="or-review-modal__upload-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 6.8A2.8 2.8 0 0 1 6.8 4h7.4A2.8 2.8 0 0 1 17 6.8v1.3l2.4-1.5a1.2 1.2 0 0 1 1.8 1V16.4a1.2 1.2 0 0 1-1.8 1L17 16v1.2A2.8 2.8 0 0 1 14.2 20H6.8A2.8 2.8 0 0 1 4 17.2V6.8Zm4.2 8.3 5-3.1-5-3.1v6.2Z"/></svg></span>';

      return (
        '<div class="or-review-modal__step or-review-modal__step--media">' +
        '<div class="or-review-modal__step-head">' +
        '<div class="or-review-modal__step-head-copy">' +
        '<p class="or-review-modal__prompt">Add photos or videos</p>' +
        '<p class="or-review-modal__support">Optional · up to ' +
        MAX_MEDIA_FILES +
        " files · photos compress automatically</p></div>" +
        this.renderRatingChip() +
        "</div>" +
        '<div class="or-review-modal__upload-grid">' +
        '<label class="or-review-modal__upload-card' +
        (progress.inputsDisabled ? " is-disabled" : "") +
        '">' +
        '<input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" data-or-review-upload="image" multiple hidden' +
        (progress.inputsDisabled ? " disabled" : "") +
        " />" +
        photoIcon +
        '<span class="or-review-modal__upload-copy"><strong>Photos</strong>' +
        "<span>JPEG, PNG, WebP</span></span></label>" +
        '<label class="or-review-modal__upload-card' +
        (progress.inputsDisabled ? " is-disabled" : "") +
        '">' +
        '<input type="file" accept="video/mp4,video/quicktime,video/webm" data-or-review-upload="video" multiple hidden' +
        (progress.inputsDisabled ? " disabled" : "") +
        " />" +
        videoIcon +
        '<span class="or-review-modal__upload-copy"><strong>Videos</strong>' +
        "<span>MP4, MOV, WebM</span></span></label></div>" +
        this.renderUploadProgressHtml() +
        this.renderMediaTrayHtml() +
        "</div>"
      );
    }

    if (this.state.step === "body") {
      return (
        '<div class="or-review-modal__step">' +
        '<div class="or-review-modal__step-head">' +
        '<div class="or-review-modal__step-head-copy">' +
        '<p class="or-review-modal__prompt">Tell us about your experience</p>' +
        '<p class="or-review-modal__support">What stood out? Fit, quality, shipping — anything helpful.</p></div>' +
        this.renderRatingChip() +
        "</div>" +
        '<label class="or-review-modal__field">' +
        '<span class="or-review-modal__label">Your review</span>' +
        '<textarea class="or-review-modal__textarea" rows="6" data-or-review-body placeholder="What did you like or dislike?">' +
        escapeHtml(this.state.body) +
        "</textarea></label></div>"
      );
    }

    return (
      '<div class="or-review-modal__step">' +
      '<div class="or-review-modal__step-head">' +
      '<div class="or-review-modal__step-head-copy">' +
      '<p class="or-review-modal__prompt">Almost done</p>' +
      '<p class="or-review-modal__support">We’ll only use your details for this review.</p></div>' +
      this.renderRatingChip() +
      "</div>" +
      '<div class="or-review-modal__fields">' +
      '<div class="or-review-modal__fields-row">' +
      '<label class="or-review-modal__field">' +
      '<span class="or-review-modal__label">First name <span class="or-review-modal__required">*</span></span>' +
      '<input class="or-review-modal__input" type="text" data-or-review-first-name value="' +
      escapeHtml(this.state.firstName) +
      '" required placeholder="Alex" /></label>' +
      '<label class="or-review-modal__field">' +
      '<span class="or-review-modal__label">Last name</span>' +
      '<input class="or-review-modal__input" type="text" data-or-review-last-name value="' +
      escapeHtml(this.state.lastName) +
      '" placeholder="Optional" /></label></div>' +
      '<label class="or-review-modal__field">' +
      '<span class="or-review-modal__label">Email <span class="or-review-modal__required">*</span></span>' +
      '<input class="or-review-modal__input" type="email" data-or-review-email value="' +
      escapeHtml(this.state.email) +
      '" required placeholder="you@email.com" /></label></div></div>'
    );
  };

  ReviewModal.prototype.renderFooter = function () {
    if (this.state.step === "rating") {
      return "";
    }

    var readyCount = this.readyMedia().length;
    var uploading = this.hasUploadingMedia();
    var skipHidden = this.state.step !== "media";
    var nextDisabled =
      this.state.step === "media"
        ? uploading || readyCount === 0
        : false;
    var nextLabel =
      this.state.step === "media" && uploading ? "Uploading…" : "Continue";
    var showNext = this.state.step === "body" || this.state.step === "media";
    var showSubmit = this.state.step === "contact";
    var backTarget =
      this.state.step === "media"
        ? "rating"
        : this.state.step === "body"
          ? "media"
          : this.state.step === "contact"
            ? "body"
            : "";

    return (
      '<div class="or-review-modal__footer">' +
      '<div class="or-review-modal__footer-message">' +
      (this.state.error
        ? '<p class="or-review-modal__error">' + escapeHtml(this.state.error) + "</p>"
        : "") +
      "</div>" +
      '<div class="or-review-modal__footer-actions">' +
      '<button type="button" class="or-review-modal__back" data-or-review-back="' +
      backTarget +
      '"' +
      (uploading || this.state.submitting ? " disabled" : "") +
      ">Back</button>" +
      (skipHidden
        ? ""
        : '<button type="button" class="or-review-modal__skip" data-or-review-skip' +
          (uploading ? " disabled" : "") +
          ">Skip for now</button>") +
      (showNext
        ? '<button type="button" class="or-review-modal__next" data-or-review-next' +
          (nextDisabled ? " disabled" : "") +
          ">" +
          nextLabel +
          "</button>"
        : "") +
      (showSubmit
        ? '<button type="button" class="or-review-modal__submit" data-or-review-submit' +
          (this.state.submitting || uploading ? " disabled" : "") +
          ">" +
          (this.state.submitting ? "Submitting…" : "Submit review") +
          "</button>"
        : "") +
      "</div></div>"
    );
  };

  ReviewModal.prototype.renderThanks = function () {
    var labels = ["Poor", "Fair", "Good", "Great", "Excellent"];
    var message =
      this.state.message ||
      "Your review has been submitted for approval.";
    var productImage = this.config.productImage
      ? '<img class="or-review-modal__thanks-product" src="' +
        escapeHtml(this.config.productImage) +
        '" alt="" />'
      : "";
    var ratingHtml = "";
    if (this.state.rating > 0) {
      var stars = "";
      for (var i = 1; i <= 5; i += 1) {
        stars +=
          '<span class="or-review-modal__thanks-star' +
          (i <= this.state.rating ? " is-active" : "") +
          '" aria-hidden="true">★</span>';
      }
      ratingHtml =
        '<div class="or-review-modal__thanks-rating">' +
        '<span class="or-review-modal__thanks-stars">' +
        stars +
        "</span>" +
        '<span class="or-review-modal__thanks-rating-text">' +
        this.state.rating +
        "/5 · " +
        labels[this.state.rating - 1] +
        "</span></div>";
    }

    return (
      '<div class="or-review-modal__thanks">' +
      '<div class="or-review-modal__thanks-glow" aria-hidden="true"></div>' +
      '<div class="or-review-modal__thanks-burst" aria-hidden="true">' +
      '<span></span><span></span><span></span><span></span><span></span><span></span>' +
      "</div>" +
      '<div class="or-review-modal__thanks-badge" aria-hidden="true">' +
      '<span class="or-review-modal__thanks-ring"></span>' +
      '<span class="or-review-modal__thanks-ring or-review-modal__thanks-ring--delay"></span>' +
      '<span class="or-review-modal__thanks-icon">' +
      '<svg viewBox="0 0 52 52" fill="none">' +
      '<circle cx="26" cy="26" r="24" stroke="currentColor" stroke-width="2" opacity="0.18"/>' +
      '<path class="or-review-modal__thanks-check" d="M14.5 27.2l7.2 7.2 15.8-16" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>' +
      "</svg></span></div>" +
      '<p class="or-review-modal__thanks-eyebrow">Review submitted</p>' +
      '<h2 class="or-review-modal__thanks-title">Thank you</h2>' +
      '<p class="or-review-modal__thanks-text">' +
      escapeHtml(message) +
      "</p>" +
      (productImage || ratingHtml
        ? '<div class="or-review-modal__thanks-card">' +
          productImage +
          '<div class="or-review-modal__thanks-card-copy">' +
          '<p class="or-review-modal__thanks-product-title">' +
          escapeHtml(this.config.productTitle || "Your product") +
          "</p>" +
          ratingHtml +
          "</div></div>"
        : "") +
      '<button type="button" class="or-review-modal__thanks-btn" data-or-review-close-btn>Done</button>' +
      "</div>"
    );
  };

  ReviewModal.prototype.bindThanks = function (content) {
    var self = this;
    var closeBtn = content.querySelector("[data-or-review-close-btn]");
    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        self.close();
        window.location.reload();
      });
    }
  };

  ReviewModal.prototype.bindStep = function (content) {
    var self = this;

    content.querySelectorAll("[data-or-review-star]").forEach(function (button) {
      button.addEventListener("click", function () {
        self.state.rating = Number(button.getAttribute("data-or-review-star"));
        if (self.state.step === "rating") {
          self.setStep("media");
          return;
        }
        self.render();
      });
    });

    var back = content.querySelector("[data-or-review-back]");
    if (back) {
      back.addEventListener("click", function () {
        if (self.hasUploadingMedia() || self.state.submitting) return;
        var target = back.getAttribute("data-or-review-back");
        if (target) self.setStep(target);
      });
    }

    var skip = content.querySelector("[data-or-review-skip]");
    if (skip) {
      skip.addEventListener("click", function () {
        if (self.hasUploadingMedia()) return;
        self.setStep("body");
      });
    }

    var next = content.querySelector("[data-or-review-next]");
    if (next) {
      next.addEventListener("click", function () {
        if (self.hasUploadingMedia()) return;
        if (self.state.step === "media") {
          if (
            self.countMediaByStatus("failed") > 0 &&
            self.readyMedia().length === 0
          ) {
            self.state.error =
              "Some uploads failed. Remove failed items or try again.";
            self.syncMediaLiveUi();
            return;
          }
          if (self.readyMedia().length === 0) return;
          self.setStep("body");
          return;
        }
        var bodyField = content.querySelector("[data-or-review-body]");
        self.state.body = bodyField ? bodyField.value.trim() : self.state.body;
        if (!self.state.body) {
          self.state.error = "Please write your review before continuing.";
          self.render();
          return;
        }
        self.setStep("contact");
      });
    }

    var bodyField = content.querySelector("[data-or-review-body]");
    if (bodyField) {
      bodyField.addEventListener("input", function () {
        self.state.body = bodyField.value;
      });
    }

    var submit = content.querySelector("[data-or-review-submit]");
    if (submit) {
      submit.addEventListener("click", function () {
        void self.submit(content);
      });
    }

    content.querySelectorAll("[data-or-review-upload]").forEach(function (input) {
      input.addEventListener("change", function (event) {
        var files = event.target.files ? Array.prototype.slice.call(event.target.files) : [];
        event.target.value = "";
        if (!files.length) return;
        var kind = input.getAttribute("data-or-review-upload") || "image";
        void self.uploadFiles(files, kind);
      });
    });

    content.querySelectorAll("[data-or-review-remove-media]").forEach(function (button) {
      button.addEventListener("click", function () {
        var index = Number(button.getAttribute("data-or-review-remove-media"));
        var removed = self.state.media[index];
        if (!removed || removed.status === "uploading") return;
        if (
          removed.previewUrl &&
          String(removed.previewUrl).indexOf("blob:") === 0
        ) {
          URL.revokeObjectURL(removed.previewUrl);
        }
        self.state.media.splice(index, 1);
        self.syncMediaLiveUi();
      });
    });
  };

  ReviewModal.prototype.updateMediaItem = function (localId, patch) {
    var item = this.state.media.find(function (entry) {
      return entry.localId === localId;
    });
    if (!item) return;
    Object.keys(patch).forEach(function (key) {
      item[key] = patch[key];
    });
  };

  ReviewModal.prototype.uploadFiles = async function (files, kind) {
    var remaining = MAX_MEDIA_FILES - this.state.media.length;
    if (remaining <= 0) {
      this.showToast("Limit reached. You can add up to " + MAX_MEDIA_FILES + " files.");
      return;
    }

    if (files.length > remaining) {
      this.showToast(
        "Limit reached. Only " +
          remaining +
          " more file(s) allowed (max " +
          MAX_MEDIA_FILES +
          ").",
      );
    } else {
      this.state.error = null;
    }

    var selected = files.slice(0, remaining);
    if (!selected.length) return;

    this.state.uploadBatch = {
      total: selected.length,
      completed: 0,
      failed: 0,
    };

    var queued = [];
    for (var i = 0; i < selected.length; i += 1) {
      var file = selected[i];
      var localId = this.nextLocalId();
      var previewUrl = URL.createObjectURL(file);
      var sortOrder = this.state.media.length;
      this.state.media.push({
        localId: localId,
        status: "uploading",
        mediaType: kind,
        previewUrl: previewUrl,
        publicUrl: previewUrl,
        mediaKey: null,
        sortOrder: sortOrder,
        error: null,
      });
      queued.push({ file: file, localId: localId, sortOrder: sortOrder });
    }

    this.syncMediaLiveUi();

    for (var q = 0; q < queued.length; q += 1) {
      await this.uploadFile(queued[q].file, kind, queued[q].sortOrder, queued[q].localId);
    }
  };

  ReviewModal.prototype.uploadFile = async function (file, kind, sortOrder, localId) {
    var order =
      typeof sortOrder === "number" && Number.isFinite(sortOrder)
        ? sortOrder
        : this.state.media.length;
    var id = localId || this.nextLocalId();

    if (!localId) {
      var previewUrl = URL.createObjectURL(file);
      this.state.media.push({
        localId: id,
        status: "uploading",
        mediaType: kind,
        previewUrl: previewUrl,
        publicUrl: previewUrl,
        mediaKey: null,
        sortOrder: order,
        error: null,
      });
      this.syncMediaLiveUi();
    }

    try {
      var prepared = await prepareUploadFile(file, kind);
      var uploadBlob = prepared.blob;
      var contentType = prepared.contentType || file.type || "application/octet-stream";

      if (
        kind === "image" ||
        (contentType && contentType.indexOf("image/") === 0)
      ) {
        var oldPreview = null;
        var existing = this.state.media.find(function (entry) {
          return entry.localId === id;
        });
        if (existing) oldPreview = existing.previewUrl;
        var compressedPreview = URL.createObjectURL(uploadBlob);
        this.updateMediaItem(id, {
          previewUrl: compressedPreview,
          publicUrl: compressedPreview,
        });
        if (
          oldPreview &&
          oldPreview !== compressedPreview &&
          String(oldPreview).indexOf("blob:") === 0
        ) {
          URL.revokeObjectURL(oldPreview);
        }
        this.syncMediaLiveUi();
      }

      var response = await fetch(proxyUrl(this.config.mediaEndpoint), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          shop: shopDomain(),
          upload_session_id: this.state.uploadSessionId,
          contentType: contentType,
          contentLength: uploadBlob.size,
          sortOrder: order,
        }),
      });

      var raw = await response.text();
      var data = parseJsonResponse(raw);
      if (!response.ok) {
        throw new Error(data.error || "Upload failed");
      }

      var uploadHeaders = {
        "Content-Type":
          contentType ||
          (data.headers && data.headers["Content-Type"]) ||
          "application/octet-stream",
      };
      var uploadResponse;
      try {
        uploadResponse = await fetch(data.uploadUrl, {
          method: "PUT",
          headers: uploadHeaders,
          body: uploadBlob,
        });
      } catch (networkError) {
        throw new Error(
          "Could not reach S3 (Failed to fetch). Usually missing bucket CORS, or the IAM user cannot s3:PutObject.",
        );
      }

      if (!uploadResponse.ok) {
        throw new Error(
          "S3 rejected the upload (" +
            uploadResponse.status +
            "). Check that IAM user shopify can PutObject on this bucket.",
        );
      }

      this.updateMediaItem(id, {
        status: "done",
        mediaKey: data.mediaKey,
        sortOrder: typeof data.sortOrder === "number" ? data.sortOrder : order,
        mediaType: data.mediaType || kind,
        error: null,
      });
      this.state.uploadBatch.completed += 1;
    } catch (error) {
      var message = error instanceof Error ? error.message : "Upload failed";
      this.updateMediaItem(id, { status: "failed", error: message });
      this.state.uploadBatch.failed += 1;
      this.state.error = message;
    } finally {
      this.syncMediaLiveUi();
    }
  };

  ReviewModal.prototype.submit = async function (content) {
    var firstNameField = content.querySelector("[data-or-review-first-name]");
    var lastNameField = content.querySelector("[data-or-review-last-name]");
    var emailField = content.querySelector("[data-or-review-email]");

    this.state.firstName = firstNameField ? firstNameField.value.trim() : "";
    this.state.lastName = lastNameField ? lastNameField.value.trim() : "";
    this.state.email = emailField ? emailField.value.trim() : "";

    if (!this.state.firstName) {
      this.state.error = "First name is required.";
      this.render();
      return;
    }

    if (!this.state.email) {
      this.state.error = "Email is required.";
      this.render();
      return;
    }

    if (this.hasUploadingMedia()) {
      this.state.error = "Please wait for uploads to finish.";
      this.render();
      return;
    }

    this.state.submitting = true;
    this.state.error = null;
    this.render();

    try {
      var response = await fetch(proxyUrl(this.config.submitEndpoint), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          shop: shopDomain(),
          product_id: this.config.productId,
          upload_session_id: this.state.uploadSessionId,
          rating: this.state.rating,
          body: this.state.body,
          first_name: this.state.firstName,
          last_name: this.state.lastName,
          email: this.state.email,
          media: this.readyMedia().map(function (item) {
            return {
              mediaKey: item.mediaKey,
              sortOrder: item.sortOrder,
              mediaType: item.mediaType,
            };
          }),
        }),
      });

      var raw = await response.text();
      var data = parseJsonResponse(raw);
      if (!response.ok) {
        throw new Error(data.error || "Submission failed");
      }

      this.state.message = data.message || "Thank you! Your review has been submitted.";
      this.state.step = "thanks";
      this.state.submitting = false;
      this.render();
    } catch (error) {
      this.state.submitting = false;
      this.state.error = error instanceof Error ? error.message : "Submission failed";
      this.render();
    }
  };

  function readConfig(button) {
    var root = button.closest("[data-outrage-customer-say]");
    if (!root) return null;

    return {
      productId: root.getAttribute("data-product-id"),
      productTitle: root.getAttribute("data-product-title") || "Product",
      productImage: root.getAttribute("data-product-image") || "",
      submitEndpoint:
        root.getAttribute("data-submit-endpoint") || "/apps/outrage-reviews/submit-review",
      mediaEndpoint:
        root.getAttribute("data-media-endpoint") || "/apps/outrage-reviews/review-media",
    };
  }

  function bindWriteReviewButtons() {
    document.querySelectorAll("[data-outrage-write-review]").forEach(function (button) {
      if (button.getAttribute("data-outrage-modal-bound") === "true") return;
      button.setAttribute("data-outrage-modal-bound", "true");

      button.addEventListener("click", function (event) {
        event.preventDefault();
        var config = readConfig(button);
        if (!config || !config.productId) return;
        var modal = new ReviewModal(config);
        modal.open();
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindWriteReviewButtons);
  } else {
    bindWriteReviewButtons();
  }

  document.addEventListener("shopify:section:load", bindWriteReviewButtons);
})();
