(function () {
  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function starsHtml(rating) {
    var value = Math.max(0, Math.min(5, Number(rating) || 0));
    var html =
      '<span class="or-star-row" role="img" aria-label="' +
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
      return new Date(iso).toLocaleDateString(undefined, {
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
    if (url.pathname.indexOf("/apps/") === -1) {
      url.searchParams.set(
        "shop",
        window.Shopify && window.Shopify.shop ? window.Shopify.shop : window.location.hostname,
      );
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
          ' <strong>' +
          escapeHtml(item.count) +
          "</strong></span>"
        );
      })
      .join("");
  }

  function renderSnippets(container, snippets) {
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
          starsHtml(snippet.rating) +
          (snippet.isVerifiedPurchase
            ? '<span class="or-customer-say__verified-badge">Verified</span>'
            : "") +
          "</div>" +
          "</article>"
        );
      })
      .join("");
  }

  function renderReviews(container, reviews) {
    if (!reviews || !reviews.length) {
      return;
    }

    var html = reviews
      .map(function (review) {
        return (
          '<article class="or-customer-say__review">' +
          '<div class="or-customer-say__review-top">' +
          '<span class="or-customer-say__author">' +
          escapeHtml(review.reviewerName || "Customer") +
          "</span>" +
          starsHtml(review.rating) +
          (review.isVerifiedPurchase
            ? '<span class="or-customer-say__verified-badge">Verified</span>'
            : "") +
          "</div>" +
          (review.title
            ? '<h3 class="or-customer-say__review-title">' + escapeHtml(review.title) + "</h3>"
            : "") +
          (review.body
            ? '<p class="or-customer-say__review-body">' + escapeHtml(review.body) + "</p>"
            : "") +
          "</article>"
        );
      })
      .join("");

    container.insertAdjacentHTML("beforeend", html);
  }

  async function fetchPayload(root, params) {
    var productId = root.getAttribute("data-product-id");
    var endpoint = root.getAttribute("data-endpoint");
    if (!productId || !endpoint) {
      throw new Error("Missing widget configuration");
    }

    var response = await fetch(buildEndpoint(endpoint, productId, params), {
      headers: { Accept: "application/json" },
    });
    var data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Failed to load customer summary");
    }
    return data;
  }

  function applySummary(root, data) {
    var average = root.querySelector("[data-outrage-average]");
    var verified = root.querySelector("[data-outrage-verified-count]");
    var summaryText = root.querySelector("[data-outrage-summary-text]");
    var summaryMeta = root.querySelector("[data-outrage-summary-meta]");
    var readAll = root.querySelector("[data-outrage-read-all]");
    var highlights = root.querySelector("[data-outrage-highlights]");
    var snippets = root.querySelector("[data-outrage-snippets]");

    if (average && data.rating != null) {
      average.textContent = Number(data.rating).toFixed(2);
    }
    if (verified) {
      verified.textContent =
        (data.verifiedCount || data.count || 0).toLocaleString() + " verified reviews";
    }
    if (summaryText) {
      summaryText.textContent = data.summaryText || "No summary available yet.";
    }
    if (summaryMeta) {
      var month = formatMonth(data.summaryGeneratedAt);
      summaryMeta.textContent =
        "Summarised from " +
        (data.summarySourceCount || 0).toLocaleString() +
        " recent verified reviews" +
        (month ? " • " + month : "");
      summaryMeta.hidden = false;
    }
    if (readAll) {
      readAll.textContent =
        "Read all " + (data.count || 0).toLocaleString() + " reviews";
      readAll.hidden = !(data.count > 0);
    }
    if (highlights) renderHighlights(highlights, data.highlights || []);
    if (snippets) renderSnippets(snippets, data.snippets || []);
  }

  async function hydrate(root) {
    var reviewsPanel = root.querySelector("[data-outrage-reviews-panel]");
    var reviewsList = root.querySelector("[data-outrage-reviews-list]");
    var loadMore = root.querySelector("[data-outrage-load-more]");
    var readAll = root.querySelector("[data-outrage-read-all]");
    var pageSize = Number(root.getAttribute("data-reviews-page-size") || 10);
    var state = {
      offset: 0,
      hasMore: false,
      loading: false,
      expanded: false,
    };

    try {
      var initial = await fetchPayload(root, {});
      applySummary(root, initial);
      root._outrageCustomerSay = { count: initial.count || 0, pageSize: pageSize, state: state };
    } catch (error) {
      var summaryText = root.querySelector("[data-outrage-summary-text]");
      if (summaryText) {
        summaryText.textContent =
          error instanceof Error ? error.message : "Unable to load customer summary";
      }
      return;
    }

    async function loadReviews(append) {
      if (state.loading) return;
      state.loading = true;
      if (loadMore) {
        loadMore.disabled = true;
        loadMore.textContent = "Loading…";
      }

      try {
        var data = await fetchPayload(root, {
          include_reviews: "true",
          reviews_offset: String(state.offset),
          reviews_limit: String(pageSize),
        });

        if (reviewsList) {
          if (!append) reviewsList.innerHTML = "";
          renderReviews(reviewsList, data.reviews || []);
        }

        state.offset += (data.reviews || []).length;
        state.hasMore = Boolean(data.hasMoreReviews);

        if (loadMore) {
          loadMore.hidden = !state.hasMore;
          loadMore.disabled = false;
          loadMore.textContent = "Load more reviews";
        }
      } catch (error) {
        if (loadMore) {
          loadMore.hidden = false;
          loadMore.disabled = false;
          loadMore.textContent = "Try again";
        }
      } finally {
        state.loading = false;
      }
    }

    if (readAll) {
      readAll.addEventListener("click", function () {
        state.expanded = !state.expanded;
        if (reviewsPanel) reviewsPanel.hidden = !state.expanded;
        readAll.textContent = state.expanded
          ? "Hide reviews"
          : "Read all " + (root._outrageCustomerSay.count || 0).toLocaleString() + " reviews";

        if (state.expanded && reviewsList && !reviewsList.childElementCount) {
          state.offset = 0;
          loadReviews(false);
        }
      });
    }

    if (loadMore) {
      loadMore.addEventListener("click", function () {
        if (state.hasMore) loadReviews(true);
      });
    }
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
