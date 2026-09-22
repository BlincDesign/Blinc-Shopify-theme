/**
 * Generic debounced-autosave field for cart-level data. Used by both the
 * Cart Note block (`data-field="note"`) and the PO/Job Reference block
 * (`data-field="attributes[po-reference]"`) - one element, two shapes of
 * payload, since Shopify's /cart/update.js accepts both a top-level `note`
 * key and an `attributes` map.
 *
 * Deliberately never triggers a cart-drawer/cart-page refresh: replacing
 * the drawer body mid-typing would destroy focus/caret position.
 */
class CartField extends HTMLElement {
    connectedCallback() {
        this.input = this.querySelector('[data-cart-field-input]');
        this.status = this.querySelector('[data-cart-field-status]');
        this.field = this.dataset.field;

        if (!this.input || !this.field) return;

        this.save = window.theme.debounce(() => this.saveValue(), 500);
        this.input.addEventListener('input', () => this.save());
    }

    buildPayload(value) {
        const attributeMatch = this.field.match(/^attributes\[(.+)\]$/);
        if (attributeMatch) {
            return { attributes: { [attributeMatch[1]]: value } };
        }
        return { [this.field]: value };
    }

    async saveValue() {
        const routes = window.theme.routes || {};

        this.setStatus(this.dataset.savingText, 'saving');

        try {
            const response = await fetch(routes.cartUpdate || '/cart/update.js', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify(this.buildPayload(this.input.value)),
            });
            const cart = await response.json();
            if (!response.ok) throw new Error(`Cart update failed: ${response.status}`);
            this.setStatus(this.dataset.savedText, 'saved');
            window.theme.dispatchCartUpdate(cart);
        } catch (error) {
            console.error(error);
            this.setStatus(this.dataset.errorText, 'error');
        }
    }

    setStatus(message, state) {
        if (!this.status) return;
        this.status.textContent = message || '';
        this.status.dataset.state = state || '';
    }
}

// Guards against double-registration: the Cart Note / PO Reference blocks
// can be present on both the cart drawer (global) and the cart page
// (/cart only), which would otherwise load this file twice on that page.
if (!customElements.get('cart-field')) {
    customElements.define('cart-field', CartField);

    // Best-effort nudge for a required PO/Job Reference field: shows a
    // warning and focuses the field, but does not block navigation to
    // checkout - a client-side script cannot reliably intercept Shopify's
    // hosted checkout (direct URL, back button, and saved cart links all
    // bypass it).
    document.addEventListener('click', (event) => {
        if (!event.target.closest('[data-checkout-button]')) return;

        document.querySelectorAll('cart-field[data-required]').forEach((field) => {
            const input = field.querySelector('[data-cart-field-input]');
            const status = field.querySelector('[data-cart-field-status]');
            if (!input || input.value.trim() !== '') return;

            input.focus();
            if (status) {
                status.textContent = field.dataset.requiredWarning || '';
                status.dataset.state = 'error';
            }
        });
    });
}
