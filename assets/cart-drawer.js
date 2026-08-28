/**
 * <cart-drawer> - the persistent cart drawer shell. Its markup lives in
 * sections/cart-drawer.liquid, included in the header-group section group
 * so it's present on every page. Body content is fetched from that same
 * section via the Section Rendering API (?section_id=cart-drawer) and
 * swapped in on open/change.
 *
 * Dispatches cart-drawer:open / cart-drawer:close / cart-drawer:updated on
 * `document` so other code (analytics, other components) can react without
 * coupling to this element - mirrors the theme's existing cart:updated /
 * variant:change custom event pattern (assets/theme.js).
 */
class CartDrawer extends HTMLElement {
    connectedCallback() {
        this.dialog = this.querySelector('dialog');
        this.body = this.querySelector('[data-cart-drawer-body]');
        this.loadingEl = this.querySelector('[data-cart-drawer-loading]');

        if (!this.dialog || !this.body) return;

        this.dialog.addEventListener('click', (event) => {
            if (event.target === this.dialog) this.close();
        });

        this.querySelectorAll('[data-cart-drawer-close]').forEach((button) => {
            button.addEventListener('click', () => this.close());
        });

        this.dialog.addEventListener('close', () => this.onClose());

        this.body.addEventListener('change', (event) => {
            const input = event.target.closest('[data-quantity-input]');
            if (input) this.updateLine(input);
        });

        this.body.addEventListener('click', (event) => {
            const removeButton = event.target.closest('[data-cart-remove]');
            if (removeButton) this.removeLine(removeButton);
        });

        // Bound once so disconnectedCallback can remove these exact
        // listeners - the Theme Editor reloads this section (replacing this
        // element outright) whenever its settings/blocks change, and
        // unremoved document-level listeners would otherwise leak a
        // duplicate set on every save.
        this.onTriggerClick = this.onTriggerClick.bind(this);
        this.onCartUpdated = this.onCartUpdated.bind(this);
        document.addEventListener('click', this.onTriggerClick);
        document.addEventListener('cart:updated', this.onCartUpdated);

        this.bindThemeEditor();
    }

    disconnectedCallback() {
        document.removeEventListener('click', this.onTriggerClick);
        document.removeEventListener('cart:updated', this.onCartUpdated);
        this.unbindThemeEditor?.();
        this.abortController?.abort();
    }

    onTriggerClick(event) {
        const trigger = event.target.closest('[data-cart-drawer-trigger]');
        if (!trigger) return;
        event.preventDefault();
        this.open();
    }

    onCartUpdated() {
        this.open();
    }

    // Lets merchants see the drawer update live while editing its settings
    // or blocks in the Theme Editor. Design-mode only - never runs on the
    // live storefront.
    bindThemeEditor() {
        if (!window.Shopify || !window.Shopify.designMode) return;

        const sectionId = this.dataset.sectionId;

        this.onSectionSelect = (event) => {
            if (event.detail.sectionId === sectionId) this.open();
        };
        this.onSectionDeselect = (event) => {
            if (event.detail.sectionId === sectionId) this.close();
        };

        document.addEventListener('shopify:section:select', this.onSectionSelect);
        document.addEventListener('shopify:block:select', this.onSectionSelect);
        document.addEventListener('shopify:section:deselect', this.onSectionDeselect);
        document.addEventListener('shopify:block:deselect', this.onSectionDeselect);

        this.unbindThemeEditor = () => {
            document.removeEventListener('shopify:section:select', this.onSectionSelect);
            document.removeEventListener('shopify:block:select', this.onSectionSelect);
            document.removeEventListener('shopify:section:deselect', this.onSectionDeselect);
            document.removeEventListener('shopify:block:deselect', this.onSectionDeselect);
        };
    }

    async open() {
        this.loadingEl?.removeAttribute('hidden');

        if (!this.dialog.open) {
            this.dialog.showModal();
            document.documentElement.classList.add('cart-drawer-open');
            document.dispatchEvent(new CustomEvent('cart-drawer:open'));
        }

        try {
            await this.refresh();
        } finally {
            this.loadingEl?.setAttribute('hidden', '');
        }
    }

    async refresh() {
        this.abortController?.abort();
        this.abortController = new AbortController();

        try {
            const response = await fetch(`${this.dataset.cartUrl}?section_id=cart-drawer`, {
                signal: this.abortController.signal,
            });
            if (!response.ok) throw new Error(`Cart drawer request failed: ${response.status}`);

            const html = await response.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const content = doc.querySelector('[data-cart-drawer-content]');
            if (!content) throw new Error('Cart drawer response had no content');

            this.updateContent(content);
            this.updateCartCount(content);

            document.dispatchEvent(new CustomEvent('cart-drawer:updated', {
                detail: { itemCount: Number(content.dataset.itemCount) },
            }));
        } catch (error) {
            if (error.name === 'AbortError') return;
            console.error(error);
        }
    }

    // Swaps in only the regions that actually changed instead of wiping
    // and rebuilding the whole body in one shot - a region a single fetch
    // didn't render (e.g. mid-request) can never wipe out content the
    // current markup already has, so blocks/items/footer can't vanish just
    // because one of the others changed.
    updateContent(newContent) {
        const wrapper = this.body.querySelector('[data-cart-drawer-content]');
        if (!wrapper) {
            this.body.innerHTML = '';
            this.body.appendChild(newContent);
            return;
        }

        const wasEmpty = Boolean(wrapper.querySelector('.cart-drawer__empty'));
        const isEmpty = Boolean(newContent.querySelector('.cart-drawer__empty'));

        // The empty/non-empty markup shapes differ enough (no items list,
        // no footer) that swapping the whole thing is simpler and safer.
        if (isEmpty || wasEmpty) {
            wrapper.replaceWith(newContent);
            return;
        }

        wrapper.dataset.itemCount = newContent.dataset.itemCount;
        this.swapRegion(wrapper, newContent, '.cart-drawer__blocks');
        this.swapRegion(wrapper, newContent, '.cart-drawer__items');
        this.swapRegion(wrapper, newContent, '.cart-drawer__footer');
    }

    // Replaces one region in place only when both the current and freshly
    // fetched markup have it - never removes a region on its own.
    swapRegion(currentRoot, newRoot, selector) {
        const current = currentRoot.querySelector(selector);
        const updated = newRoot.querySelector(selector);
        if (current && updated) current.replaceWith(updated);
    }

    updateCartCount(content) {
        const count = content.dataset.itemCount;
        if (count === undefined) return;
        document.querySelectorAll('[data-cart-count]').forEach((el) => {
            el.textContent = `(${count})`;
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

    close() {
        this.dialog?.close();
    }

    onClose() {
        document.documentElement.classList.remove('cart-drawer-open');
        document.dispatchEvent(new CustomEvent('cart-drawer:close'));
    }
}

customElements.define('cart-drawer', CartDrawer);
