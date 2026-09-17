(function () {
  "use strict";

  var ATTR_BOUND = "data-or-card-rating-bound";
  var ATTR_INJECTED = "data-or-card-rating";
  var CARD_SELECTORS = [
    ".card-wrapper",
    ".product-card-wrapper",
    ".card",
    ".product-card",
    ".grid__item",
    ".product-grid-item",
    ".collection-product-card",
    ".cart-item",
    ".cart__item",
    "[data-product-id]",
    "li",
    "article",
    "tr",
  ].join(", ");

  var TITLE_SELECTORS = [
    ".card__heading a[href*='/products/']",
    ".card-information a[href*='/products/']",
    ".product-card-title a[href*='/products/']",
    ".product-card__title a[href*='/products/']",
    ".cart-item__name",
    ".cart__item-name",
    "h2 a[href*='/products/']",
    "h3 a[href*='/products/']",
    "h4 a[href*='/products/']",
    "a.full-unstyled-link[href*='/products/']",
    "a[href*='/products/']",
  ].join(", ");

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
      item.reviewCount === 1 ? "1 review" : item.reviewCount + " reviews";

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

  function readProductId(node) {
    if (!node) return null;
    var raw =
      node.getAttribute("data-product-id") ||
      node.getAttribute("data-productid") ||
      node.getAttribute("data-id") ||
      null;
    if (!raw && node.dataset) {
      raw = node.dataset.productId || node.dataset.productid || null;
    }
    if (!raw) return null;
    var digits = String(raw).replace(/\D/g, "");
    return digits || null;
  }

  function findProductCards(root) {
    var scope = root || document;
    var byKey = new Map();

    scope.querySelectorAll("a[href*='/products/']").forEach(function (link) {
      var handle = extractHandle(link.getAttribute("href"));
      if (!handle) return;

      var card = link.closest(CARD_SELECTORS) || link.parentElement;
      if (!card) return;
      if (card.querySelector("[" + ATTR_INJECTED + "]")) {
        card.setAttribute(ATTR_BOUND, "true");
        return;
      }

      var key = card;
      var existing = byKey.get(key);
      var title =
        card.querySelector(TITLE_SELECTORS) ||
        (existing && existing.titleEl) ||
        link;
      var productId =
        readProductId(card) ||
        readProductId(title) ||
        readProductId(link) ||
        (existing && existing.productId) ||
        null;

      byKey.set(key, {
        card: card,
        titleEl: title,
        handle: handle,
        productId: productId,
      });
    });

    // Cart / drawer rows sometimes store product id without a classic card link title.
    scope
      .querySelectorAll(
        ".cart-item[data-product-id], .cart__item[data-product-id], [data-cart-item]",
      )
      .forEach(function (card) {
        if (byKey.has(card) || card.querySelector("[" + ATTR_INJECTED + "]")) {
          return;
        }
        var link = card.querySelector("a[href*='/products/']");
        var handle = link ? extractHandle(link.getAttribute("href")) : null;
        var productId = readProductId(card);
        if (!handle && !productId) return;
        byKey.set(card, {
          card: card,
          titleEl:
            card.querySelector(
              ".cart-item__name, .cart__item-name, a[href*='/products/']",
            ) || link,
          handle: handle,
          productId: productId,
        });
      });

    return Array.from(byKey.values());
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
      (titleEl &&
        titleEl.closest(
          ".card__heading, .cart-item__name, .cart__item-name, h2, h3, h4, .product-card-title, .product-card__title",
        )) ||
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

  function chunk(list, size) {
    var out = [];
    for (var i = 0; i < list.length; i += size) {
      out.push(list.slice(i, i + size));
    }
    return out;
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

  async function fetchRatings(opts, handles, ids) {
    var byHandle = {};
    var byId = {};
    var handleChunks = chunk(handles, 80);
    var idChunks = chunk(ids, 80);
    var max = Math.max(handleChunks.length, idChunks.length, 1);

    for (var i = 0; i < max; i++) {
      var h = handleChunks[i] || (i === 0 ? handles.slice(0, 80) : []);
      var d = idChunks[i] || (i === 0 ? ids.slice(0, 80) : []);
      if (!h.length && !d.length) continue;

      var response = await fetch(buildEndpoint(opts.endpoint, h, d), {
        credentials: "same-origin",
      });
      var data = await response.json().catch(function () {
        return {};
      });
      if (!response.ok || !data.products) continue;

      data.products.forEach(function (row) {
        if (row.handle) byHandle[String(row.handle).toLowerCase()] = row;
        if (row.shopifyProductId) byId[String(row.shopifyProductId)] = row;
      });
    }

    return { byHandle: byHandle, byId: byId };
  }

  async function hydrate(root, opts) {
    var cards = findProductCards(root || document).filter(function (card) {
      return card.card.getAttribute(ATTR_BOUND) !== "true";
    });
    if (!cards.length) return;

    var handles = [];
    var ids = [];
    cards.forEach(function (card) {
      if (card.handle) handles.push(card.handle);
      if (card.productId) ids.push(card.productId);
    });
    handles = Array.from(new Set(handles));
    ids = Array.from(new Set(ids));

    var maps = await fetchRatings(opts, handles, ids);

    cards.forEach(function (card) {
      var item =
        (card.productId && maps.byId[card.productId]) ||
        (card.handle && maps.byHandle[card.handle]) ||
        null;
      if (item) {
        insertRating(card, item, opts);
        return;
      }
      if (opts.showEmpty) {
        insertRating(card, { avgRating: 0, reviewCount: 0, empty: true }, opts);
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

    var running = false;
    var queued = false;

    var run = function () {
      if (running) {
        queued = true;
        return;
      }
      running = true;
      hydrate(document, opts)
        .catch(function (error) {
          console.error("[outrage-card-ratings]", error);
        })
        .finally(function () {
          running = false;
          if (queued) {
            queued = false;
            run();
          }
        });
    };

    run();
    setTimeout(run, 800);
    setTimeout(run, 2500);

    if ("MutationObserver" in window) {
      var timer = null;
      var observer = new MutationObserver(function () {
        clearTimeout(timer);
        timer = setTimeout(run, 300);
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    document.addEventListener("shopify:section:load", run);
    document.addEventListener("shopify:section:reorder", run);
    window.addEventListener("pageshow", run);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
