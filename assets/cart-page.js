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

            this.body.innerHTML = '';
            this.body.appendChild(content);
            this.updateCartCount(content);
        } catch (error) {
            if (error.name === 'AbortError') return;
            console.error(error);
        }
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
