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
      uploading: 0,
      submitting: false,
      error: null,
      message: null,
    };
    this.overlay = null;
  }

  ReviewModal.prototype.open = function () {
    if (this.overlay) return;
    this.overlay = document.createElement("div");
    this.overlay.className = "or-review-modal";
    this.overlay.innerHTML =
      '<div class="or-review-modal__backdrop" data-or-review-close></div>' +
      '<div class="or-review-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="or-review-modal-title">' +
      '<button type="button" class="or-review-modal__close" data-or-review-close aria-label="Close">&times;</button>' +
      '<div class="or-review-modal__content" data-or-review-content></div>' +
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
    if (this.overlay) {
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
    if (!content) return;

    if (this.state.step === "thanks") {
      content.innerHTML = this.renderThanks();
      this.bindThanks(content);
      return;
    }

    content.innerHTML =
      this.renderHeader() +
      this.renderStepBody() +
      this.renderFooter();

    this.bindStep(content);
  };

  ReviewModal.prototype.renderHeader = function () {
    var image = this.config.productImage
      ? '<img class="or-review-modal__product-image" src="' +
        escapeHtml(this.config.productImage) +
        '" alt="" />'
      : '<div class="or-review-modal__product-image or-review-modal__product-image--empty"></div>';

    return (
      '<div class="or-review-modal__header">' +
      image +
      '<div><p class="or-review-modal__eyebrow">Write a review</p>' +
      '<h2 id="or-review-modal-title" class="or-review-modal__title">' +
      escapeHtml(this.config.productTitle || "Product") +
      "</h2></div></div>"
    );
  };

  ReviewModal.prototype.renderStars = function (interactive) {
    var html = '<div class="or-review-modal__stars" role="group" aria-label="Rating">';
    for (var i = 1; i <= 5; i += 1) {
      var active = i <= this.state.rating;
      html +=
        '<button type="button" class="or-review-modal__star' +
        (active ? " is-active" : "") +
        '" data-or-review-star="' +
        i +
        '" aria-label="' +
        i +
        ' stars">' +
        "★</button>";
    }
    html += "</div>";
    if (!interactive && this.state.rating > 0) {
      html +=
        '<p class="or-review-modal__rating-label">' +
        this.state.rating +
        " out of 5</p>";
    }
    return html;
  };

  ReviewModal.prototype.renderStepBody = function () {
    if (this.state.step === "rating") {
      return (
        '<div class="or-review-modal__step">' +
        '<p class="or-review-modal__prompt">How would you rate this product?</p>' +
        this.renderStars(true) +
        "</div>"
      );
    }

    if (this.state.step === "media") {
      var previews = this.state.media
        .map(function (item, index) {
          var label = item.mediaType === "video" ? "Video" : "Photo";
          return (
            '<div class="or-review-modal__media-preview">' +
            (item.mediaType === "video"
              ? '<div class="or-review-modal__media-video">Video added</div>'
              : '<img src="' + escapeHtml(item.publicUrl) + '" alt="" />') +
            '<button type="button" class="or-review-modal__media-remove" data-or-review-remove-media="' +
            index +
            '" aria-label="Remove ' +
            label +
            '">&times;</button></div>'
          );
        })
        .join("");

      return (
        '<div class="or-review-modal__step">' +
        '<p class="or-review-modal__prompt">Add a photo or video (optional)</p>' +
        this.renderStars(false) +
        '<div class="or-review-modal__upload-grid">' +
        '<label class="or-review-modal__upload-card">' +
        '<input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" data-or-review-upload="image" hidden />' +
        '<span class="or-review-modal__upload-icon">📷</span>' +
        "<strong>Upload a photo</strong>" +
        "<span>JPEG, PNG, WebP</span></label>" +
        '<label class="or-review-modal__upload-card">' +
        '<input type="file" accept="video/mp4,video/quicktime,video/webm" data-or-review-upload="video" hidden />' +
        '<span class="or-review-modal__upload-icon">🎬</span>' +
        "<strong>Upload a video</strong>" +
        "<span>MP4, MOV, WebM</span></label></div>" +
        (previews ? '<div class="or-review-modal__media-previews">' + previews + "</div>" : "") +
        (this.state.uploading > 0
          ? '<p class="or-review-modal__hint">Uploading…</p>'
          : "") +
        "</div>"
      );
    }

    if (this.state.step === "body") {
      return (
        '<div class="or-review-modal__step">' +
        '<p class="or-review-modal__prompt">Tell us about your experience</p>' +
        this.renderStars(false) +
        '<label class="or-review-modal__field">' +
        '<span class="or-review-modal__label">Your review</span>' +
        '<textarea class="or-review-modal__textarea" rows="5" data-or-review-body placeholder="What did you like or dislike?">' +
        escapeHtml(this.state.body) +
        "</textarea></label></div>"
      );
    }

    return (
      '<div class="or-review-modal__step">' +
      '<p class="or-review-modal__prompt">Almost done — tell us who you are</p>' +
      this.renderStars(false) +
      '<div class="or-review-modal__fields">' +
      '<label class="or-review-modal__field">' +
      '<span class="or-review-modal__label">First name <span class="or-review-modal__required">*</span></span>' +
      '<input class="or-review-modal__input" type="text" data-or-review-first-name value="' +
      escapeHtml(this.state.firstName) +
      '" required /></label>' +
      '<label class="or-review-modal__field">' +
      '<span class="or-review-modal__label">Last name</span>' +
      '<input class="or-review-modal__input" type="text" data-or-review-last-name value="' +
      escapeHtml(this.state.lastName) +
      '" /></label>' +
      '<label class="or-review-modal__field">' +
      '<span class="or-review-modal__label">Email <span class="or-review-modal__required">*</span></span>' +
      '<input class="or-review-modal__input" type="email" data-or-review-email value="' +
      escapeHtml(this.state.email) +
      '" required /></label></div></div>'
    );
  };

  ReviewModal.prototype.renderFooter = function () {
    var hasMedia = this.state.media.length > 0;
    var skipHidden = this.state.step !== "media";
    var nextLabel = "Next";
    var showNext = this.state.step === "body" || (this.state.step === "media" && hasMedia);
    var showSubmit = this.state.step === "contact";

    return (
      '<div class="or-review-modal__footer">' +
      (this.state.error
        ? '<p class="or-review-modal__error">' + escapeHtml(this.state.error) + "</p>"
        : "") +
      '<div class="or-review-modal__footer-actions">' +
      (skipHidden
        ? ""
        : '<button type="button" class="or-review-modal__skip" data-or-review-skip>Skip</button>') +
      (showNext
        ? '<button type="button" class="or-review-modal__next" data-or-review-next>' +
          nextLabel +
          "</button>"
        : "") +
      (showSubmit
        ? '<button type="button" class="or-review-modal__submit" data-or-review-submit>' +
          (this.state.submitting ? "Submitting…" : "Submit") +
          "</button>"
        : "") +
      "</div></div>"
    );
  };

  ReviewModal.prototype.renderThanks = function () {
    return (
      '<div class="or-review-modal__thanks">' +
      '<div class="or-review-modal__thanks-icon">✓</div>' +
      '<h2 class="or-review-modal__thanks-title">Thank you!</h2>' +
      '<p class="or-review-modal__thanks-text">' +
      escapeHtml(this.state.message || "Your review has been submitted.") +
      "</p>" +
      '<button type="button" class="or-review-modal__submit" data-or-review-close-btn>Close</button></div>'
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

    var skip = content.querySelector("[data-or-review-skip]");
    if (skip) {
      skip.addEventListener("click", function () {
        self.setStep("body");
      });
    }

    var next = content.querySelector("[data-or-review-next]");
    if (next) {
      next.addEventListener("click", function () {
        if (self.state.step === "media") {
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
        var file = event.target.files && event.target.files[0];
        event.target.value = "";
        if (!file) return;
        var kind = input.getAttribute("data-or-review-upload") || "image";
        void self.uploadFile(file, kind);
      });
    });

    content.querySelectorAll("[data-or-review-remove-media]").forEach(function (button) {
      button.addEventListener("click", function () {
        var index = Number(button.getAttribute("data-or-review-remove-media"));
        self.state.media.splice(index, 1);
        self.render();
      });
    });
  };

  ReviewModal.prototype.uploadFile = async function (file, kind) {
    if (this.state.media.length >= 5) {
      this.state.error = "You can add up to 5 files.";
      this.render();
      return;
    }

    this.state.uploading += 1;
    this.state.error = null;
    this.render();

    try {
      var response = await fetch(proxyUrl(this.config.mediaEndpoint), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          shop: shopDomain(),
          upload_session_id: this.state.uploadSessionId,
          contentType: file.type,
          contentLength: file.size,
          sortOrder: this.state.media.length,
        }),
      });

      var raw = await response.text();
      var data = parseJsonResponse(raw);
      if (!response.ok) {
        throw new Error(data.error || "Upload failed");
      }

      var uploadResponse = await fetch(data.uploadUrl, {
        method: "PUT",
        headers: data.headers,
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error("Direct upload failed");
      }

      this.state.media.push({
        mediaKey: data.mediaKey,
        publicUrl: data.publicUrl,
        sortOrder: data.sortOrder,
        mediaType: data.mediaType || kind,
      });
    } catch (error) {
      this.state.error = error instanceof Error ? error.message : "Upload failed";
    } finally {
      this.state.uploading = Math.max(0, this.state.uploading - 1);
      this.render();
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
          media: this.state.media.map(function (item) {
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
