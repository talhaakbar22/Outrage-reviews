(function () {
  "use strict";

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function readRefCode() {
    try {
      var params = new URLSearchParams(window.location.search);
      return (
        params.get("or_ref") ||
        params.get("ref") ||
        window.sessionStorage.getItem("or_ref") ||
        ""
      );
    } catch (_) {
      return "";
    }
  }

  function persistRefCode(code) {
    if (!code) return;
    try {
      window.sessionStorage.setItem("or_ref", code);
    } catch (_) {}
  }

  function buildUrl(endpoint, shop) {
    var url = new URL(endpoint, window.location.origin);
    if (shop && !url.searchParams.get("shop")) {
      url.searchParams.set("shop", shop);
    }
    return url.toString();
  }

  function ReferralWidget(root) {
    this.root = root;
    this.endpoint =
      root.getAttribute("data-endpoint") || "/apps/outrage-reviews/referrals";
    this.shop = root.getAttribute("data-shop") || "";
    this.widget = root.getAttribute("data-widget") || "onsite_popup";
    this.source = root.getAttribute("data-source") || "onsite";
    this.mode = root.getAttribute("data-mode") || "advocate";
    this.open = false;
    this.payload = null;
  }

  ReferralWidget.prototype.init = function () {
    var self = this;
    var ref = readRefCode();
    if (ref) persistRefCode(ref);

    this.loadConfig().then(function () {
      if (!self.payload || !self.payload.active) {
        self.root.hidden = true;
        return;
      }
      self.root.hidden = false;
      self.render();
      self.bind();

      if (self.mode === "friend" || (ref && self.widget === "onsite_popup")) {
        self.openPanel();
        if (ref) self.startFriendFlow(ref);
      }
    });
  };

  ReferralWidget.prototype.loadConfig = async function () {
    var url = new URL(buildUrl(this.endpoint, this.shop), window.location.origin);
    url.searchParams.set("widget", this.widget);
    var response = await fetch(url.toString(), { credentials: "same-origin" });
    var data = await response.json().catch(function () {
      return {};
    });
    if (!response.ok) throw new Error(data.error || "Failed to load referrals");
    this.payload = data;
  };

  ReferralWidget.prototype.render = function () {
    var offer = (this.payload && this.payload.offer) || {};
    var prefs = (this.payload && this.payload.preferences) || {};
    var headline = offer.headline || "Share with friends";
    var consent =
      prefs.marketingConsentType && prefs.marketingConsentType !== "no_consent"
        ? '<label class="or-referral__consent"><input type="checkbox" data-or-referral-consent /> ' +
          escapeHtml(prefs.marketingConsentText || "Email me with updates.") +
          "</label>"
        : "";

    this.root.innerHTML =
      '<button type="button" class="or-referral__tab" data-or-referral-open>' +
      escapeHtml(this.widget === "onsite_sidebar" ? "Referrals" : headline) +
      "</button>" +
      '<div class="or-referral__panel" data-or-referral-panel hidden>' +
      '<button type="button" class="or-referral__close" data-or-referral-close aria-label="Close">×</button>' +
      '<p class="or-referral__eyebrow">Referral program</p>' +
      '<h3 class="or-referral__title">' +
      escapeHtml(headline) +
      "</h3>" +
      '<p class="or-referral__copy">Share your personal link. Friends get ' +
      escapeHtml(offer.friend || "a discount") +
      (offer.advocate
        ? ", and you earn " + escapeHtml(offer.advocate) + "."
        : ".") +
      "</p>" +
      '<form class="or-referral__form" data-or-referral-form>' +
      '<input class="or-referral__input" type="email" name="email" required placeholder="Your email" data-or-referral-email />' +
      '<input class="or-referral__input" type="text" name="name" placeholder="Your name (optional)" data-or-referral-name />' +
      consent +
      '<button type="submit" class="or-referral__submit">Get my referral link</button>' +
      "</form>" +
      '<div class="or-referral__result" data-or-referral-result hidden></div>' +
      '<div class="or-referral__friend" data-or-referral-friend hidden></div>' +
      "</div>";
  };

  ReferralWidget.prototype.bind = function () {
    var self = this;
    var openBtn = qs("[data-or-referral-open]", this.root);
    var closeBtn = qs("[data-or-referral-close]", this.root);
    var form = qs("[data-or-referral-form]", this.root);

    if (openBtn) {
      openBtn.addEventListener("click", function () {
        self.openPanel();
      });
    }
    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        self.closePanel();
      });
    }
    if (form) {
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        self.signup();
      });
    }
  };

  ReferralWidget.prototype.openPanel = function () {
    var panel = qs("[data-or-referral-panel]", this.root);
    if (panel) panel.hidden = false;
    this.open = true;
    this.root.classList.add("or-referral--open");
  };

  ReferralWidget.prototype.closePanel = function () {
    var panel = qs("[data-or-referral-panel]", this.root);
    if (panel) panel.hidden = true;
    this.open = false;
    this.root.classList.remove("or-referral--open");
  };

  ReferralWidget.prototype.signup = async function () {
    var email = qs("[data-or-referral-email]", this.root);
    var name = qs("[data-or-referral-name]", this.root);
    var consent = qs("[data-or-referral-consent]", this.root);
    var result = qs("[data-or-referral-result]", this.root);
    if (!email || !result) return;

    result.hidden = false;
    result.innerHTML = "<p>Creating your link…</p>";

    try {
      var response = await fetch(buildUrl(this.endpoint, this.shop), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          action: "signup",
          email: email.value,
          name: name ? name.value : "",
          source: this.source,
          marketing_consent: consent ? consent.checked : false,
          product_title: this.root.getAttribute("data-product-title") || null,
        }),
      });
      var data = await response.json().catch(function () {
        return {};
      });
      if (!response.ok) throw new Error(data.error || "Signup failed");

      var shareText =
        ((this.payload &&
          this.payload.preferences &&
          this.payload.preferences.socialMediaShareText) ||
          "Share this link with friends") +
        " " +
        data.shareUrl;

      result.innerHTML =
        '<p class="or-referral__success">Your referral link is ready.</p>' +
        '<input class="or-referral__input" readonly value="' +
        escapeHtml(data.shareUrl) +
        '" data-or-referral-share />' +
        '<div class="or-referral__actions">' +
        '<button type="button" class="or-referral__submit" data-or-referral-copy>Copy link</button>' +
        '<a class="or-referral__share" target="_blank" rel="noopener" href="https://twitter.com/intent/tweet?text=' +
        encodeURIComponent(shareText) +
        '">Share</a>' +
        "</div>";

      var copyBtn = qs("[data-or-referral-copy]", result);
      var shareInput = qs("[data-or-referral-share]", result);
      if (copyBtn && shareInput) {
        copyBtn.addEventListener("click", function () {
          shareInput.select();
          document.execCommand("copy");
          copyBtn.textContent = "Copied";
        });
      }
    } catch (error) {
      result.innerHTML =
        '<p class="or-referral__error">' +
        escapeHtml(error instanceof Error ? error.message : "Signup failed") +
        "</p>";
    }
  };

  ReferralWidget.prototype.startFriendFlow = async function (code) {
    var friend = qs("[data-or-referral-friend]", this.root);
    var form = qs("[data-or-referral-form]", this.root);
    if (!friend) return;
    if (form) form.hidden = true;
    friend.hidden = false;
    friend.innerHTML = "<p>Preparing your discount…</p>";

    try {
      var response = await fetch(buildUrl(this.endpoint, this.shop), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          action: "redeem",
          code: code,
        }),
      });
      var data = await response.json().catch(function () {
        return {};
      });
      if (!response.ok) throw new Error(data.error || "Redeem failed");

      var delay = Number(data.redeemDelayMs || 0);
      friend.innerHTML =
        '<p class="or-referral__success">' +
        escapeHtml(data.offerLabel || "Your discount is ready") +
        "</p>" +
        '<p>Code: <strong>' +
        escapeHtml(data.discountCode) +
        "</strong></p>" +
        '<a class="or-referral__submit" href="' +
        escapeHtml(data.discountUrl) +
        '">Apply discount</a>';

      if (delay > 0) {
        setTimeout(function () {
          window.location.href = data.discountUrl;
        }, delay);
      }
    } catch (error) {
      friend.innerHTML =
        '<p class="or-referral__error">' +
        escapeHtml(error instanceof Error ? error.message : "Redeem failed") +
        "</p>";
    }
  };

  function mountAll() {
    document.querySelectorAll("[data-outrage-referral]").forEach(function (root) {
      if (root.getAttribute("data-or-referral-bound") === "true") return;
      root.setAttribute("data-or-referral-bound", "true");
      var widget = new ReferralWidget(root);
      widget.init().catch(function (error) {
        console.error("[outrage-referrals]", error);
        root.hidden = true;
      });
    });
  }

  window.OutrageReferrals = {
    mount: mountAll,
    showPostReview: function (config) {
      var host = document.createElement("div");
      host.setAttribute("data-outrage-referral", "true");
      host.setAttribute("data-widget", "post_review");
      host.setAttribute("data-source", "post_review");
      host.setAttribute("data-mode", "advocate");
      host.setAttribute("data-endpoint", config.endpoint || "/apps/outrage-reviews/referrals");
      host.setAttribute("data-shop", config.shop || "");
      if (config.productTitle) {
        host.setAttribute("data-product-title", config.productTitle);
      }
      host.className = "or-referral or-referral--post-review";
      document.body.appendChild(host);
      var widget = new ReferralWidget(host);
      widget.init().then(function () {
        widget.openPanel();
      });
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountAll);
  } else {
    mountAll();
  }

  document.addEventListener("shopify:section:load", mountAll);
})();
