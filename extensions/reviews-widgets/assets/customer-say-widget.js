(function () {
  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function starsHtml(rating, starColor) {
    var value = Math.max(0, Math.min(5, Number(rating) || 0));
    var color = starColor || "#F5A623";
    var html =
      '<span class="or-star-row" style="--or-star-color:' +
      escapeHtml(color) +
      ';" role="img" aria-label="' +
      value.toFixed(1) +
      ' out of 5 stars">';
    for (var i = 1; i <= 5; i += 1) {
      var cls = i <= Math.round(value) ? "or-star or-star--full" : "or-star or-star--empty";
      html += '<span class="' + cls + '" aria-hidden="true">★</span>';
    }
    html += "</span>";
    return html;
  }

  function formatMonth(iso) {
    try {
      return new Date(iso).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });
    } catch (error) {
      return "";
    }
  }

  function buildEndpoint(base, productId, params) {
    var url = new URL(base, window.location.origin);
    url.searchParams.set("product_id", String(productId));
    Object.keys(params || {}).forEach(function (key) {
      url.searchParams.set(key, String(params[key]));
    });
    var shop =
      window.Shopify && window.Shopify.shop
        ? window.Shopify.shop
        : window.location.hostname;
    if (url.pathname.indexOf("/apps/") === -1) {
      url.searchParams.set("shop", shop);
    }
    return url.toString();
  }

  function renderHighlights(container, highlights) {
    if (!highlights || !highlights.length) {
      container.hidden = true;
      container.innerHTML = "";
      return;
    }

    container.hidden = false;
    container.innerHTML = highlights
      .map(function (item) {
        return (
          '<span class="or-customer-say__tag">' +
          escapeHtml(item.label) +
          " <strong>" +
          escapeHtml(item.count) +
          "</strong></span>"
        );
      })
      .join("");
  }

  function renderSnippets(container, snippets, starColor) {
    if (!snippets || !snippets.length) {
      container.hidden = true;
      container.innerHTML = "";
      return;
    }

    container.hidden = false;
    container.innerHTML = snippets
      .map(function (snippet) {
        return (
          '<article class="or-customer-say__snippet">' +
          '<p class="or-customer-say__quote">“' +
          escapeHtml(snippet.quote) +
          '”</p>' +
          '<div class="or-customer-say__snippet-meta">' +
          '<span class="or-customer-say__author">' +
          escapeHtml(snippet.reviewerName || "Customer") +
          "</span>" +
          starsHtml(snippet.rating, starColor) +
          (snippet.isVerifiedPurchase
            ? '<span class="or-customer-say__verified-badge">Verified</span>'
            : "") +
          "</div>" +
          "</article>"
        );
      })
      .join("");
  }

  function renderReviews(container, reviews, starColor) {
    if (!reviews || !reviews.length) {
      return false;
    }

    var html = reviews
      .map(function (review) {
        return (
          '<article class="or-customer-say__review-card">' +
          '<div class="or-customer-say__review-top">' +
          '<span class="or-customer-say__review-name">' +
          escapeHtml(review.reviewerName || "Customer") +
          "</span>" +
          starsHtml(review.rating, starColor) +
          (review.isVerifiedPurchase
            ? '<span class="or-customer-say__verified-badge">Verified</span>'
            : "") +
          "</div>" +
          (review.title
            ? '<p class="or-customer-say__review-title">' +
              escapeHtml(review.title) +
              "</p>"
            : "") +
          (review.body
            ? '<p class="or-customer-say__review-body">' +
              escapeHtml(review.body) +
              "</p>"
            : "") +
          "</article>"
        );
      })
      .join("");

    container.insertAdjacentHTML("beforeend", html);
    return true;
  }

  function updateReviewsEmptyState(root, visible) {
    var empty = root.querySelector("[data-outrage-reviews-empty]");
    if (empty) empty.hidden = !visible;
  }

  function updateReviewsError(root, message) {
    var error = root.querySelector("[data-outrage-reviews-error]");
    if (!error) return;
    if (message) {
      error.textContent = message;
      error.hidden = false;
    } else {
      error.textContent = "";
      error.hidden = true;
    }
  }

  function setListingExpanded(root, expanded, reviewCount) {
    var listing = root.querySelector("[data-outrage-listing]");
    var toggle = root.querySelector("[data-outrage-toggle-reviews]");
    var actions = root.querySelector("[data-outrage-actions]");
    var readAll = root.querySelector("[data-outrage-read-all]");
    var hasReviews = Number(reviewCount || 0) > 0;

    if (listing) listing.hidden = !(expanded && hasReviews);

    if (toggle) {
      toggle.textContent = "Hide reviews";
      toggle.hidden = !(expanded && hasReviews);
    }

    if (actions) {
      actions.hidden = expanded || !hasReviews;
    }
    if (readAll && hasReviews) {
      readAll.textContent =
        "Read all " + Number(reviewCount).toLocaleString() + " reviews";
    }
  }

  async function fetchPayload(root, params) {
    var productId = root.getAttribute("data-product-id");
    var endpoint = root.getAttribute("data-endpoint");
    if (!productId || !endpoint) {
      throw new Error("Missing widget configuration");
    }

    var url = buildEndpoint(endpoint, productId, params);
    var headers = { Accept: "application/json" };
    if (/ngrok/i.test(url)) {
      headers["ngrok-skip-browser-warning"] = "69420";
    }

    var response = await fetch(url, { headers: headers });
    var raw = await response.text();
    var data;

    try {
      data = raw ? JSON.parse(raw) : {};
    } catch (error) {
      if (/^You are about to visit/i.test(raw)) {
        throw new Error(
          "Ngrok browser warning blocked the request. Clear “App URL” in the block settings and use the app proxy instead.",
        );
      }
      throw new Error(
        "App returned invalid JSON. Check that the app is running and app proxy is configured.",
      );
    }

    if (!response.ok) {
      throw new Error(data.error || "Failed to load customer summary");
    }
    return data;
  }

  function applySummary(root, data, starColor) {
    var average = root.querySelector("[data-outrage-average]");
    var scoreStars = root.querySelector("[data-outrage-score-stars]");
    var verified = root.querySelector("[data-outrage-verified-count]");
    var summaryText = root.querySelector("[data-outrage-summary-text]");
    var summaryMeta = root.querySelector("[data-outrage-summary-meta]");
    var highlights = root.querySelector("[data-outrage-highlights]");
    var snippets = root.querySelector("[data-outrage-snippets]");

    var rating = data.rating == null ? null : Number(data.rating);
    if (average) {
      average.textContent =
        rating == null || Number.isNaN(rating) ? "—" : rating.toFixed(1);
    }
    if (scoreStars) {
      scoreStars.innerHTML = starsHtml(rating || 0, starColor);
    }
    if (verified) {
      var verifiedCount = Number(data.verifiedCount || 0);
      verified.textContent =
        verifiedCount.toLocaleString() +
        " verified review" +
        (verifiedCount === 1 ? "" : "s");
    }
    if (summaryText) {
      summaryText.textContent = data.summaryText || "No summary available yet.";
    }
    if (summaryMeta) {
      var month =
        data.summaryMonthLabel ||
        formatMonth(data.summaryGeneratedAt) ||
        "";
      summaryMeta.textContent =
        "Summarised from " +
        Number(data.summarySourceCount || 0).toLocaleString() +
        " recent verified reviews" +
        (month ? " • " + month : "");
      summaryMeta.hidden = false;
    }
    if (highlights) renderHighlights(highlights, data.highlights || []);
    if (snippets) renderSnippets(snippets, data.snippets || [], starColor);
  }

  async function hydrate(root) {
    var reviewsList = root.querySelector("[data-outrage-reviews-list]");
    var loadMore = root.querySelector("[data-outrage-load-more]");
    var toggle = root.querySelector("[data-outrage-toggle-reviews]");
    var readAll = root.querySelector("[data-outrage-read-all]");
    var listing = root.querySelector("[data-outrage-listing]");
    var pageSize = Number(root.getAttribute("data-reviews-page-size") || 10);
    var starColor = root.getAttribute("data-star-color") || "#F5A623";
    var state = {
      offset: 0,
      hasMore: false,
      loading: false,
      failed: false,
      expanded: true,
      reviewCount: 0,
      loadedOnce: false,
    };

    function syncToggleUi() {
      setListingExpanded(root, state.expanded, state.reviewCount);
    }

    async function loadReviews(append) {
      if (state.loading) return;
      state.loading = true;
      state.failed = false;
      updateReviewsError(root, null);
      if (loadMore) {
        loadMore.hidden = false;
        loadMore.disabled = true;
        loadMore.textContent = "Loading…";
      }

      try {
        var data = await fetchPayload(root, {
          include_reviews: "true",
          reviews_offset: String(state.offset),
          reviews_limit: String(pageSize),
        });

        var batch = data.reviews || [];

        if (!append) {
          applySummary(root, data, starColor);
          state.reviewCount = Math.max(
            Number(data.count || 0),
            Number(data.reviewsTotal || 0),
            batch.length,
          );
        }

        if (reviewsList) {
          if (!append) reviewsList.innerHTML = "";
          renderReviews(reviewsList, batch, starColor);
          if (!append) {
            updateReviewsEmptyState(root, batch.length === 0);
          }
        }

        state.offset += batch.length;
        state.hasMore = Boolean(data.hasMoreReviews);
        state.loadedOnce = true;
        state.reviewCount = Math.max(state.reviewCount, state.offset);

        if (loadMore) {
          loadMore.hidden = !state.hasMore;
          loadMore.disabled = false;
          loadMore.textContent = "Load more reviews";
        }

        // Always show listing when published reviews exist
        state.expanded = state.reviewCount > 0;
        syncToggleUi();

        root._outrageCustomerSay = {
          count: state.reviewCount,
          pageSize: pageSize,
          state: state,
        };
      } catch (error) {
        state.failed = true;
        var message =
          error instanceof Error ? error.message : "Unable to load reviews";
        if (!append) {
          var summaryText = root.querySelector("[data-outrage-summary-text]");
          if (summaryText) summaryText.textContent = message;
          updateReviewsEmptyState(root, false);
          updateReviewsError(root, message);
          state.expanded = true;
          if (listing) listing.hidden = false;
          if (toggle) {
            toggle.hidden = false;
            toggle.textContent = "Hide reviews";
          }
        }
        if (loadMore) {
          loadMore.hidden = false;
          loadMore.disabled = false;
          loadMore.textContent = "Try again";
        }
      } finally {
        state.loading = false;
      }
    }

    function toggleExpanded() {
      if (state.reviewCount <= 0 && state.offset <= 0) return;
      state.expanded = !state.expanded;
      syncToggleUi();
      if (state.expanded && !state.loadedOnce) {
        loadReviews(false);
      }
    }

    function retryOrLoadMore() {
      if (state.failed) {
        state.offset = 0;
        loadReviews(false);
        return;
      }
      if (state.hasMore) {
        loadReviews(true);
      }
    }

    if (toggle) toggle.addEventListener("click", toggleExpanded);
    if (readAll) readAll.addEventListener("click", toggleExpanded);
    if (loadMore) loadMore.addEventListener("click", retryOrLoadMore);

    await loadReviews(false);
  }

  function init() {
    document.querySelectorAll("[data-outrage-customer-say]").forEach(function (root) {
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
