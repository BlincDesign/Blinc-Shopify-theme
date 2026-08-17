class VariantPicker extends HTMLElement {
    connectedCallback() {
        this.addEventListener('change', this.onChange.bind(this));
    }

    onChange(event) {
        this.closest('product-info')?.onOptionChange(event.target);
    }

    getSelectedOptionValueIds() {
        return [...this.querySelectorAll('[data-option-position]')]
            .sort((a, b) => a - b)
            .map((group) => {
                const select = group.querySelector('select[data-option-input]');
                const input = select ?
                    select.selectedOptions[0] :
                    group.querySelector('input[data-option-input]:checked');
                return input?.dataset.optionValueId;
            })
            .filter(Boolean);
    }
}

customElements.define('variant-picker', VariantPicker);

class ProductInfo extends HTMLElement {
    connectedCallback() {
        this.variantPicker = this.querySelector('variant-picker');
        this.priceEl = this.querySelector('[data-product-price]');
        this.skuEl = this.querySelector('[data-product-sku]');
        this.inventoryEl = this.querySelector('[data-product-inventory]');
        this.volumePricingEl = this.querySelector('[data-product-volume-pricing]');
        this.variantIdInput = this.querySelector('[data-variant-id-input]');
        this.atcButton = this.querySelector('.product__atc-button');
        this.quantitySelector = this.querySelector('quantity-selector');

        this.querySelectorAll('[data-thumbnail]').forEach((button, index) => {
            button.addEventListener('click', () => {
                this.goToMediaIndex(index, button.dataset.targetMediaId);
                this.setActiveThumbnail(button);
            });
        });
    }

    disconnectedCallback() {
        this.abortController?.abort();
    }

    // Debounces the expensive section request; visual option selection
    // (the checked radio / selected dropdown option) is native browser
    // state and already updates instantly regardless of when the request
    // fires. The timer is reset on every subsequent change.
    onOptionChange(trigger) {
        if (!this.variantPicker || !this.dataset.sectionId) return;

        this.requestVariantUpdate(trigger);
    }

    async requestVariantUpdate(trigger) {
        this.abortController?.abort();
        this.abortController = new AbortController();

        try {
            const response = await fetch(this.buildRequestUrl(), { signal: this.abortController.signal });
            if (!response.ok) throw new Error(`Variant request failed: ${response.status}`);

            const html = await response.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');
            this.applyUpdate(doc, trigger);
        } catch (error) {
            if (error.name === 'AbortError') return;
            console.error(error);
        }
    }

    buildRequestUrl() {
        const params = new URLSearchParams({ section_id: this.dataset.sectionId });
        const optionValueIds = this.variantPicker.getSelectedOptionValueIds();
        if (optionValueIds.length) params.set('option_values', optionValueIds.join(','));

        return `${this.dataset.productUrl}?${params.toString()}`;
    }

    applyUpdate(doc, trigger) {
        this.swapVariantPicker(doc, trigger);
        this.copyFragment(doc, '[data-product-price]', this.priceEl);
        this.copyFragment(doc, '[data-product-sku]', this.skuEl);
        this.copyFragment(doc, '[data-product-inventory]', this.inventoryEl, ['data-state']);
        this.copyFragment(doc, '[data-product-volume-pricing]', this.volumePricingEl);
        this.updateBuyButton(doc);
        this.updateQuantityRules(doc);
        this.updateVariantId(doc);
        this.updateMedia(doc);
        this.updateUrl();

        this.dispatchEvent(new CustomEvent('variant:change', { bubbles: true }));
    }

    // <variant-picker>'s contents are swapped wholesale rather than
    // diffed, since Liquid already recomputed selected/available/disabled
    // state for every option value - there's nothing left for JS to work
    // out itself. Focus is restored to the equivalent (freshly rendered)
    // control so keyboard users don't lose their place.
    swapVariantPicker(doc, trigger) {
        const source = doc.querySelector('variant-picker');
        if (!source || !this.variantPicker) return;

        this.variantPicker.innerHTML = source.innerHTML;
        this.variantPicker.dataset.featuredMediaId = source.dataset.featuredMediaId || '';

        if (trigger?.id) this.variantPicker.querySelector(`#${trigger.id}`)?.focus();
    }

    // Copies a server-rendered fragment as-is (already-formatted price,
    // translated inventory text, etc.) instead of rebuilding it in JS.
    copyFragment(doc, selector, destination, attributes = []) {
        const source = doc.querySelector(selector);
        if (!source || !destination) return;

        destination.innerHTML = source.innerHTML;
        destination.hidden = source.hidden;
        attributes.forEach((attribute) => {
            if (source.hasAttribute(attribute)) {
                destination.setAttribute(attribute, source.getAttribute(attribute));
            } else {
                destination.removeAttribute(attribute);
            }
        });
    }

    updateBuyButton(doc) {
        const source = doc.querySelector('.product__atc-button');
        if (!source || !this.atcButton) return;

        this.atcButton.innerHTML = source.innerHTML;
        this.atcButton.disabled = source.disabled;
        this.atcButton.classList.toggle('button--disabled', source.classList.contains('button--disabled'));
    }

    // Reuses whatever min/max/step/disabled Liquid already computed (from
    // variant.quantity_rule and inventory) for the fetched quantity input,
    // rather than re-deriving those rules in JS.
    updateQuantityRules(doc) {
        if (!this.quantitySelector) return;
        const source = doc.querySelector('[data-quantity-input]');
        if (!source) return;

        this.quantitySelector.setMin(Number(source.getAttribute('min')) || 1);
        this.quantitySelector.setStep(Number(source.getAttribute('step')) || 1);
        this.quantitySelector.setMax(Number(source.getAttribute('max')) || 0);
        this.quantitySelector.setDisabled(source.hasAttribute('disabled'));
    }

    updateVariantId(doc) {
        if (!this.variantIdInput) return;
        const source = doc.querySelector('[data-variant-id-input]');
        this.variantIdInput.value = source ? source.value : '';
    }

    updateMedia(doc) {
        const mediaId = doc.querySelector('variant-picker')?.dataset.featuredMediaId;
        if (!mediaId) return;

        const index = [...this.querySelectorAll('[data-media-id]')].findIndex(
            (el) => el.dataset.mediaId === mediaId
        );
        if (index === -1) return;

        this.goToMediaIndex(index, mediaId);

        const thumbnail = this.querySelector(`[data-thumbnail][data-target-media-id="${mediaId}"]`);
        if (thumbnail) this.setActiveThumbnail(thumbnail);
    }

    goToMediaIndex(index, mediaId) {
        const sliderEl = this.querySelector('[data-slider]');
        if (sliderEl && sliderEl.swiper) {
            sliderEl.swiper.slideTo(index);
            return;
        }

        const target = this.querySelector(`[data-media-id="${mediaId}"]`);
        target?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }

    setActiveThumbnail(activeButton) {
        this.querySelectorAll('[data-thumbnail]').forEach((button) => {
            button.classList.toggle('is-active', button === activeButton);
        });
    }

    updateUrl() {
        if (this.dataset.updateUrl === 'false' || !window.history?.replaceState) return;

        const variantId = this.variantIdInput?.value;
        if (!variantId) return;

        const url = new URL(window.location.href);
        url.searchParams.set('variant', variantId);
        window.history.replaceState({}, '', url);
    }
}

customElements.define('product-info', ProductInfo);