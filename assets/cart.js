/**
 * Site-wide AJAX add-to-cart. Intercepts every `/cart/add` form submission -
 * the product page, product cards, and both Quick Add / Quick View - so
 * adding to cart never hard-navigates. Deliberately does not build a cart
 * drawer; it just updates the header cart count and shows a toast.
 */
const Toast = {
    region: null,

    show(message, type = 'success') {
        if (!message) return;

        this.region = this.region || document.querySelector('[data-toast-region]');
        if (!this.region) return;

        const toast = document.createElement('p');
        toast.className = `toast toast--${type}`;
        toast.textContent = message;
        this.region.appendChild(toast);

        requestAnimationFrame(() => toast.classList.add('is-visible'));

        setTimeout(() => {
            toast.classList.remove('is-visible');
            toast.addEventListener('transitionend', () => toast.remove(), { once: true });
            setTimeout(() => toast.remove(), 600);
        }, 3000);
    },
};

window.theme = window.theme || {};
window.theme.toast = Toast;

class CartForm {
    constructor() {
        document.addEventListener('submit', (event) => this.handleSubmit(event));
    }

    handleSubmit(event) {
        const form = event.target.closest('form[action*="/cart/add"]');
        if (!form) return;

        event.preventDefault();
        this.addToCart(form);
    }

    async addToCart(form) {
        const routes = window.theme.routes || {};
        const button = form.querySelector('[type="submit"]');
        const wasDisabled = Boolean(button?.classList.contains('button--disabled'));

        button?.setAttribute('aria-busy', 'true');
        if (button) button.disabled = true;

        try {
            const response = await fetch(routes.cartAdd || '/cart/add.js', {
                method: 'POST',
                headers: { Accept: 'application/json' },
                body: new FormData(form),
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.description || 'Cart request failed');

            await this.updateCartCount();
            Toast.show(window.theme.strings?.addedToCart, 'success');
            document.dispatchEvent(new CustomEvent('cart:updated', { detail: { item: data } }));

            form.closest('quick-modal')?.close();
        } catch (error) {
            console.error(error);
            Toast.show(window.theme.strings?.addToCartError, 'error');
        } finally {
            button?.removeAttribute('aria-busy');
            if (button) button.disabled = wasDisabled;
        }
    }

    async updateCartCount() {
        const routes = window.theme.routes || {};
        const response = await fetch(routes.cart || '/cart.js');
        const cart = await response.json();

        document.querySelectorAll('[data-cart-count]').forEach((el) => {
            el.textContent = `(${cart.item_count})`;
        });

        return cart;
    }
}

new CartForm();
