/**
 * <quick-modal> is a single, shared native <dialog> that opens Quick View for
 * multi-variant products (from the product page, product cards, etc). Any
 * trigger anywhere on the page can open it via `data-quick-modal-trigger` +
 * `data-url`; the fetched section's markup (snippets/quick-product-form.liquid,
 * via sections/quick-view.liquid) is injected as-is. Its
 * <variant-picker>/<product-info>/<quantity-selector> custom elements
 * auto-upgrade on insertion, so no manual re-initialization is needed.
 */
class QuickModal extends HTMLElement {
    connectedCallback() {
        this.dialog = this.querySelector('dialog');
        this.body = this.querySelector('[data-quick-modal-body]');
        this.loadingEl = this.querySelector('[data-quick-modal-loading]');
        this.opener = null;

        if (!this.dialog || !this.body) return;

        this.dialog.addEventListener('click', (event) => {
            if (event.target === this.dialog) this.close();
        });

        this.querySelectorAll('[data-quick-modal-close]').forEach((button) => {
            button.addEventListener('click', () => this.close());
        });

        this.dialog.addEventListener('close', () => this.onClose());

        document.addEventListener('click', (event) => {
            const trigger = event.target.closest('[data-quick-modal-trigger]');
            if (!trigger) return;
            event.preventDefault();
            this.open(trigger);
        });
    }

    async open(trigger) {
        this.opener = trigger;
        this.abortController?.abort();
        this.abortController = new AbortController();

        this.body.innerHTML = '';
        this.loadingEl?.removeAttribute('hidden');
        trigger.setAttribute('aria-busy', 'true');

        if (!this.dialog.open) this.dialog.showModal();
        document.documentElement.classList.add('quick-modal-open');

        try {
            const response = await fetch(trigger.dataset.url, { signal: this.abortController.signal });
            if (!response.ok) throw new Error(`Quick modal request failed: ${response.status}`);

            const html = await response.text();
            const parsedDocument = new DOMParser().parseFromString(html, 'text/html');
            const content = parsedDocument.querySelector('.quick-product-form');
            if (!content) throw new Error('Quick modal response had no content');

            this.body.innerHTML = '';
            this.body.appendChild(content);
            window.theme?.slider?.init(this.body);
        } catch (error) {
            if (error.name === 'AbortError') return;
            console.error(error);
            this.body.innerHTML = `<p class="quick-modal__error text-body">${this.dataset.errorText || ''}</p>`;
        } finally {
            this.loadingEl?.setAttribute('hidden', '');
            trigger.removeAttribute('aria-busy');
        }
    }

    close() {
        this.dialog?.close();
    }

    onClose() {
        document.documentElement.classList.remove('quick-modal-open');
        this.body.innerHTML = '';
        this.opener?.focus();
        this.opener = null;
    }
}

customElements.define('quick-modal', QuickModal);
