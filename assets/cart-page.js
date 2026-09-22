/**
 * <cart-page> - AJAX behavior for sections/main-cart.liquid, mirroring
 * <cart-drawer>'s changeLine()/refresh() pattern (assets/theme.js) so the same
 * dynamic blocks (free shipping, discount code, cart note, etc.) behave
 * identically on the full cart page as in the drawer. Unlike the drawer,
 * the page's initial content is already server-rendered on load, so this
 * only wires up listeners against existing DOM - it never auto-refreshes
 * until a change happens.
 */
class CartPage extends HTMLElement {
    connectedCallback() {
        this.body = this.querySelector('[data-cart-page-body]');
        if (!this.body) return;

        this.body.addEventListener('change', (event) => {
            const input = event.target.closest('[data-quantity-input]');
            if (input) this.updateLine(input);
        });

        this.body.addEventListener('click', (event) => {
            const removeButton = event.target.closest('[data-cart-remove]');
            if (removeButton) this.removeLine(removeButton);
        });
    }

    async updateLine(input) {
        const line = input.closest('[data-cart-item]')?.dataset.lineKey;
        if (!line) return;
        await this.changeLine(line, Number(input.value));
    }

    async removeLine(button) {
        const line = button.closest('[data-cart-item]')?.dataset.lineKey;
        if (!line) return;
        await this.changeLine(line, 0);
    }

    async changeLine(id, quantity) {
        const routes = window.theme.routes || {};

        try {
            const response = await fetch(routes.cartChange || '/cart/change.js', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ id, quantity }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.description || `Cart change failed: ${response.status}`);
            window.theme.dispatchCartUpdate(data);
        } catch (error) {
            console.error(error);
            window.theme.toast?.show(
                error.message || window.theme.strings?.lineErrorGeneric,
                'error'
            );
        }

        await this.refresh();
    }

    async refresh() {
        this.abortController?.abort();
        this.abortController = new AbortController();

        try {
            const response = await fetch(`${this.dataset.cartUrl}?section_id=main-cart`, {
                signal: this.abortController.signal,
            });
            if (!response.ok) throw new Error(`Cart page request failed: ${response.status}`);

            const html = await response.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const content = doc.querySelector('[data-cart-page-content]');
            if (!content) throw new Error('Cart page response had no content');

            this.updateContent(content);
            this.updateCartCount(content);

            // Keeps self-updating blocks (e.g. <free-shipping-progress>)
            // correct even when nothing changed in this tab.
            window.theme.dispatchCartUpdate({ total_price: Number(content.dataset.totalPrice) });
        } catch (error) {
            if (error.name === 'AbortError') return;
            console.error(error);
        }
    }

    // Swaps in only the regions that actually changed instead of wiping
    // and rebuilding the whole body in one shot - mirrors
    // <cart-drawer>'s updateContent() (assets/cart-drawer.js) so a region a
    // single fetch didn't render can never wipe out content the current
    // markup already has.
    updateContent(newContent) {
        const wrapper = this.body.querySelector('[data-cart-page-content]');
        if (!wrapper) {
            this.body.innerHTML = '';
            this.body.appendChild(newContent);
            return;
        }

        const wasEmpty = Boolean(wrapper.querySelector('.cart__empty'));
        const isEmpty = Boolean(newContent.querySelector('.cart__empty'));

        // The empty/non-empty markup shapes differ enough (no items list,
        // no rail) that swapping the whole thing is simpler and safer.
        if (isEmpty || wasEmpty) {
            wrapper.replaceWith(newContent);
            return;
        }

        wrapper.dataset.itemCount = newContent.dataset.itemCount;
        this.swapRegion(wrapper, newContent, '.cart__items');
        this.swapRegion(wrapper, newContent, '.cart__blocks');
        this.swapRegion(wrapper, newContent, '.cart__footer');
    }

    // Replaces one region in place only when both the current and freshly
    // fetched markup have it - never removes a region on its own.
    swapRegion(currentRoot, newRoot, selector) {
        const current = currentRoot.querySelector(selector);
        const updated = newRoot.querySelector(selector);
        if (current && updated) current.replaceWith(this.preserveSelfUpdating(current, updated));
    }

    // Self-updating blocks (root element marked data-self-updating="<name>",
    // e.g. <free-shipping-progress>) manage their own DOM from the
    // cart:updated event and don't want to be overwritten by a section
    // fetch that's always one round-trip behind - keep the live instance
    // instead of the freshly fetched one before swapping the region in.
    preserveSelfUpdating(current, updated) {
        current.querySelectorAll('[data-self-updating]').forEach((live) => {
            const fresh = updated.querySelector(`[data-self-updating="${live.dataset.selfUpdating}"]`);
            fresh?.replaceWith(live);
        });
        return updated;
    }

    updateCartCount(content) {
        const count = content.dataset.itemCount;
        if (count === undefined) return;
        document.querySelectorAll('[data-cart-count]').forEach((el) => {
            el.textContent = `(${count})`;
        });
    }
}

customElements.define('cart-page', CartPage);
