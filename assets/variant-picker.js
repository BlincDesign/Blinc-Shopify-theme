/**
 * <variant-picker> reads the currently selected option values and greys out
 * combinations that don't resolve to an available variant. <product-info>
 * is the reusable listener: it reacts to selection changes by updating
 * price/sku/inventory/media/buy-button state within itself, using data
 * attributes rather than page-specific IDs so the exact same markup works
 * on the product page, inside Quick Add, and inside Quick View.
 */
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

    getOptionGroups() {
        return [...this.querySelectorAll('[data-option-position]')].sort(
            (a, b) => Number(a.dataset.optionPosition) - Number(b.dataset.optionPosition)
        );
    }

    getSelectedOptions() {
        return this.getOptionGroups().map((group) => {
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

    updateAvailability(variants, selectedOptions) {
        const unavailableText = this.dataset.unavailableOptionText || '';

        this.getOptionGroups().forEach((group, position) => {
            const select = group.querySelector('select[data-option-input]');

            if (select) {
                [...select.options].forEach((option) => {
                    const isAvailable = this.isVariantAvailableFor(variants, selectedOptions, position, option.value);
                    option.disabled = !isAvailable;

                    const label = option.dataset.label;
                    option.textContent = isAvailable ? label : `${label} ${unavailableText}`;
                });
                return;
            }

            group.querySelectorAll('input[data-option-input]').forEach((input) => {
                const isAvailable = this.isVariantAvailableFor(variants, selectedOptions, position, input.value);

                input.closest('.variant-picker__item')?.classList.toggle('is-unavailable', !isAvailable);
                input.nextElementSibling
                    ?.querySelector('.variant-picker__unavailable-label')
                    ?.toggleAttribute('hidden', isAvailable);
            });
        });
    }

    isVariantAvailableFor(variants, selectedOptions, position, candidateValue) {
        const candidate = [...selectedOptions];
        candidate[position] = candidateValue;

        return variants.some(
            (variant) => variant.available && variant.options.every((value, index) => value === candidate[index])
        );
    }
}

customElements.define('variant-picker', VariantPicker);

class ProductInfo extends HTMLElement {
    connectedCallback() {
        const dataScript = this.querySelector('[data-variant-data]');
        this.variants = dataScript ? JSON.parse(dataScript.textContent) : {};
        this.variantList = Object.values(this.variants);

        this.variantPicker = this.querySelector('variant-picker');
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
        const variant = this.variantList.find((candidate) =>
            candidate.options.every((value, index) => value === selectedOptions[index])
        );

        this.variantPicker?.updateAvailability(this.variantList, selectedOptions);

        this.updatePrice(variant);
        this.updateSku(variant);
        this.updateInventory(variant);
        this.updateBuyButton(variant);
        this.updateQuantityMax(variant);
        this.updateMedia(variant);
        this.updateUrl(variant);

        if (this.variantIdInput) this.variantIdInput.value = variant ? variant.id : '';

        this.dispatchEvent(new CustomEvent('variant:change', { bubbles: true, detail: { variant } }));
    }

    updatePrice(variant) {
        if (!this.priceEl) return;

        if (!variant) {
            this.priceEl.hidden = true;
            return;
        }

        this.priceEl.hidden = false;
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

        if (!variant) {
            this.inventoryEl.hidden = true;
            return;
        }
        this.inventoryEl.hidden = false;

        if (!variant.available) {
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
        if (this.dataset.updateUrl === 'false' || !variant || !window.history?.replaceState) return;
        const url = new URL(window.location.href);
        url.searchParams.set('variant', variant.id);
        window.history.replaceState({}, '', url);
    }
}

customElements.define('product-info', ProductInfo);
