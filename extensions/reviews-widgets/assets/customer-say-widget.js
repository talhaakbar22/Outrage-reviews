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

  function formatReviewDate(iso) {
    if (iso == null || iso === "") return "";
    try {
      var value = iso;
      if (typeof iso === "object") {
        if (iso.epochMilliseconds != null) value = Number(iso.epochMilliseconds);
        else if (typeof iso.toString === "function") value = iso.toString();
      }
      var date = new Date(value);
      if (Number.isNaN(date.getTime())) return "";
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
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

  function isVideoMedia(item) {
    if (!item) return false;
    if (
      String(item.type || "")
        .toLowerCase()
        .indexOf("video") >= 0
    ) {
      return true;
    }
    return /\.(mp4|mov|webm|m4v)(\?|$)/i.test(String(item.url || ""));
  }

  function renderReviewMedia(media) {
    if (!media || !media.length) return "";

    var first = media[0];
    var second = media[1];
    var remainingAfterFirst = media.length - 1;
    var showMoreOverlay = media.length > 2;

    function thumbHtml(item, index, overlayHtml) {
      var src = item.thumbnailUrl || item.url;
      if (!src && !item.url) return "";
      var href = escapeHtml(item.url || src);
      var video = isVideoMedia(item);
      var mediaInner = video
        ? '<video src="' +
          escapeHtml(item.url || src) +
          '" muted playsinline preload="metadata"></video>'
        : '<img src="' + escapeHtml(src) + '" alt="" loading="lazy" />';
      var defaultOverlay =
        video && !overlayHtml
          ? '<span class="or-customer-say__media-play" aria-hidden="true">▶</span>'
          : "";

      return (
        '<a class="or-customer-say__media-item' +
        (video ? " is-video" : "") +
        '" href="' +
        href +
        '" target="_blank" rel="noreferrer" aria-label="Open review media ' +
        (index + 1) +
        '">' +
        mediaInner +
        (overlayHtml || defaultOverlay) +
        "</a>"
      );
    }

    return (
      '<div class="or-customer-say__review-media">' +
      thumbHtml(first, 0, null) +
      (second
        ? thumbHtml(
            second,
            1,
            showMoreOverlay
              ? '<span class="or-customer-say__media-more">+' +
                  remainingAfterFirst +
                  " more</span>"
              : null,
          )
        : "") +
      "</div>"
    );
  }

  function getStoreReplies(review) {
    var list = [];
    if (Array.isArray(review.replies) && review.replies.length) {
      list = review.replies
        .map(function (reply) {
          return {
            body: String(reply.body || "").trim(),
            authorName: reply.authorName || reply.author_name || "Store team",
            publishedAt: reply.publishedAt || reply.published_at || "",
          };
        })
        .filter(function (reply) {
          return Boolean(reply.body);
        });
    }

    if (!list.length) {
      var fallback = String(
        review.merchantReply || review.merchant_reply || "",
      ).trim();
      if (fallback) {
        list = [
          {
            body: fallback,
            authorName: "Store team",
            publishedAt:
              review.merchantRepliedAt || review.merchant_replied_at || "",
          },
        ];
      }
    }

    return list;
  }

  function renderMerchantReply(review) {
    var replies = getStoreReplies(review);
    if (!replies.length) return "";

    var panelBody = replies
      .map(function (reply) {
        var repliedAt = formatReviewDate(reply.publishedAt);
        return (
          '<div class="or-customer-say__reply-item">' +
          '<p class="or-customer-say__reply-label">' +
          escapeHtml(reply.authorName || "Store reply") +
          "</p>" +
          '<p class="or-customer-say__reply-body">' +
          escapeHtml(reply.body) +
          "</p>" +
          (repliedAt
            ? '<time class="or-customer-say__reply-date" datetime="' +
              escapeHtml(String(reply.publishedAt)) +
              '">' +
              escapeHtml(repliedAt) +
              "</time>"
            : "") +
          "</div>"
        );
      })
      .join("");

    return (
      '<div class="or-customer-say__reply-wrap has-reply">' +
      '<button type="button" class="or-customer-say__reply-toggle" data-outrage-reply-toggle data-reply-count="' +
      replies.length +
      '" aria-expanded="false">' +
      (replies.length > 1 ? "Replies (" + replies.length + ")" : "Reply") +
      "</button>" +
      '<div class="or-customer-say__reply is-collapsed" data-outrage-reply-panel hidden>' +
      panelBody +
      "</div></div>"
    );
  }

  function bindReplyToggles(container) {
    if (!container || container.getAttribute("data-outrage-reply-bound") === "true") {
      return;
    }
    container.setAttribute("data-outrage-reply-bound", "true");
    container.addEventListener("click", function (event) {
      var target = event.target;
      var button =
        target && target.closest
          ? target.closest("[data-outrage-reply-toggle]")
          : null;
      if (!button || !container.contains(button)) return;

      var wrap = button.closest(".or-customer-say__reply-wrap");
      var panel = wrap
        ? wrap.querySelector("[data-outrage-reply-panel]")
        : null;
      if (!panel) return;

      var open = panel.hidden;
      panel.hidden = !open;
      panel.classList.toggle("is-collapsed", !open);
      button.setAttribute("aria-expanded", open ? "true" : "false");
      var count = Number(button.getAttribute("data-reply-count") || 1);
      button.textContent = open
        ? count > 1
          ? "Hide replies"
          : "Hide reply"
        : count > 1
          ? "Replies (" + count + ")"
          : "Reply";
    });
  }

  function renderReviews(container, reviews, starColor) {
    if (!reviews || !reviews.length) {
      return false;
    }

    var html = reviews
      .map(function (review) {
        var hasMedia = review.media && review.media.length > 0;
        var dateRaw =
          review.publishedAt ||
          review.published_at ||
          review.createdAt ||
          review.created_at ||
          "";
        var dateLabel = formatReviewDate(dateRaw);
        return (
          '<article class="or-customer-say__review-card' +
          (hasMedia ? " has-media" : "") +
          '">' +
          '<div class="or-customer-say__review-main">' +
          '<div class="or-customer-say__review-header">' +
          '<div class="or-customer-say__review-identity">' +
          '<span class="or-customer-say__review-name">' +
          escapeHtml(review.reviewerName || "Customer") +
          "</span>" +
          (dateLabel
            ? '<time class="or-customer-say__review-date" datetime="' +
              escapeHtml(String(dateRaw)) +
              '">' +
              escapeHtml(dateLabel) +
              "</time>"
            : "") +
          (review.isVerifiedPurchase
            ? '<span class="or-customer-say__verified-badge">Verified</span>'
            : "") +
          "</div>" +
          '<div class="or-customer-say__review-stars">' +
          starsHtml(review.rating, starColor) +
          "</div>" +
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
          renderMerchantReply(review) +
          "</div>" +
          renderReviewMedia(review.media) +
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
    var actions = root.querySelector("[data-outrage-actions]");
    var listing = root.querySelector("[data-outrage-listing]");
    var readAll = root.querySelector("[data-outrage-toggle-reviews]");
    var hideBtn = root.querySelector("[data-outrage-hide-reviews]");
    var hasReviews = Number(reviewCount || 0) > 0;

    // Collapsed: only "Read all N reviews"
    // Expanded: "Hide reviews" + review cards
    if (actions) {
      actions.hidden = !(hasReviews && !expanded);
      actions.classList.toggle("is-visible", hasReviews && !expanded);
    }
    if (listing) {
      listing.hidden = !(hasReviews && expanded);
      listing.classList.toggle("is-collapsed", !(hasReviews && expanded));
      listing.classList.toggle("is-expanded", hasReviews && expanded);
    }
    if (readAll && hasReviews) {
      readAll.textContent =
        "Read all " + Number(reviewCount).toLocaleString() + " reviews";
      readAll.setAttribute("aria-expanded", "false");
    }
    if (hideBtn) {
      hideBtn.setAttribute("aria-expanded", expanded ? "true" : "false");
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

  function isPlaceholderSummary(text) {
    var value = String(text || "").trim().toLowerCase();
    if (!value) return true;
    return (
      value.indexOf("no verified reviews yet") >= 0 ||
      value.indexOf("no published reviews yet") >= 0 ||
      value.indexOf("no summary available") >= 0 ||
      value.indexOf("loading customer summary") >= 0 ||
      (value.indexOf("no approved reviews yet") >= 0 &&
        value.indexOf("shoppers") < 0)
    );
  }

  function quoteFromReview(review) {
    return String(review.body || review.title || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function fallbackSummaryFromPayload(data, reviewCount) {
    var title = data.productTitle || "this product";
    var reviews = Array.isArray(data.reviews) ? data.reviews : [];
    var quotes = reviews
      .map(quoteFromReview)
      .filter(Boolean)
      .slice(0, 4);
    if (!quotes.length) {
      return (
        "Customers have " +
        reviewCount +
        " approved review" +
        (reviewCount === 1 ? "" : "s") +
        " of the " +
        title +
        "."
      );
    }
    return (
      "Shoppers reviewing the " +
      title +
      " mention " +
      quotes.map(function (quote) {
        return "“" + quote + "”";
      }).join(" ") +
      " Across " +
      reviewCount +
      " approved review" +
      (reviewCount === 1 ? "" : "s") +
      "."
    );
  }

  function applySummary(root, data, starColor) {
    var average = root.querySelector("[data-outrage-average]");
    var scoreStars = root.querySelector("[data-outrage-score-stars]");
    var verified = root.querySelector("[data-outrage-verified-count]");
    var summaryText = root.querySelector("[data-outrage-summary-text]");
    var summaryMeta = root.querySelector("[data-outrage-summary-meta]");
    var highlights = root.querySelector("[data-outrage-highlights]");
    var snippets = root.querySelector("[data-outrage-snippets]");
    var reviews = Array.isArray(data.reviews) ? data.reviews : [];
    var reviewCount = Math.max(
      Number(data.count || 0),
      Number(data.reviewsTotal || 0),
      Number(data.summarySourceCount || 0),
      reviews.length,
    );
    var sourceCount = Math.max(
      Number(data.summarySourceCount || 0),
      reviewCount,
    );
    var summary =
      isPlaceholderSummary(data.summaryText) && reviewCount > 0
        ? fallbackSummaryFromPayload(data, reviewCount)
        : data.summaryText || "No summary available yet.";

    var rating = data.rating == null ? null : Number(data.rating);
    if (average) {
      average.textContent =
        rating == null || Number.isNaN(rating) ? "—" : rating.toFixed(1);
    }
    if (scoreStars) {
      scoreStars.innerHTML = starsHtml(rating || 0, starColor);
    }
    if (verified) {
      verified.textContent =
        reviewCount.toLocaleString() +
        " approved review" +
        (reviewCount === 1 ? "" : "s");
    }
    if (summaryText) {
      summaryText.textContent = summary;
    }
    if (summaryMeta) {
      var month =
        data.summaryMonthLabel ||
        formatMonth(data.summaryGeneratedAt) ||
        "";
      summaryMeta.textContent =
        "Summarised from " +
        sourceCount.toLocaleString() +
        " approved reviews" +
        (month ? " • " + month : "");
      summaryMeta.hidden = false;
    }
    if (highlights) renderHighlights(highlights, data.highlights || []);
    if (snippets) renderSnippets(snippets, data.snippets || [], starColor);
  }

  async function hydrate(root) {
    var reviewsList = root.querySelector("[data-outrage-reviews-list]");
    var loadMore = root.querySelector("[data-outrage-load-more]");
    var pageSize = Number(root.getAttribute("data-reviews-page-size") || 10);
    var starColor = root.getAttribute("data-star-color") || "#F5A623";
    var state = {
      offset: 0,
      hasMore: false,
      loading: false,
      failed: false,
      expanded: false,
      reviewCount: 0,
      loadedOnce: false,
    };

    function syncToggleUi() {
      setListingExpanded(root, state.expanded, state.reviewCount);
      if (loadMore) {
        if (state.failed && state.expanded) {
          loadMore.hidden = false;
          loadMore.disabled = false;
          loadMore.textContent = "Try again";
        } else if (!state.loading) {
          loadMore.hidden = !(state.expanded && state.hasMore);
          loadMore.disabled = false;
          if (!state.failed) loadMore.textContent = "Load more reviews";
        }
      }
    }

    async function loadReviews(append) {
      if (state.loading) return;
      state.loading = true;
      state.failed = false;
      updateReviewsError(root, null);
      if (loadMore && state.expanded) {
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
          bindReplyToggles(reviewsList);
          if (!append) {
            updateReviewsEmptyState(root, batch.length === 0);
          }
        }

        state.offset += batch.length;
        state.hasMore = Boolean(data.hasMoreReviews);
        state.loadedOnce = true;
        state.reviewCount = Math.max(state.reviewCount, state.offset);

        if (loadMore) {
          loadMore.hidden = !(state.expanded && state.hasMore);
          loadMore.disabled = false;
          loadMore.textContent = "Load more reviews";
        }

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
        }
        if (loadMore) {
          loadMore.hidden = false;
          loadMore.disabled = false;
          loadMore.textContent = "Try again";
        }
        syncToggleUi();
      } finally {
        state.loading = false;
      }
    }

    function openReviews() {
      if (state.reviewCount <= 0 && !state.failed) return;
      state.expanded = true;
      syncToggleUi();
      if (!state.loadedOnce || state.failed) {
        state.offset = 0;
        loadReviews(false);
      }
    }

    function closeReviews() {
      state.expanded = false;
      syncToggleUi();
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

    var readAll = root.querySelector("[data-outrage-toggle-reviews]");
    var hideBtn = root.querySelector("[data-outrage-hide-reviews]");
    if (readAll) readAll.addEventListener("click", openReviews);
    if (hideBtn) hideBtn.addEventListener("click", closeReviews);
    if (loadMore) loadMore.addEventListener("click", retryOrLoadMore);

    // Keep reviews collapsed until the shopper presses Read all.
    await loadReviews(false);
    state.expanded = false;
    syncToggleUi();
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
