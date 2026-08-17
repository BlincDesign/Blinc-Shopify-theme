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

        document.addEventListener('click', (event) => {
            const trigger = event.target.closest('[data-cart-drawer-trigger]');
            if (!trigger) return;
            event.preventDefault();
            this.open();
        });

        document.addEventListener('cart:updated', () => this.open());

        this.body.addEventListener('change', (event) => {
            const input = event.target.closest('[data-quantity-input]');
            if (input) this.updateLine(input);
        });

        this.body.addEventListener('click', (event) => {
            const removeButton = event.target.closest('[data-cart-drawer-remove]');
            if (removeButton) this.removeLine(removeButton);
        });
    }

    async open() {
        this.loadingEl?.removeAttribute('hidden');
        if (!this.dialog.open) this.dialog.showModal();
        document.documentElement.classList.add('cart-drawer-open');

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

    async updateLine(input) {
        const line = input.closest('[data-cart-drawer-item]')?.dataset.lineKey;
        if (!line) return;
        await this.changeLine(line, Number(input.value));
    }

    async removeLine(button) {
        const line = button.closest('[data-cart-drawer-item]')?.dataset.lineKey;
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
            if (!response.ok) throw new Error(`Cart change failed: ${response.status}`);
        } catch (error) {
            console.error(error);
        }

        await this.refresh();
    }

    close() {
        this.dialog?.close();
    }

    onClose() {
        document.documentElement.classList.remove('cart-drawer-open');
    }
}

customElements.define('cart-drawer', CartDrawer);
