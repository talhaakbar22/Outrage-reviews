(function () {
  "use strict";

  var ATTR_BOUND = "data-or-card-rating-bound";
  var ATTR_INJECTED = "data-or-card-rating";

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

  function roundHalf(value) {
    return Math.round(Number(value) * 2) / 2;
  }

  function starsHtml(rating, size) {
    var rounded = roundHalf(rating);
    var html = "";
    for (var i = 1; i <= 5; i++) {
      if (rounded >= i) {
        html += '<span class="or-star or-star--full" aria-hidden="true">★</span>';
      } else if (rounded >= i - 0.5) {
        html += '<span class="or-star or-star--half" aria-hidden="true">★</span>';
      } else {
        html += '<span class="or-star or-star--empty" aria-hidden="true">★</span>';
      }
    }
    return (
      '<span class="or-star-row" style="--or-star-size:' +
      size +
      'px" role="img" aria-label="' +
      escapeHtml(Number(rating).toFixed(1)) +
      ' out of 5 stars">' +
      html +
      "</span>"
    );
  }

  function ratingMarkup(item, opts) {
    if (item.empty || !item.reviewCount) {
      return (
        '<div class="or-stars or-stars--card" ' +
        ATTR_INJECTED +
        '="true" style="--or-star-size:' +
        opts.starSize +
        "px;--or-star-color:" +
        escapeHtml(opts.starColor) +
        '">' +
        '<span class="or-stars__count or-stars__count--empty">No reviews yet</span>' +
        "</div>"
      );
    }

    var countLabel =
      item.reviewCount === 1
        ? "1 review"
        : item.reviewCount + " reviews";
    return (
      '<div class="or-stars or-stars--card" ' +
      ATTR_INJECTED +
      '="true" style="--or-star-size:' +
      opts.starSize +
      "px;--or-star-color:" +
      escapeHtml(opts.starColor) +
      '">' +
      starsHtml(item.avgRating, opts.starSize) +
      (opts.showCount
        ? '<span class="or-stars__count">' +
          escapeHtml(Number(item.avgRating).toFixed(1)) +
          " · " +
          escapeHtml(countLabel) +
          "</span>"
        : "") +
      "</div>"
    );
  }

  function extractHandle(href) {
    if (!href) return null;
    try {
      var url = new URL(href, window.location.origin);
      var match = url.pathname.match(/\/products\/([^/?#]+)/i);
      return match ? decodeURIComponent(match[1]).toLowerCase() : null;
    } catch (_) {
      return null;
    }
  }

  function findProductCards(root) {
    var cards = [];
    var seen = new Set();

    root.querySelectorAll("a[href*='/products/']").forEach(function (link) {
      var handle = extractHandle(link.getAttribute("href"));
      if (!handle || seen.has(link)) return;

      var card =
        link.closest(
          ".card-wrapper, .card, .product-card, .grid__item, .product-grid-item, li, article",
        ) || link.parentElement;
      if (!card || card.getAttribute(ATTR_BOUND) === "true") return;
      if (card.querySelector("[" + ATTR_INJECTED + "]")) {
        card.setAttribute(ATTR_BOUND, "true");
        return;
      }

      // Prefer heading/title anchors for placement.
      var title =
        card.querySelector(
          ".card__heading a[href*='/products/'], .card-information__text a[href*='/products/'], .product-card-title, .product__title a, h2 a[href*='/products/'], h3 a[href*='/products/'], a.full-unstyled-link[href*='/products/']",
        ) || link;

      var productId =
        card.getAttribute("data-product-id") ||
        (title && title.getAttribute("data-product-id")) ||
        null;

      seen.add(link);
      cards.push({
        card: card,
        titleEl: title,
        handle: handle,
        productId: productId ? String(productId).replace(/\D/g, "") : null,
      });
    });

    return cards;
  }

  function insertRating(cardInfo, item, opts) {
    if (!item) return;
    if (!item.empty && !item.reviewCount) return;
    var card = cardInfo.card;
    if (card.querySelector("[" + ATTR_INJECTED + "]")) {
      card.setAttribute(ATTR_BOUND, "true");
      return;
    }

    var node = document.createElement("div");
    node.innerHTML = ratingMarkup(item, opts);
    var el = node.firstElementChild;
    if (!el) return;

    var titleEl = cardInfo.titleEl;
    var heading =
      (titleEl && titleEl.closest(".card__heading, h2, h3, .product-card-title")) ||
      titleEl;

    if (heading && heading.parentNode) {
      heading.insertAdjacentElement("afterend", el);
    } else if (titleEl && titleEl.parentNode) {
      titleEl.insertAdjacentElement("afterend", el);
    } else {
      card.appendChild(el);
    }

    card.setAttribute(ATTR_BOUND, "true");
  }

  function buildEndpoint(base, handles, ids) {
    var url = new URL(base, window.location.origin);
    if (!url.searchParams.get("shop")) {
      url.searchParams.set("shop", shopDomain());
    }
    if (handles.length) url.searchParams.set("handles", handles.join(","));
    if (ids.length) url.searchParams.set("ids", ids.join(","));
    return url.toString();
  }

  async function hydrate(root, opts) {
    var cards = findProductCards(root || document);
    if (!cards.length) return;

    var handles = [];
    var ids = [];
    cards.forEach(function (card) {
      if (card.handle) handles.push(card.handle);
      if (card.productId) ids.push(card.productId);
    });

    handles = Array.from(new Set(handles));
    ids = Array.from(new Set(ids));

    var response = await fetch(
      buildEndpoint(opts.endpoint, handles, ids),
      { credentials: "same-origin" },
    );
    var data = await response.json().catch(function () {
      return {};
    });
    if (!response.ok || !data.products) return;

    var byHandle = {};
    var byId = {};
    data.products.forEach(function (row) {
      if (row.handle) byHandle[String(row.handle).toLowerCase()] = row;
      if (row.shopifyProductId) byId[String(row.shopifyProductId)] = row;
    });

    cards.forEach(function (card) {
      var item =
        (card.productId && byId[card.productId]) ||
        (card.handle && byHandle[card.handle]) ||
        null;
      if (item) {
        insertRating(card, item, opts);
        return;
      }
      if (opts.showEmpty) {
        insertRating(
          card,
          { avgRating: 0, reviewCount: 0, empty: true },
          opts,
        );
        return;
      }
      card.card.setAttribute(ATTR_BOUND, "true");
    });
  }

  function readConfig() {
    var root = document.querySelector("[data-outrage-card-ratings]");
    if (!root) return null;
    return {
      endpoint:
        root.getAttribute("data-endpoint") ||
        "/apps/outrage-reviews/product-ratings",
      starSize: Number(root.getAttribute("data-star-size") || 14) || 14,
      starColor: root.getAttribute("data-star-color") || "#18181B",
      showCount: root.getAttribute("data-show-count") !== "false",
      showEmpty: root.getAttribute("data-show-empty") === "true",
    };
  }

  function boot() {
    var opts = readConfig();
    if (!opts) return;

    var run = function () {
      hydrate(document, opts).catch(function (error) {
        console.error("[outrage-card-ratings]", error);
      });
    };

    run();

    if ("MutationObserver" in window) {
      var timer = null;
      var observer = new MutationObserver(function () {
        clearTimeout(timer);
        timer = setTimeout(run, 250);
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    document.addEventListener("shopify:section:load", run);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
