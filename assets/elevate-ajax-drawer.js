import Utils from "./utils.js";

const SELECTORS = {
    cart: ".cart-main",
    cartEl: "cart-drawer",
    cartItem: "[data-cart-item]",
    cartContent: "[data-cart-content]",
    qtyPlus: "[data-qty-add]",
    qtyMinus: "[data-qty-minus]",
    qtyInput: "[data-qty-input]",
    removeItem: "[data-remove-item]",
    countBubble: "[data-cart-count]",
    itemCount: "[data-item-count]",
    updateBlock: "[data-update-block]",
    emptyCart: "[data-empty-cart]",
    drawerOverlay: ".drawer-overlay"
};

SELECTORS.cartSectionId = Utils.safeQuery(SELECTORS.cartEl)?.dataset.id || "main-cart";

if (!window.Theme.CONFIG.isDrawer) {
    SELECTORS.cartEl = ".main-cart"
}

class CartDrawer {
    constructor(el) {
        this.el = el;
        this.cart = Utils.safeQuery(this.el);
        this.debouncedUpdate = Utils.debounce(this.updateQuantity.bind(this), 400);
        this.initQuantity();
    }

    open() {
        Utils.closePopup("drawer-open");
        if (window.Theme.CONFIG.isDrawer) {
            this.cart.classList.add("drawer-open");
            const overlay = Utils.safeQuery(SELECTORS.drawerOverlay, this.cart.parentElement);
            if (overlay) {
                this.cart.before(overlay);
            }

            if (overlay) overlay.classList.add("drawer-open");
            document.body.classList.add("no-scroll");

            Utils.trapFocus(this.cart);
        } else{
            window.location.href = "/cart"
        }
    }

    _validateQuantity(input, itemKey, quantity) {
        if (input && itemKey && quantity !== undefined) {
            this.debouncedUpdate(itemKey, quantity);
        }
    }

    initQuantity() {
        this.cart?.addEventListener("click", (e) => {
            const plus = e.target.closest(SELECTORS.qtyPlus);
            const minus = e.target.closest(SELECTORS.qtyMinus);
            const remove = e.target.closest(SELECTORS.removeItem);

            if (plus || minus || remove) {
                const item = e.target.closest(SELECTORS.cartItem);
                const input = Utils.safeQuery(SELECTORS.qtyInput, item);
                const key = input?.dataset.itemKey;
                let qty = parseInt(input?.value || 0, 10);

                if (plus) qty += 1;
                if (minus) qty = Math.max(1, qty - 1);
                if (remove) qty = 0;

                this._validateQuantity(input, key, qty);
            }
        });
    }

    async updateQuantity(itemKey, quantity) {
        try {
            const item = Utils.safeQuery(`[data-cart-item="${itemKey}"]`);
            Utils.updateStatus(item, "loading");
            
            const response = await fetch("/cart/update.js", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    updates: {
                        [itemKey]: quantity
                    }
                }),
            });

            if (!response.ok) {
                throw new Error(`Cart update failed (${response.status})`);
            }
            
            Utils.updateStatus(item, "success");
            await this.updateView();
        } catch (error) {
            Utils.updateStatus(item, "error");

            Utils.showToast("Unable to update cart. Please try again.", { type: "info" });
        }
    }

    async updateView() {
        try {
            let url = `${window.Shopify.routes.root}cart?section_id=${SELECTORS.cartSectionId}`;
            if (!window.Theme.CONFIG.isDrawer) {
                url = `${window.Shopify.routes.root}cart`;
            }
            // Update cart status
            Utils.updateStatus(this.cart, "loading");
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Cart section fetch failed (${response.status})`);
            }

            const html = await response.text();
            const parser = new DOMParser();
            const newDocument = parser.parseFromString(html, "text/html");

            const newCartDOM = Utils.safeQuery(this.el, newDocument);
            const currentCartDOM = this.cart;

            const isCartEmpty = Boolean(Utils.safeQuery(SELECTORS.emptyCart, newDocument));
            const wasCartEmpty = Boolean(Utils.safeQuery(SELECTORS.emptyCart, currentCartDOM));

            // Item count bubble
            const countBubbleEl = Utils.safeQuery(SELECTORS.countBubble);
            const newCountEl = Utils.safeQuery(SELECTORS.itemCount, newDocument);

            if (isCartEmpty || wasCartEmpty) {
                try {
                    const newCartContent = Utils.safeQuery(SELECTORS.cartContent, newCartDOM);
                    const currentCartContent = Utils.safeQuery(SELECTORS.cartContent, currentCartDOM);

                    if (newCartContent && currentCartContent) {
                        currentCartContent.replaceWith(newCartContent);
                    } 
                } catch (error) {
                }

                if (countBubbleEl && newCountEl) {
                    countBubbleEl.textContent = newCountEl.textContent;
                }

                window.initSliders();
                Utils.handleImageLoadStates();
                return;
            }

            const updatedBlocks = Utils.safeQueryAll(SELECTORS.updateBlock, newDocument);
            
            updatedBlocks.forEach((updatedBlock) => {
                const blockId = updatedBlock.dataset.updateBlock;
                const existingBlock = Utils.safeQuery(`[data-update-block="${blockId}"]`, currentCartDOM);

                const existingShippingMessage = Utils.safeQuery(`[data-update-block="${blockId}"] [data-free-shipping] .message`, currentCartDOM);

                if (existingBlock && !existingShippingMessage) {
                    existingBlock.innerHTML = updatedBlock.innerHTML;
                }

                if (existingBlock && existingShippingMessage) {
                    const updatedShippingMessage = Utils.safeQuery(`[data-free-shipping] .message`, updatedBlock);
                    
                    existingShippingMessage.innerHTML = updatedShippingMessage.innerHTML; 
                    updateShippingBar();
                }
            });
            
            if (countBubbleEl && newCountEl) {
                countBubbleEl.textContent = newCountEl.textContent;
            }

            Utils.updateStatus(this.cart, "success");
        } catch (error) {
            Utils.updateStatus(this.cart, "error");

            Utils.showToast?.("Unable to refresh cart. Please reload the page.", { type: "error" });
        }

        Utils.handleImageLoadStates();
    }
}

async function updateShippingBar() {
  try {
    const res = await fetch('/cart.js');

    if (!res.ok) throw new Error('Cart fetch failed');

    const cart = await res.json();

    const bar = document.querySelector('[data-free-shipping-amount]');
    if (!bar) return;

    const threshold = Number(bar.dataset.freeShippingAmount) * 100;
    const progress = Math.min((cart.total_price / threshold) * 100, 100);
    bar.style.width = `${progress}%`;

  } catch (e) {

  }
}


//Init order-popup
document.addEventListener("click", (e) => {
  const trigger = e.target.closest("[data-ordernote]");
  if (!trigger) return;
  Utils.openPopupByTrigger(trigger,"popup-active","[data-ordernote-close]");
});


document.addEventListener("shopify:section:load", updateShippingBar);
document.addEventListener("DOMContentLoaded", updateShippingBar);

const cart = new CartDrawer(SELECTORS.cartEl);
export default cart;