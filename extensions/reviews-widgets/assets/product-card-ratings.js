(function () {
  "use strict";

  var ATTR_BOUND = "data-or-card-rating-bound";
  var ATTR_INJECTED = "data-or-card-rating";
  var ATTR_PENDING = "data-or-card-rating-pending";

  // Broad coverage for Dawn + Outrage London (ol-col-card) + other custom themes.
  var CARD_SELECTORS = [
    ".ol-col-card",
    ".ol-col-grid__item",
    ".recent-card",
    "[data-recent-card]",
    ".card-wrapper",
    ".product-card-wrapper",
    ".card",
    ".product-card",
    ".product-grid-item",
    ".collection-product-card",
    ".product-item",
    ".productitem",
    ".grid-product",
    ".grid-view-item",
    ".predictive-search__item",
    ".predictive-search__result-item",
    ".cart-item",
    ".cart__item",
    ".cart-drawer__item",
    "[data-product-id]",
    "[data-product-handle]",
  ].join(", ");

  var TITLE_SELECTORS = [
    ".ol-col-card__name",
    ".ol-col-card__link .ol-col-card__name",
    ".ol-col-card__meta a[href*='/products/']",
    ".recent-card__title",
    ".recent-card__name",
    "[data-recent-card] .ol-col-card__name",
    ".card__heading a[href*='/products/']",
    ".card-information a[href*='/products/']",
    ".product-card-title a[href*='/products/']",
    ".product-card__title a[href*='/products/']",
    ".productitem--title a[href*='/products/']",
    ".product-item__title a[href*='/products/']",
    ".grid-product__title a[href*='/products/']",
    ".predictive-search__item-heading",
    ".predictive-search__item-content a[href*='/products/']",
    ".cart-item__name",
    ".cart__item-name",
    ".cart-item__details a[href*='/products/']",
    "h2 a[href*='/products/']",
    "h3 a[href*='/products/']",
    "h4 a[href*='/products/']",
    "a.full-unstyled-link[href*='/products/']",
    "a[href*='/products/']",
  ].join(", ");

  var IMAGE_ONLY_LINK =
    ".ol-col-card__imglink, .ol-col-card__slider-stage a, .card__media a, .media a, .recent-card__image a, .recent-card__media a";

  var BAD_INSERT_ANCESTOR =
    ".ol-col-card__imgwrap, .ol-col-card__slider-stage, .ol-col-card__imglink, .product-image, .media, .card__media, .recent-card__media, .recent-card__image";

  var PDP_TITLE_SELECTORS = [
    "h1.pdp-title",
    "h1.product-single__title",
    ".pdp-title",
    ".product-single__title",
    ".pdp-title-row h1",
    ".product-block--header h1",
    ".product__title",
    ".product-title",
    ".product__info-container h1",
    ".product__heading",
    "[data-product-title]",
    "main .product h1",
    "main h1.product-title",
    ".product-info h1",
    ".product__info h1",
    "h1.product__title",
    "h1[itemprop='name']",
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
        '<div class="or-stars or-stars--card or-stars--compact" ' +
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
      '<div class="or-stars or-stars--card or-stars--compact" ' +
      ATTR_INJECTED +
      '="true" style="--or-star-size:' +
      opts.starSize +
      "px;--or-star-color:" +
      escapeHtml(opts.starColor) +
      '">' +
      starsHtml(item.avgRating, opts.starSize) +
      (opts.showCount
        ? '<span class="or-stars__count">' +
          '<span class="or-stars__avg">' +
          escapeHtml(Number(item.avgRating).toFixed(1)) +
          "</span>" +
          ' <span class="or-stars__reviews">(' +
          escapeHtml(String(item.reviewCount)) +
          ")</span>" +
          '<span class="visually-hidden"> ' +
          escapeHtml(countLabel) +
          "</span>" +
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

  function currentProductHandle() {
    var match = window.location.pathname.match(/\/products\/([^/?#]+)/i);
    return match ? decodeURIComponent(match[1]).toLowerCase() : null;
  }

  function isMainProductTitle(link, opts) {
    if (!opts.includePdp) {
      if (!link || !document.body.classList.contains("template-product")) {
        return false;
      }
      return Boolean(link.closest(PDP_TITLE_SELECTORS + ", main .product h1"));
    }
    return false;
  }

  function hideBrokenThemeRatings(card) {
    card
      .querySelectorAll(".rating, .rating-count, .product-rating")
      .forEach(function (el) {
        var text = (el.textContent || "").replace(/\s+/g, " ").trim();
        if (!text || text === "()" || text === "( )" || text === "0") {
          el.style.display = "none";
        }
      });
  }

  function findPdpTitleCard(opts) {
    if (!opts.includePdp) return null;
    if (!/\/products\//i.test(window.location.pathname)) return null;

    var titleEl = document.querySelector(PDP_TITLE_SELECTORS);
    if (!titleEl) return null;

    // Anchor to the title row / header block so we never attach to a whole section.
    var card =
      titleEl.closest(".pdp-title-row") ||
      titleEl.closest(".product-block--header") ||
      titleEl.closest(".product-block") ||
      titleEl.parentElement ||
      titleEl;

    if (card.querySelector("[" + ATTR_INJECTED + '="pdp"]')) {
      return null;
    }

    var handle = currentProductHandle();
    var productId =
      readProductId(
        document.querySelector(
          "[data-product-id], [data-productid], form[action*='/cart/add']",
        ),
      ) ||
      readProductId(document.body) ||
      null;

    var metaProduct = document.querySelector(
      'meta[property="product:id"], meta[name="product-id"]',
    );
    if (!productId && metaProduct) {
      productId =
        String(metaProduct.getAttribute("content") || "").replace(/\D/g, "") ||
        null;
    }

    if (!productId && window.meta && window.meta.product && window.meta.product.id) {
      productId = String(window.meta.product.id).replace(/\D/g, "") || null;
    }
    if (!handle && window.meta && window.meta.product && window.meta.product.handle) {
      handle = String(window.meta.product.handle).toLowerCase();
    }

    if (!handle && !productId) return null;

    return {
      card: card,
      titleEl: titleEl,
      handle: handle,
      productId: productId,
      pdp: true,
    };
  }

  function placeStarsElement(card, titleEl, el, isPdp) {
    if (isPdp) {
      var pdpTitle =
        card.querySelector("h1.pdp-title, h1.product-single__title, .pdp-title") ||
        titleEl;
      if (pdpTitle && pdpTitle.parentNode) {
        pdpTitle.insertAdjacentElement("afterend", el);
        el.setAttribute(ATTR_INJECTED, "pdp");
        return true;
      }
      var titleRow = card.closest(".pdp-title-row") || card.querySelector(".pdp-title-row");
      if (titleRow) {
        titleRow.appendChild(el);
        el.setAttribute(ATTR_INJECTED, "pdp");
        return true;
      }
    }

    var olName = card.querySelector(".ol-col-card__name, .recent-card__title, .recent-card__name");
    if (olName && olName.parentNode) {
      olName.insertAdjacentElement("afterend", el);
      return true;
    }

    var olMeta = card.querySelector(".ol-col-card__meta, .recent-card__meta, .recent-card__info");
    if (olMeta) {
      var priceRow = olMeta.querySelector(
        ".ol-col-card__pricerow, .recent-card__price, .price",
      );
      if (priceRow) {
        priceRow.insertAdjacentElement("beforebegin", el);
      } else {
        olMeta.appendChild(el);
      }
      return true;
    }

    // Never leave stars inside the image/slider area (shows beside the image).
    if (titleEl && titleEl.closest && titleEl.closest(BAD_INSERT_ANCESTOR)) {
      titleEl = null;
    }

    var heading =
      (titleEl &&
        titleEl.closest(
          ".card__heading, .cart-item__name, .cart__item-name, .predictive-search__item-heading, h1, h2, h3, h4, .product-card-title, .product-card__title, .product__title, .product-title, .ol-col-card__name, .recent-card__title, .pdp-title, .product-single__title",
        )) ||
      titleEl;

    if (heading && heading.parentNode && !heading.closest(BAD_INSERT_ANCESTOR)) {
      heading.insertAdjacentElement("afterend", el);
      return true;
    }

    var safeHost =
      card.querySelector(".ol-col-card__meta, .recent-card__meta, .card-information, .card__content") ||
      card;
    if (safeHost && !safeHost.matches && safeHost.classList) {
      // ok
    }
    if (safeHost && safeHost.closest && safeHost.closest(BAD_INSERT_ANCESTOR)) {
      safeHost = card;
    }
    safeHost.appendChild(el);
    return true;
  }

  function insertRating(cardInfo, item, opts) {
    if (!item) return;
    if (!item.empty && !item.reviewCount) return;

    var card = cardInfo.card;
    hideBrokenThemeRatings(card);

    var existing =
      card.querySelector("[" + ATTR_INJECTED + "]") ||
      (cardInfo.pdp && document.querySelector("[" + ATTR_INJECTED + '="pdp"]'));
    if (existing) {
      var replacement = document.createElement("div");
      replacement.innerHTML = ratingMarkup(item, opts);
      var next = replacement.firstElementChild;
      if (next) {
        if (cardInfo.pdp) next.setAttribute(ATTR_INJECTED, "pdp");
        existing.replaceWith(next);
      }
      card.setAttribute(ATTR_BOUND, "true");
      card.removeAttribute(ATTR_PENDING);
      return;
    }

    var node = document.createElement("div");
    node.innerHTML = ratingMarkup(item, opts);
    var el = node.firstElementChild;
    if (!el) return;

    placeStarsElement(card, cardInfo.titleEl, el, Boolean(cardInfo.pdp));

    card.setAttribute(ATTR_BOUND, "true");
    card.removeAttribute(ATTR_PENDING);
  }

  function resolveCardRoot(link) {
    var card =
      link.closest(".ol-col-card") ||
      link.closest(".recent-card") ||
      link.closest("[data-recent-card]") ||
      link.closest(".ol-col-grid__item") ||
      link.closest(CARD_SELECTORS);
    if (!card) return null;

    // Skip oversized PDP chrome (whole info column / sticky media).
    if (
      card.closest(".product-section") &&
      (card.classList.contains("grid__item") ||
        card.classList.contains("product-info") ||
        card.classList.contains("custom-product-info-container") ||
        card.classList.contains("pdp-layout__info") ||
        card.classList.contains("product-single__sticky"))
    ) {
      return null;
    }

    if (card.classList && card.classList.contains("ol-col-grid__item")) {
      var inner = card.querySelector(".ol-col-card, .recent-card");
      if (inner) card = inner;
    }

    // Recently viewed grid items
    if (card.closest && card.closest("[data-recent-grid], .recent-grid")) {
      var recentCard =
        link.closest(".recent-card, [data-recent-card], .ol-col-card") || card;
      return recentCard;
    }

    return card;
  }

  function findProductCards(root, opts) {
    var scope = root || document;
    var byKey = new Map();

    scope.querySelectorAll("a[href*='/products/']").forEach(function (link) {
      if (isMainProductTitle(link, opts)) return;
      var handle = extractHandle(link.getAttribute("href"));
      if (!handle) return;

      if (
        link.closest(
          "header, footer, noscript, .announcement-bar, #shopify-section-header, #shopify-section-footer, .or-customer-say",
        )
      ) {
        return;
      }

      var card = resolveCardRoot(link);
      if (!card) return;

      if (card.querySelector("[" + ATTR_INJECTED + "]")) {
        card.setAttribute(ATTR_BOUND, "true");
        card.removeAttribute(ATTR_PENDING);
        return;
      }

      var key = card;
      var existing = byKey.get(key);

      var title =
        card.querySelector(".ol-col-card__name") ||
        card.querySelector(".recent-card__title, .recent-card__name") ||
        card.querySelector(".ol-col-card__meta a[href*='/products/']") ||
        card.querySelector(TITLE_SELECTORS) ||
        (existing && existing.titleEl) ||
        (link.matches(IMAGE_ONLY_LINK) ? null : link) ||
        (existing && existing.titleEl) ||
        link;

      var productId =
        readProductId(card) ||
        readProductId(title) ||
        readProductId(link) ||
        (existing && existing.productId) ||
        null;

      if (!productId) {
        var jsonEl = card.querySelector("script.ol-col-card__json");
        if (jsonEl && jsonEl.textContent) {
          try {
            var parsed = JSON.parse(jsonEl.textContent);
            if (parsed && parsed.id) {
              productId = String(parsed.id).replace(/\D/g, "") || null;
            }
            if (!handle && parsed && parsed.handle) {
              handle = String(parsed.handle).toLowerCase();
            }
          } catch (_) {}
        }
      }

      byKey.set(key, {
        card: card,
        titleEl: title,
        handle: handle,
        productId: productId,
      });
    });

    scope
      .querySelectorAll(
        ".cart-item, .cart__item, .cart-drawer__item, [data-cart-item], .predictive-search__item",
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
              ".cart-item__name, .cart__item-name, .predictive-search__item-heading, a[href*='/products/']",
            ) || link,
          handle: handle,
          productId: productId,
        });
      });

    var pdp = findPdpTitleCard(opts);
    if (pdp) {
      byKey.set(pdp.card, pdp);
    }

    return Array.from(byKey.values());
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
    var ok = false;

    for (var i = 0; i < max; i++) {
      var h = handleChunks[i] || (i === 0 ? handles.slice(0, 80) : []);
      var d = idChunks[i] || (i === 0 ? ids.slice(0, 80) : []);
      if (!h.length && !d.length) continue;

      var headers = { Accept: "application/json" };
      var url = buildEndpoint(opts.endpoint, h, d);
      if (/ngrok/i.test(url)) {
        headers["ngrok-skip-browser-warning"] = "69420";
      }

      var response = await fetch(url, {
        credentials: "same-origin",
        headers: headers,
      });
      var data = await response.json().catch(function () {
        return {};
      });
      if (!response.ok) continue;
      ok = true;
      (data.products || []).forEach(function (row) {
        if (row.handle) byHandle[String(row.handle).toLowerCase()] = row;
        if (row.shopifyProductId) byId[String(row.shopifyProductId)] = row;
      });
    }

    return { byHandle: byHandle, byId: byId, ok: ok };
  }

  async function hydrate(root, opts) {
    var cards = findProductCards(root || document, opts).filter(function (card) {
      return (
        card.card.getAttribute(ATTR_BOUND) !== "true" ||
        card.card.getAttribute(ATTR_PENDING) === "true"
      );
    });
    if (!cards.length) return;

    cards.forEach(function (card) {
      card.card.setAttribute(ATTR_PENDING, "true");
    });

    var handles = [];
    var ids = [];
    cards.forEach(function (card) {
      if (card.handle) handles.push(card.handle);
      if (card.productId) ids.push(card.productId);
    });
    handles = Array.from(new Set(handles));
    ids = Array.from(new Set(ids));

    var maps = await fetchRatings(opts, handles, ids);
    if (!maps.ok) {
      return;
    }

    cards.forEach(function (card) {
      var item =
        (card.productId && maps.byId[card.productId]) ||
        (card.handle && maps.byHandle[card.handle]) ||
        null;
      if (item && item.reviewCount > 0) {
        insertRating(card, item, opts);
        return;
      }
      if (opts.showEmpty) {
        insertRating(card, { avgRating: 0, reviewCount: 0, empty: true }, opts);
        return;
      }
      hideBrokenThemeRatings(card.card);
      card.card.setAttribute(ATTR_BOUND, "true");
      card.card.removeAttribute(ATTR_PENDING);
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
      showEmpty: root.getAttribute("data-show-empty") !== "false",
      includePdp: root.getAttribute("data-include-pdp") !== "false",
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
    setTimeout(run, 600);
    setTimeout(run, 1800);
    setTimeout(run, 4000);

    if ("MutationObserver" in window) {
      var timer = null;
      var observer = new MutationObserver(function () {
        clearTimeout(timer);
        timer = setTimeout(run, 250);
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    document.addEventListener("shopify:section:load", run);
    document.addEventListener("shopify:section:reorder", run);
    document.addEventListener("cart:updated", run);
    document.addEventListener("cart:refresh", run);
    window.addEventListener("pageshow", run);

    document.addEventListener(
      "focusin",
      function (event) {
        var target = event.target;
        if (
          target &&
          (target.matches(
            "input[type='search'], predictive-search input, .search__input, #Search-In-Modal",
          ) ||
            (target.closest &&
              target.closest("predictive-search, .cart-drawer, #CartDrawer")))
        ) {
          setTimeout(run, 200);
        }
      },
      true,
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
