/**
 * <free-shipping-progress> - the Free Shipping Progress cart-drawer/cart-page
 * block. Self-updates from the theme-wide `cart:updated` event
 * (window.theme.dispatchCartUpdate, assets/theme.js) instead of waiting for
 * a drawer/page section refresh, so it reacts the instant a cart change
 * succeeds - no server round trip needed, since it only needs the cart
 * total and its own settings (passed in as data-* attributes).
 *
 * A template for future self-updating blocks: mark the block's root
 * element data-self-updating="<unique-name>" and <cart-drawer>/<cart-page>
 * (assets/cart-drawer.js, assets/cart-page.js) automatically skip it
 * during their section-driven block swap, leaving it to manage its own DOM.
 */
class FreeShippingProgress extends HTMLElement {
    connectedCallback() {
        this.messageEl = this.querySelector('.free-shipping-progress__message');
        this.barFillEl = this.querySelector('.free-shipping-progress__bar-fill');
        this.checkIcon = this.querySelector('[data-check-icon]')?.content;

        this.onCartUpdated = this.onCartUpdated.bind(this);
        document.addEventListener('cart:updated', this.onCartUpdated);
    }

    disconnectedCallback() {
        document.removeEventListener('cart:updated', this.onCartUpdated);
    }

    onCartUpdated(event) {
        const cart = event.detail?.cart;
        if (cart) this.render(cart.total_price);
    }

    render(totalPrice) {
        const threshold = Number(this.dataset.threshold) || 0;
        if (!threshold || !this.messageEl) return;

        const remaining = Math.max(threshold - totalPrice, 0);
        const hasReachedThreshold = remaining <= 0;
        const percent = hasReachedThreshold ? 100 : Math.min((totalPrice / threshold) * 100, 100);

        this.dataset.state = hasReachedThreshold ? 'complete' : 'in-progress';

        this.messageEl.innerHTML = '';
        if (hasReachedThreshold) {
            if (this.checkIcon) this.messageEl.appendChild(this.checkIcon.cloneNode(true));
            this.messageEl.append(this.dataset.successText || '');
        } else {
            const amount = window.theme.formatMoney(remaining, this.dataset.currency);
            this.messageEl.append((this.dataset.progressText || '').replace('[amount]', amount));
        }

        if (this.barFillEl) this.barFillEl.style.width = `${percent}%`;
    }
}

customElements.define('free-shipping-progress', FreeShippingProgress);
