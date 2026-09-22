/**
 * <cart-popup> - a small, reusable trigger + native <dialog> pair for
 * secondary cart forms that don't need to sit inline in the main flow
 * (Order Note, Discount Code). Mirrors the same <dialog> pattern already
 * used by <quick-modal> (assets/quick-modal.js) and <cart-drawer>
 * (assets/cart-drawer.js) - drop a trigger/dialog pair into any block's
 * markup and it gets open/close, backdrop, and focus handling for free.
 * Any future Cart Drawer feature that needs a popup can reuse this same
 * element instead of building its own.
 *
 * Usage:
 * <cart-popup>
 *   <button type="button" data-cart-popup-trigger>Add a note</button>
 *   <dialog class="cart-popup">
 *     <button type="button" data-cart-popup-close>Close</button>
 *     ...form...
 *   </dialog>
 * </cart-popup>
 */
class CartPopup extends HTMLElement {
    connectedCallback() {
        this.trigger = this.querySelector('[data-cart-popup-trigger]');
        this.dialog = this.querySelector('dialog');
        if (!this.trigger || !this.dialog) return;

        this.trigger.addEventListener('click', () => this.open());

        this.querySelectorAll('[data-cart-popup-close]').forEach((button) => {
            button.addEventListener('click', () => this.close());
        });

        this.dialog.addEventListener('click', (event) => {
            if (event.target === this.dialog) this.close();
        });
    }

    open() {
        if (!this.dialog.open) this.dialog.showModal();
    }

    close() {
        this.dialog?.close();
    }
}

// Guarded: Order Note / Discount Code blocks can be present on both the
// cart drawer (global) and the cart page (/cart only), which would
// otherwise load this file twice on that page - same pattern as
// assets/cart-field.js and assets/discount-code.js.
if (!customElements.get('cart-popup')) {
    customElements.define('cart-popup', CartPopup);
}
