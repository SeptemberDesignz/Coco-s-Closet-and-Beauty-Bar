/* ===========================================================
   Coco's Closet and Beauty Bar — script.js
   All site functionality in vanilla JavaScript.
   Depends on: settings.js and products.js being loaded first.
   =========================================================== */

(function () {
  "use strict";

  /* ---------- Helpers ---------- */
  const formatPrice = (value) => {
    const num = Number(value) || 0;
    return new Intl.NumberFormat(SETTINGS.locale, {
      style: "currency",
      currency: "MWK",
      maximumFractionDigits: 0
    }).format(num).replace("MWK", SETTINGS.currency).trim();
  };

  const productById = (id) => products.find((p) => p.id === id);

  const slugCategoryToValue = {
    "women": "Women's Fashion",
    "men": "Men's Fashion",
    "beauty": "Beauty & Cosmetics",
    "skincare": "Skincare",
    "personal-care": "Personal Care",
    "accessories": "Accessories"
  };

  const fallbackImage = (label = "Image coming soon") => {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='600'>
      <rect width='100%' height='100%' fill='#FCE4EC'/>
      <text x='50%' y='50%' font-family='sans-serif' font-size='20' fill='#EB005B'
        text-anchor='middle' dominant-baseline='middle'>${label}</text></svg>`;
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
  };

  const setImageWithFallback = (img, src, label) => {
    img.src = src;
    img.addEventListener("error", () => {
      img.src = fallbackImage(label || "Image");
      img.alt = img.alt || "Image unavailable";
    }, { once: true });
  };

  /* ---------- Cart storage ---------- */
  const CART_KEY = "cocos_cart_v1";

  function getCart() {
    try {
      const raw = localStorage.getItem(CART_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateCartBadge();
    document.dispatchEvent(new CustomEvent("cart:updated"));
  }

  function cartLineKey(productId, size, colour) {
    return [productId, size || "-", colour || "-"].join("|");
  }

  function addToCart(product, { size = "", colour = "", quantity = 1 } = {}) {
    if (!product || !product.inStock) return;
    const qty = Math.max(1, parseInt(quantity, 10) || 1);
    const cart = getCart();
    const key = cartLineKey(product.id, size, colour);
    const existing = cart.find((l) => l.key === key);
    if (existing) {
      existing.quantity += qty;
    } else {
      cart.push({
        key,
        productId: product.id,
        size: size || "",
        colour: colour || "",
        quantity: qty
      });
    }
    saveCart(cart);
  }

  function updateQuantity(key, delta) {
    const cart = getCart();
    const line = cart.find((l) => l.key === key);
    if (!line) return;
    line.quantity = Math.max(0, line.quantity + delta);
    const cleaned = cart.filter((l) => l.quantity > 0);
    saveCart(cleaned);
  }

  function removeLine(key) {
    saveCart(getCart().filter((l) => l.key !== key));
  }

  function cartTotals() {
    const cart = getCart();
    let count = 0;
    let subtotal = 0;
    const lines = cart.map((line) => {
      const p = productById(line.productId);
      const unit = p ? p.price : 0;
      const sub = unit * line.quantity;
      count += line.quantity;
      subtotal += sub;
      return { ...line, product: p, unitPrice: unit, subtotal: sub };
    });
    const delivery = SETTINGS.deliveryFee > 0 ? SETTINGS.deliveryFee : 0;
    return { lines, count, subtotal, delivery, total: subtotal + delivery };
  }

  function updateCartBadge() {
    const { count } = cartTotals();
    document.querySelectorAll("[data-cart-count]").forEach((el) => {
      el.textContent = String(count);
      el.hidden = count === 0;
    });
  }

  /* ---------- Mobile nav ---------- */
  function setupNav() {
    const nav = document.querySelector(".main-nav");
    const hamburger = document.querySelector(".hamburger");
    const backdrop = document.querySelector(".nav-backdrop");
    if (!nav || !hamburger) return;

    const close = () => {
      nav.classList.remove("open");
      backdrop && backdrop.classList.remove("show");
      hamburger.setAttribute("aria-expanded", "false");
    };
    hamburger.addEventListener("click", () => {
      const open = !nav.classList.contains("open");
      nav.classList.toggle("open", open);
      backdrop && backdrop.classList.toggle("show", open);
      hamburger.setAttribute("aria-expanded", String(open));
    });
    backdrop && backdrop.addEventListener("click", close);

    // Mark the current page
    const path = location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".main-nav a").forEach((a) => {
      const href = a.getAttribute("href") || "";
      if (href === path) a.classList.add("active");
    });
  }

  /* ---------- Product card rendering ---------- */
  function productCard(product) {
    const card = document.createElement("article");
    card.className = "product-card";

    let badge = "";
    if (!product.inStock) badge = '<span class="badge out">Out of Stock</span>';
    else if (product.isNewArrival) badge = '<span class="badge">New</span>';
    else if (product.onSale) badge = '<span class="badge sale">Sale</span>';

    card.innerHTML = `
      <a class="product-media" href="product.html?id=${encodeURIComponent(product.id)}">
        ${badge}
        <img alt="${product.name}" loading="lazy">
      </a>
      <div class="product-body">
        <span class="product-cat">${product.category}</span>
        <a class="product-name" href="product.html?id=${encodeURIComponent(product.id)}">${product.name}</a>
        <span class="product-price">${formatPrice(product.price)}</span>
        <div class="product-actions">
          <a class="btn btn-ghost" href="product.html?id=${encodeURIComponent(product.id)}">Quick View</a>
          <button class="btn btn-primary" type="button" data-add="${product.id}" ${product.inStock ? "" : "disabled"}>
            ${product.inStock ? "Add to Cart" : "Sold Out"}
          </button>
        </div>
      </div>
    `;
    const img = card.querySelector("img");
    setImageWithFallback(img, product.image, product.name);
    img.alt = product.name;

    const addBtn = card.querySelector("[data-add]");
    if (addBtn) {
      addBtn.addEventListener("click", () => {
        // If the product has sizes/colours, go to product page for selection
        if ((product.sizes && product.sizes.length) || (product.colours && product.colours.length)) {
          location.href = `product.html?id=${encodeURIComponent(product.id)}`;
          return;
        }
        addToCart(product, { quantity: 1 });
        flashButton(addBtn, "Added ✓");
      });
    }
    return card;
  }

  function flashButton(btn, msg) {
    const original = btn.textContent;
    btn.textContent = msg;
    btn.disabled = true;
    setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 1200);
  }

  /* ---------- Homepage rendering ---------- */
  function renderHome() {
    const grid = document.getElementById("new-arrivals-grid");
    if (grid) {
      const newItems = products.filter((p) => p.isNewArrival).slice(0, 4);
      const list = newItems.length ? newItems : products.slice(0, 4);
      grid.innerHTML = "";
      list.forEach((p) => grid.appendChild(productCard(p)));
    }

    const catGrid = document.getElementById("category-grid");
    if (catGrid) {
      const categories = [
        { slug: "women", label: "Women's Fashion", img: "images/categories/women.jpg" },
        { slug: "men", label: "Men's Fashion", img: "images/categories/men.jpg" },
        { slug: "beauty", label: "Beauty & Cosmetics", img: "images/categories/beauty.jpg" },
        { slug: "skincare", label: "Skincare", img: "images/categories/skincare.jpg" },
        { slug: "personal-care", label: "Personal Care", img: "images/categories/personal-care.jpg" },
        { slug: "accessories", label: "Accessories", img: "images/categories/accessories.jpg" }
      ];
      catGrid.innerHTML = "";
      categories.forEach((c) => {
        const a = document.createElement("a");
        a.className = "category-card";
        a.href = `shop.html?category=${encodeURIComponent(slugCategoryToValue[c.slug] || "")}`;
        a.innerHTML = `<img alt="${c.label}"><span class="label">${c.label}</span>`;
        const img = a.querySelector("img");
        setImageWithFallback(img, c.img, c.label);
        catGrid.appendChild(a);
      });
    }

    // Social gallery
    const socialGrid = document.getElementById("social-grid");
    if (socialGrid) {
      socialGrid.innerHTML = "";
      ["01", "02", "03", "04"].forEach((n) => {
        const div = document.createElement("div");
        div.className = "tile";
        const img = document.createElement("img");
        img.alt = "Social gallery placeholder";
        setImageWithFallback(img, `images/social/social-${n}.jpg`, "Gallery");
        div.appendChild(img);
        socialGrid.appendChild(div);
      });
    }
  }

  /* ---------- Shop page ---------- */
  function setupShop() {
    const container = document.getElementById("shop-products");
    if (!container) return;

    const searchInput = document.getElementById("shop-search");
    const categorySelect = document.getElementById("shop-category");
    const sortSelect = document.getElementById("shop-sort");
    const countEl = document.getElementById("shop-count");
    const clearBtn = document.getElementById("shop-clear");

    // Initial category from URL
    const params = new URLSearchParams(location.search);
    const catParam = params.get("category");
    if (catParam && categorySelect) categorySelect.value = catParam;

    function render() {
      const term = (searchInput?.value || "").trim().toLowerCase();
      const category = categorySelect?.value || "";
      const sort = sortSelect?.value || "newest";

      let list = products.slice();
      if (category) list = list.filter((p) => p.category === category);
      if (term) list = list.filter((p) => p.name.toLowerCase().includes(term));

      if (sort === "price-asc") list.sort((a, b) => a.price - b.price);
      else if (sort === "price-desc") list.sort((a, b) => b.price - a.price);
      else list.sort((a, b) => Number(b.isNewArrival) - Number(a.isNewArrival));

      container.innerHTML = "";
      if (!list.length) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.innerHTML = `<h3>No products found</h3><p>Try adjusting your search or filters.</p>`;
        container.appendChild(empty);
      } else {
        list.forEach((p) => container.appendChild(productCard(p)));
      }
      if (countEl) countEl.textContent = `${list.length} product${list.length === 1 ? "" : "s"}`;
    }

    searchInput?.addEventListener("input", render);
    categorySelect?.addEventListener("change", render);
    sortSelect?.addEventListener("change", render);
    clearBtn?.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      if (categorySelect) categorySelect.value = "";
      if (sortSelect) sortSelect.value = "newest";
      render();
    });

    render();
  }

  /* ---------- Product detail ---------- */
  function setupProductPage() {
    const root = document.getElementById("product-detail");
    if (!root) return;

    const params = new URLSearchParams(location.search);
    const id = params.get("id");
    const product = id ? productById(id) : null;

    if (!product) {
      root.innerHTML = `<div class="empty-state"><h3>Product not found</h3><p><a class="btn btn-primary" href="shop.html">Back to shop</a></p></div>`;
      return;
    }

    document.title = `${product.name} | ${SETTINGS.businessName}`;

    let selectedSize = "";
    let selectedColour = "";
    let quantity = 1;

    const sizeHtml = product.sizes?.length
      ? `<div class="option-group"><h4>Size</h4><div class="option-list" id="size-options">
          ${product.sizes.map((s) => `<button class="option-chip" type="button" data-size="${s}">${s}</button>`).join("")}
         </div></div>` : "";

    const colourHtml = product.colours?.length
      ? `<div class="option-group"><h4>Colour</h4><div class="option-list" id="colour-options">
          ${product.colours.map((c) => `<button class="option-chip" type="button" data-colour="${c}">${c}</button>`).join("")}
         </div></div>` : "";

    root.innerHTML = `
      <div class="detail-media"><img id="detail-img" alt="${product.name}"></div>
      <div class="detail-info">
        <span class="detail-cat">${product.category}</span>
        <h1>${product.name}</h1>
        <div class="detail-price">${formatPrice(product.price)}</div>
        <span class="status-pill ${product.inStock ? "" : "out"}">
          ${product.inStock ? "In Stock" : "Out of Stock"}
        </span>
        <p class="detail-desc">${product.description}</p>
        ${sizeHtml}
        ${colourHtml}
        <div class="option-group">
          <h4>Quantity</h4>
          <div class="qty-control">
            <button type="button" id="qty-minus" aria-label="Decrease quantity">−</button>
            <span id="qty-value">1</span>
            <button type="button" id="qty-plus" aria-label="Increase quantity">+</button>
          </div>
        </div>
        <button class="btn btn-primary" type="button" id="detail-add" ${product.inStock ? "" : "disabled"}>
          ${product.inStock ? "Add to Cart" : "Out of Stock"}
        </button>
        <div class="form-alert" id="detail-alert"></div>
      </div>
    `;

    const img = document.getElementById("detail-img");
    setImageWithFallback(img, product.image, product.name);

    const alertEl = document.getElementById("detail-alert");
    const showAlert = (msg, isError = true) => {
      alertEl.textContent = msg;
      alertEl.className = "form-alert show " + (isError ? "error" : "success");
    };

    // Option chips
    document.querySelectorAll("[data-size]").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedSize = btn.dataset.size;
        document.querySelectorAll("[data-size]").forEach((b) => b.classList.toggle("active", b === btn));
      });
    });
    document.querySelectorAll("[data-colour]").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedColour = btn.dataset.colour;
        document.querySelectorAll("[data-colour]").forEach((b) => b.classList.toggle("active", b === btn));
      });
    });

    // Quantity
    const qtyVal = document.getElementById("qty-value");
    document.getElementById("qty-minus")?.addEventListener("click", () => {
      quantity = Math.max(1, quantity - 1);
      qtyVal.textContent = quantity;
    });
    document.getElementById("qty-plus")?.addEventListener("click", () => {
      quantity += 1;
      qtyVal.textContent = quantity;
    });

    document.getElementById("detail-add")?.addEventListener("click", () => {
      if (product.sizes?.length && !selectedSize) return showAlert("Please select a size.");
      if (product.colours?.length && !selectedColour) return showAlert("Please select a colour.");
      addToCart(product, { size: selectedSize, colour: selectedColour, quantity });
      showAlert("Added to cart ✓", false);
    });

    // Related products
    const related = document.getElementById("related-products");
    if (related) {
      const list = products
        .filter((p) => p.id !== product.id && p.category === product.category)
        .slice(0, 4);
      const fallback = products.filter((p) => p.id !== product.id).slice(0, 4);
      const chosen = list.length ? list : fallback;
      related.innerHTML = "";
      chosen.forEach((p) => related.appendChild(productCard(p)));
    }
  }

  /* ---------- Cart page ---------- */
  function setupCartPage() {
    const linesEl = document.getElementById("cart-lines");
    if (!linesEl) return;

    const summaryEl = document.getElementById("cart-summary");
    const form = document.getElementById("checkout-form");
    const alertEl = document.getElementById("checkout-alert");

    function renderCart() {
      const { lines, subtotal, delivery, total, count } = cartTotals();
      linesEl.innerHTML = "";

      if (!lines.length) {
        linesEl.innerHTML = `<div class="empty-state">
          <h3>Your cart is empty</h3>
          <p>Looks like you haven't added anything yet.</p>
          <p style="margin-top:1rem;"><a class="btn btn-primary" href="shop.html">Continue Shopping</a></p>
        </div>`;
        if (summaryEl) summaryEl.hidden = true;
        if (form) form.hidden = true;
        return;
      }

      if (summaryEl) summaryEl.hidden = false;
      if (form) form.hidden = false;

      lines.forEach((line) => {
        const el = document.createElement("div");
        el.className = "cart-line";
        const variants = [];
        if (line.size) variants.push(`Size: ${line.size}`);
        if (line.colour) variants.push(`Colour: ${line.colour}`);

        el.innerHTML = `
          <div class="thumb"><img alt="${line.product ? line.product.name : "Product"}"></div>
          <div class="meta">
            <h4>${line.product ? line.product.name : "Unavailable product"}</h4>
            <div class="small">${variants.join(" · ") || "&nbsp;"}</div>
            <div class="small">${formatPrice(line.unitPrice)} each</div>
            <div style="margin-top:.6rem;display:flex;align-items:center;gap:.5rem;">
              <div class="qty-control">
                <button type="button" aria-label="Decrease quantity" data-dec="${line.key}">−</button>
                <span>${line.quantity}</span>
                <button type="button" aria-label="Increase quantity" data-inc="${line.key}">+</button>
              </div>
              <button class="btn btn-ghost" type="button" data-remove="${line.key}" style="padding:.45rem .9rem;min-height:38px;font-size:.8rem;">Remove</button>
            </div>
          </div>
          <div class="line-actions">
            <span class="line-price">${formatPrice(line.subtotal)}</span>
          </div>
        `;
        const img = el.querySelector("img");
        setImageWithFallback(img, line.product ? line.product.image : "", line.product ? line.product.name : "Product");
        linesEl.appendChild(el);
      });

      // Summary numbers
      document.getElementById("sum-subtotal").textContent = formatPrice(subtotal);
      document.getElementById("sum-delivery").textContent =
        delivery > 0 ? formatPrice(delivery) : "To be confirmed";
      document.getElementById("sum-total").textContent = formatPrice(total);
      document.getElementById("sum-count").textContent = String(count);

      // Wire buttons
      linesEl.querySelectorAll("[data-inc]").forEach((b) =>
        b.addEventListener("click", () => { updateQuantity(b.dataset.inc, 1); renderCart(); })
      );
      linesEl.querySelectorAll("[data-dec]").forEach((b) =>
        b.addEventListener("click", () => { updateQuantity(b.dataset.dec, -1); renderCart(); })
      );
      linesEl.querySelectorAll("[data-remove]").forEach((b) =>
        b.addEventListener("click", () => { removeLine(b.dataset.remove); renderCart(); })
      );
    }

    // Order type toggling
    const orderType = document.getElementById("order-type");
    const addressField = document.getElementById("address-field");
    if (orderType && addressField) {
      const sync = () => { addressField.hidden = orderType.value !== "Delivery"; };
      orderType.addEventListener("change", sync);
      sync();
    }

    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      const { lines, subtotal, delivery, total } = cartTotals();
      if (!lines.length) return;

      const name = form.name.value.trim();
      const phone = form.phone.value.trim();
      const type = form.orderType.value;
      const address = form.address ? form.address.value.trim() : "";
      const notes = form.notes ? form.notes.value.trim() : "";

      alertEl.className = "form-alert";

      if (!name) return showError("Please enter your name.");
      if (!phone) return showError("Please enter your phone number.");
      if (type === "Delivery" && !address) return showError("Please enter a delivery address.");

      function showError(msg) {
        alertEl.textContent = msg;
        alertEl.className = "form-alert show error";
      }

      const itemLines = lines.map((line, i) => {
        const p = line.product;
        return `${i + 1}. ${p ? p.name : "Unavailable product"}
   Size: ${line.size || "Not Applicable"}
   Colour: ${line.colour || "Not Applicable"}
   Quantity: ${line.quantity}
   Unit Price: ${SETTINGS.currency} ${line.unitPrice.toLocaleString()}
   Subtotal: ${SETTINGS.currency} ${line.subtotal.toLocaleString()}`;
      }).join("\n\n");

      const deliveryLine = delivery > 0
        ? `${SETTINGS.currency} ${delivery.toLocaleString()}`
        : "To be confirmed with business";

      const msg =
`COCO'S CLOSET AND BEAUTY BAR
NEW CUSTOMER ORDER

Customer Name: ${name}

Customer Phone: ${phone}

Order Type: ${type}

Delivery Address: ${type === "Delivery" ? address : "Not Applicable"}

ORDER ITEMS:

${itemLines}

Order Subtotal: ${SETTINGS.currency} ${subtotal.toLocaleString()}

Delivery Fee: ${deliveryLine}

TOTAL ORDER VALUE: ${SETTINGS.currency} ${total.toLocaleString()}

Customer Notes: ${notes || "None"}

Please confirm product availability, delivery arrangements, and the final order details.

Thank you for shopping with Coco's Closet and Beauty Bar!`;

      const url = "https://wa.me/" + SETTINGS.whatsappNumber + "?text=" + encodeURIComponent(msg);
      const win = window.open(url, "_blank");
      if (!win) {
        alertEl.textContent = "Your browser blocked the WhatsApp window. Please allow popups or use the link in the order summary.";
        alertEl.className = "form-alert show error";
      } else {
        alertEl.textContent = "WhatsApp opened — please review and send your message. Your cart has been kept.";
        alertEl.className = "form-alert show success";
      }
    });

    document.addEventListener("cart:updated", renderCart);
    renderCart();
  }

  /* ---------- Contact page / footer links ---------- */
  function setupContact() {
    // Populate elements that read from SETTINGS
    document.querySelectorAll("[data-business-name]").forEach((el) => (el.textContent = SETTINGS.businessName));
    document.querySelectorAll("[data-phone]").forEach((el) => {
      el.textContent = SETTINGS.phone;
      if (el.tagName === "A") el.href = "tel:" + SETTINGS.phone.replace(/\s+/g, "");
    });
    document.querySelectorAll("[data-instagram]").forEach((el) => (el.href = SETTINGS.instagramUrl));
    document.querySelectorAll("[data-facebook]").forEach((el) => (el.href = SETTINGS.facebookUrl));
    document.querySelectorAll("[data-instagram-handle]").forEach((el) => (el.textContent = SETTINGS.instagramHandle));
    document.querySelectorAll("[data-whatsapp]").forEach((el) => {
      el.href = "https://wa.me/" + SETTINGS.whatsappNumber + "?text=" + encodeURIComponent(SETTINGS.defaultWhatsappMessage);
    });

    const year = document.getElementById("copyright-year");
    if (year) year.textContent = String(new Date().getFullYear());
  }

  /* ---------- Back to top ---------- */
  function setupBackToTop() {
    document.querySelectorAll("[data-back-to-top]").forEach((btn) =>
      btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }))
    );
  }

  /* ---------- Boot ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    setupNav();
    renderHome();
    setupShop();
    setupProductPage();
    setupCartPage();
    setupContact();
    setupBackToTop();
    updateCartBadge();
  });
})();