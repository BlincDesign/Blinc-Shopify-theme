class VariantPicker extends HTMLElement {
    connectedCallback() {
        this.addEventListener('change', this.onChange.bind(this));
    }

    onChange() {
        const productInfo = this.closest('product-info');
        if (!productInfo) return;

        this.updateSelectedValueLabels();
        productInfo.onOptionChange(this.getSelectedOptions());
    }

    getSelectedOptions() {
        const groups = [...this.querySelectorAll('[data-option-position]')].sort(
            (a, b) => Number(a.dataset.optionPosition) - Number(b.dataset.optionPosition)
        );

        return groups.map((group) => {
            const select = group.querySelector('select[data-option-input]');
            if (select) return select.value;

            const checked = group.querySelector('input[data-option-input]:checked');
            return checked ? checked.value : null;
        });
    }

    updateSelectedValueLabels() {
        this.querySelectorAll('[data-option-position]').forEach((group) => {
            const valueEl = group.querySelector('.variant-picker__value');
            const checked = group.querySelector('input[data-option-input]:checked');
            if (valueEl && checked) valueEl.textContent = checked.value;
        });
    }
}

customElements.define('variant-picker', VariantPicker);

class QuantitySelector extends HTMLElement {
    connectedCallback() {
        this.input = this.querySelector('[data-quantity-input]');
        this.decreaseBtn = this.querySelector('[data-decrease]');
        this.increaseBtn = this.querySelector('[data-increase]');

        this.decreaseBtn?.addEventListener('click', () => this.step(-1));
        this.increaseBtn?.addEventListener('click', () => this.step(1));
        this.input?.addEventListener('change', () => this.clamp());
    }

    step(direction) {
        if (!this.input) return;
        const min = Number(this.input.min) || 1;
        const current = Number(this.input.value) || min;
        this.input.value = current + direction;
        this.clamp();
    }

    clamp() {
        if (!this.input) return;
        const min = Number(this.input.min) || 1;
        const max = this.input.max ? Number(this.input.max) : Infinity;
        this.input.value = Math.min(Math.max(Number(this.input.value) || min, min), max);
    }

    setMax(max) {
        if (!this.input) return;
        if (max > 0) {
            this.input.max = max;
            if (Number(this.input.value) > max) this.input.value = max;
        } else {
            this.input.removeAttribute('max');
        }
    }
}

customElements.define('quantity-selector', QuantitySelector);

class ProductInfo extends HTMLElement {
    connectedCallback() {
        const dataScript = this.querySelector('[data-variant-data]');
        this.variants = dataScript ? JSON.parse(dataScript.textContent) : {};

        this.priceEl = this.querySelector('[data-product-price]');
        this.skuWrapperEl = this.querySelector('[data-product-sku]');
        this.skuValueEl = this.querySelector('[data-product-sku-value]');
        this.inventoryEl = this.querySelector('[data-product-inventory]');
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

    onOptionChange(selectedOptions) {
        const variant = Object.values(this.variants).find(
            (candidate) => JSON.stringify(candidate.options) === JSON.stringify(selectedOptions)
        );

        this.updatePrice(variant);
        this.updateSku(variant);
        this.updateInventory(variant);
        this.updateBuyButton(variant);
        this.updateQuantityMax(variant);
        this.updateMedia(variant);
        this.updateUrl(variant);

        if (variant && this.variantIdInput) this.variantIdInput.value = variant.id;
    }

    updatePrice(variant) {
        if (!this.priceEl || !variant) return;

        this.priceEl.innerHTML = variant.onSale
            ? `<span class="product__price-compare">${variant.compareAtPriceHtml}</span><span class="product__price-sale">${variant.priceHtml}</span>`
            : `<span>${variant.priceHtml}</span>`;
    }

    updateSku(variant) {
        if (!this.skuWrapperEl || !this.skuValueEl) return;

        if (variant && variant.sku) {
            this.skuValueEl.textContent = variant.sku;
            this.skuWrapperEl.hidden = false;
        } else {
            this.skuWrapperEl.hidden = true;
        }
    }

    updateInventory(variant) {
        if (!this.inventoryEl) return;

        if (!variant || !variant.available) {
            this.inventoryEl.textContent = this.dataset.outOfStockText || '';
            this.inventoryEl.dataset.state = 'out-of-stock';
            return;
        }

        const tracked = variant.inventoryManagement === 'shopify' && variant.inventoryPolicy === 'deny';
        const threshold = Number(this.dataset.lowStockThreshold || 10);

        if (tracked && variant.inventoryQuantity > 0 && variant.inventoryQuantity <= threshold) {
            this.inventoryEl.textContent = (this.dataset.lowStockText || '').replace('[count]', variant.inventoryQuantity);
            this.inventoryEl.dataset.state = 'low-stock';
        } else {
            this.inventoryEl.textContent = this.dataset.inStockText || '';
            this.inventoryEl.dataset.state = 'in-stock';
        }
    }

    updateBuyButton(variant) {
        if (!this.atcButton) return;

        const available = Boolean(variant && variant.available);
        this.atcButton.disabled = !available;
        this.atcButton.classList.toggle('button--disabled', !available);
        this.atcButton.textContent = !variant
            ? this.dataset.unavailableText
            : available
            ? this.dataset.addToCartText
            : this.dataset.soldOutText;
    }

    updateQuantityMax(variant) {
        if (!this.quantitySelector) return;
        const tracked = variant && variant.inventoryManagement === 'shopify' && variant.inventoryPolicy === 'deny';
        this.quantitySelector.setMax(tracked ? variant.inventoryQuantity : 0);
    }

    updateMedia(variant) {
        if (!variant || !variant.featuredMediaId) return;

        const index = [...this.querySelectorAll('[data-media-id]')].findIndex(
            (el) => el.dataset.mediaId === String(variant.featuredMediaId)
        );
        if (index === -1) return;

        this.goToMediaIndex(index, variant.featuredMediaId);

        const thumbnail = this.querySelector(`[data-thumbnail][data-target-media-id="${variant.featuredMediaId}"]`);
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

    updateUrl(variant) {
        if (!variant || !window.history?.replaceState) return;
        const url = new URL(window.location.href);
        url.searchParams.set('variant', variant.id);
        window.history.replaceState({}, '', url);
    }
}

customElements.define('product-info', ProductInfo);
