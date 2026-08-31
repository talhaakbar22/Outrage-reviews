(function () {
  function starsHtml(rating) {
    var value = Math.max(0, Math.min(5, Number(rating) || 0));
    var html = '<span class="or-star-row" role="img" aria-label="' + value.toFixed(1) + ' out of 5 stars">';
    for (var i = 1; i <= 5; i += 1) {
      var cls = i <= Math.round(value) ? "or-star or-star--full" : "or-star or-star--empty";
      html += '<span class="' + cls + '" aria-hidden="true">★</span>';
    }
    html += "</span>";
    return html;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function buildEndpoint(base, productId, limit) {
    var url = new URL(base, window.location.origin);
    url.searchParams.set("product_id", String(productId));
    url.searchParams.set("limit", String(limit || 10));
    // Direct API calls need shop; app proxy injects it.
    if (url.pathname.indexOf("/apps/") === -1) {
      url.searchParams.set("shop", window.Shopify && window.Shopify.shop ? window.Shopify.shop : window.location.hostname);
    }
    return url.toString();
  }

  function renderPhotos(container, reviews) {
    var photos = [];
    reviews.forEach(function (review) {
      (review.media || []).forEach(function (item) {
        if (item.type === "image" || !item.type) {
          photos.push(item);
        }
      });
    });

    if (!photos.length) {
      container.hidden = true;
      container.innerHTML = "";
      return;
    }

    container.hidden = false;
    container.innerHTML = photos
      .slice(0, 12)
      .map(function (item) {
        var src = item.thumbnailUrl || item.url;
        return (
          '<a class="or-reviews__photo" href="' +
          escapeHtml(item.url) +
          '" target="_blank" rel="noreferrer">' +
          '<img src="' +
          escapeHtml(src) +
          '" alt="Customer review photo" loading="lazy" />' +
          "</a>"
        );
      })
      .join("");
  }

  function renderReviews(container, reviews) {
    if (!reviews.length) {
      container.innerHTML = '<p class="or-reviews__empty">No published reviews yet.</p>';
      return;
    }

    container.innerHTML = reviews
      .map(function (review) {
        var media =
          (review.media || []).length > 0
            ? '<div class="or-review__media">' +
              review.media
                .map(function (item) {
                  var src = item.thumbnailUrl || item.url;
                  return (
                    '<a href="' +
                    escapeHtml(item.url) +
                    '" target="_blank" rel="noreferrer">' +
                    '<img src="' +
                    escapeHtml(src) +
                    '" alt="" loading="lazy" />' +
                    "</a>"
                  );
                })
                .join("") +
              "</div>"
            : "";

        return (
          '<article class="or-review">' +
          '<div class="or-review__top">' +
          starsHtml(review.rating) +
          '<span class="or-review__author">' +
          escapeHtml(review.reviewerName || "Customer") +
          "</span>" +
          (review.isVerifiedPurchase
            ? '<span class="or-review__badge">Verified purchase</span>'
            : "") +
          "</div>" +
          (review.title
            ? '<h3 class="or-review__title">' + escapeHtml(review.title) + "</h3>"
            : "") +
          (review.body
            ? '<p class="or-review__body">' + escapeHtml(review.body) + "</p>"
            : "") +
          media +
          "</article>"
        );
      })
      .join("");
  }

  async function hydrate(root) {
    var productId = root.getAttribute("data-product-id");
    var endpoint = root.getAttribute("data-endpoint");
    var limit = root.getAttribute("data-limit");
    var showPhotos = root.getAttribute("data-show-photos") !== "false";
    var list = root.querySelector("[data-outrage-list]");
    var photos = root.querySelector("[data-outrage-photos]");

    if (!productId || !endpoint || !list) return;

    try {
      var response = await fetch(buildEndpoint(endpoint, productId, limit), {
        headers: { Accept: "application/json" },
      });
      var data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to load reviews");
      }

      renderReviews(list, data.reviews || []);
      if (showPhotos && photos) {
        renderPhotos(photos, data.reviews || []);
      }
    } catch (error) {
      list.innerHTML =
        '<p class="or-reviews__error">' +
        escapeHtml(error instanceof Error ? error.message : "Unable to load reviews") +
        "</p>";
    }
  }

  function init() {
    document.querySelectorAll("[data-outrage-reviews]").forEach(function (root) {
      if (root.getAttribute("data-outrage-hydrated") === "true") return;
      root.setAttribute("data-outrage-hydrated", "true");
      hydrate(root);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  document.addEventListener("shopify:section:load", init);
})();
