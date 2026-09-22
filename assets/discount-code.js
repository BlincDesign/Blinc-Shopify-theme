/**
 * <discount-code-form> - apply/remove a cart-level discount code. Unlike
 * <cart-field>, this always triggers a full cart-drawer/cart-page refresh
 * on success or failure, since it's a discrete button action (not
 * per-keystroke) and the footer's subtotal/discount line needs to reflect
 * the result immediately.
 */
class DiscountCodeForm extends HTMLElement {
    connectedCallback() {
        this.input = this.querySelector('[data-discount-input]');
        this.applyButton = this.querySelector('[data-discount-apply]');
        this.buttonLabel = this.querySelector('[data-discount-button-label]');
        this.spinner = this.querySelector('[data-discount-spinner]');
        this.status = this.querySelector('[data-discount-status]');
        this.removeButton = this.querySelector('[data-discount-remove]');

        this.applyButton?.addEventListener('click', () => this.apply());
        this.input?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                this.apply();
            }
        });
        this.removeButton?.addEventListener('click', () => this.remove());
    }

    async apply() {
        const code = this.input?.value.trim();
        if (!code) return;
        await this.updateDiscount(code);
    }

    async remove() {
        await this.updateDiscount('');
    }

    async updateDiscount(discount) {
        const routes = window.theme.routes || {};
        this.setLoading(true);

        try {
            const response = await fetch(routes.cartUpdate || '/cart/update.js', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ discount }),
            });
            const cart = await response.json();
            if (!response.ok) throw new Error(cart.description || `Discount update failed: ${response.status}`);
            window.theme.dispatchCartUpdate(cart);

            const applied = (cart.cart_level_discount_applications || []).some(
                (application) => application.title === discount
            );

            if (discount && !applied) {
                this.setStatus(this.dataset.errorText, 'error');
                this.setLoading(false);
                return;
            }
        } catch (error) {
            console.error(error);
            this.setStatus(this.dataset.errorText, 'error');
            this.setLoading(false);
            return;
        }

        // Announce success before the full refresh replaces this form with
        // the applied-code view - the aria-live region still queues it even
        // though the element disappears immediately after.
        if (discount) this.setStatus(this.dataset.successText, 'success');
        await this.refreshCart();
    }

    async refreshCart() {
        const cartDrawer = document.querySelector('cart-drawer');
        const cartPage = document.querySelector('cart-page');
        if (cartDrawer) await cartDrawer.refresh();
        if (cartPage) await cartPage.refresh();
    }

    setLoading(isLoading) {
        this.applyButton?.setAttribute('aria-busy', String(isLoading));
        if (this.applyButton) {
            this.applyButton.disabled = isLoading;
            if (isLoading && this.dataset.applyingText) {
                this.applyButton.setAttribute('aria-label', this.dataset.applyingText);
            } else {
                this.applyButton.removeAttribute('aria-label');
            }
        }
        this.buttonLabel?.toggleAttribute('hidden', isLoading);
        this.spinner?.toggleAttribute('hidden', !isLoading);
    }

    setStatus(message, type = 'success') {
        if (!this.status) return;
        this.status.textContent = message || '';
        this.status.dataset.state = type;
    }
}

// Guarded: the Discount Code block can be present on both the cart drawer
// (global) and the cart page (/cart only), which would otherwise load
// this file twice on that page and throw on the second define().
if (!customElements.get('discount-code-form')) {
    customElements.define('discount-code-form', DiscountCodeForm);
}
