window.theme = window.theme || {};
window.theme.settings = window.theme.settings || {};

// Header
class StickyHeader {
  constructor(header) {
    this.header = header;
    this.section = header.closest('.shopify-section--header');
    this.type = header.dataset.stickyType;

    if (!this.section || !this.type || this.type === 'none') return;

    this.currentScrollY = window.scrollY;
    this.previousScrollY = window.scrollY;
    this.ticking = false;

    this.onScroll = this.onScroll.bind(this);

    this.section.classList.add('header--sticky');

    window.addEventListener('scroll', this.onScroll, {
      passive: true
    });
  }

  onScroll() {
    this.currentScrollY = window.scrollY;

    if (this.ticking) return;

    this.ticking = true;

    requestAnimationFrame(() => {
      const currentScrollY = this.currentScrollY;

      if (this.type === 'always-reduce-logo-size') {
            const progress = Math.min(currentScrollY / 80, 1);
            const scale = this.header.dataset.stickyLogoScale / 100;

            const currentScale = 1 - ((1 - scale) * progress);

            this.section.style.setProperty(
                '--header-logo-scale',
                currentScale
            );
       }

      if (this.type === 'on-scroll-up') {
        const scrollingDown = currentScrollY > this.previousScrollY;

        this.section.classList.toggle(
          'header--hidden',
          scrollingDown && currentScrollY > this.section.offsetHeight
        );

        this.previousScrollY = currentScrollY;
      }

      this.ticking = false;
    });
  }

  destroy() {
    window.removeEventListener('scroll', this.onScroll);
  }
}

document.querySelectorAll('.header').forEach((header) => {
  new StickyHeader(header);
});

// Quantity selector
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

// Slider
class Slider {
    constructor(options = {}) {
        const themeDefaults = window.theme.settings.slider ?? {};
        this.defaults = this.merge(themeDefaults);
        this.instances = new Map();
    }

    init(container = document) {
        try {
            container.querySelectorAll('[data-slider]').forEach((slider) => this.initOne(slider));
        } catch (error) {
            console.error('Slider initialization failed:', error);
        }
    }

    initOne(slider) {
        if (slider.swiper) return;

        try {
            if (typeof window.Swiper === 'undefined') {
                throw new Error('Swiper is not available');
            }

            slider.swiper = new window.Swiper(slider, this.getConfig(slider));

            delete slider.dataset.sliderError;
        } catch (error) {
            slider.dataset.sliderError = 'true';
            console.error('Slider initialization failed:', error);
        }
    }

    destroy(container = document) {
        try {
            container.querySelectorAll('[data-slider]').forEach((slider) => this.destroyOne(slider));
        } catch (error) {
            console.error('Slider destruction failed:', error);
        }
    }

    destroyOne(slider) {
        if (!slider.swiper) return;

        slider.swiper.destroy(true, true);
        slider.swiper = null;

        delete slider.dataset.sliderError;
    }

    reinit(container = document) {
        this.destroy(container);
        this.init(container);
    }

    getConfig(slider) {
        let overrides = {};

        if (slider.dataset.sliderConfig) {
            try {
                overrides = JSON.parse(slider.dataset.sliderConfig);
            } catch (error) {
                console.error('Invalid data-slider-config JSON:', error, slider);
            }
        }

        const config = this.merge(this.defaults, overrides);

        // Respects prefers-reduced-motion for every carousel in the theme.
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            delete config.autoplay;
        }

        const resolvedConfig = this.resolveCSSVariables(config, slider);

        const prevEl = slider.querySelector('[slider-prev]');
        const nextEl = slider.querySelector('[slider-next]');
        const scrollbarEl = slider.querySelector('[slider-scrollbar]');
        const paginationEl = slider.querySelector('[slider-pagination]');

        if (prevEl && nextEl) {
            resolvedConfig.navigation = {
                ...resolvedConfig.navigation,
                prevEl,
                nextEl
            };
        }

        if (scrollbarEl) {
            resolvedConfig.scrollbar = {
                draggable: true,
                ...resolvedConfig.scrollbar,
                el: scrollbarEl
            };
        } else if (paginationEl) {
            resolvedConfig.pagination = {
                clickable: true,
                ...resolvedConfig.pagination,
                el: paginationEl,
                type: paginationEl.dataset.paginationType || 'bullets'
            };
        }

        return resolvedConfig;
    }

    resolveCSSVariables(value, element) {
        if (typeof value === 'string') {
            const cssVariableMatch = value.match(/^var\(\s*(--[\w-]+)(?:\s*,\s*(.+))?\s*\)$/);

            if (!cssVariableMatch) {
                return value;
            }

            const variableName = cssVariableMatch[1];
            const fallback = cssVariableMatch[2];

            const computedValue = getComputedStyle(element)
                .getPropertyValue(variableName)
                .trim();

            const resolvedValue = computedValue || fallback;

            if (!resolvedValue) {
                console.warn(
                    `CSS variable "${variableName}" could not be resolved.`,
                    element
                );

                return value;
            }

            return this.cssValueToPixels(resolvedValue, element);
        }

        if (Array.isArray(value)) {
            return value.map((item) => this.resolveCSSVariables(item, element));
        }

        if (isPlainObject(value)) {
            const output = {};

            for (const [key, nestedValue] of Object.entries(value)) {
                output[key] = this.resolveCSSVariables(nestedValue, element);
            }

            return output;
        }

        return value;
    }

    cssValueToPixels(value, element) {
        const numericValue = parseFloat(value);

        if (Number.isNaN(numericValue)) {
            return value;
        }

        if (value.endsWith('px')) {
            return numericValue;
        }

        const probe = document.createElement('div');

        probe.style.position = 'absolute';
        probe.style.visibility = 'hidden';
        probe.style.pointerEvents = 'none';
        probe.style.width = value;

        element.appendChild(probe);

        const pixels = probe.getBoundingClientRect().width;

        probe.remove();

        return pixels;
    }

    merge(defaults = {}, overrides = {}) {
        const output = {
            ...defaults,
            ...overrides
        };

        for (const key of Object.keys(overrides)) {
            const defaultVal = defaults[key];
            const overrideVal = overrides[key];

            if (isPlainObject(defaultVal) && isPlainObject(overrideVal)) {
                output[key] = this.merge(defaultVal, overrideVal);
            }
        }

        return output;
    }

    bindShopifySections() {
        document.addEventListener('shopify:section:load', (event) => {
            this.init(event.target);
        });

        document.addEventListener('shopify:section:unload', (event) => {
            this.destroy(event.target);
        });
    }
}

function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

window.theme = window.theme || {};
window.theme.slider = new Slider();

function bootSlider() {
    window.theme.slider.init();
    window.theme.slider.bindShopifySections();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootSlider);
} else {
    bootSlider();
}

// Video
function disableAutoplayVideosIfReducedMotion(container = document) {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    container.querySelectorAll('video[autoplay]').forEach((video) => {
        video.pause();
        video.removeAttribute('autoplay');
        video.setAttribute('controls', 'controls');
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => disableAutoplayVideosIfReducedMotion());
} else {
    disableAutoplayVideosIfReducedMotion();
}

document.addEventListener('shopify:section:load', (event) => {
    disableAutoplayVideosIfReducedMotion(event.target);
});

// Cart utilities
window.theme.debounce = function debounce(fn, delay) {
    let timeoutId;

    const debounced = (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };

    debounced.cancel = () => clearTimeout(timeoutId);

    return debounced;
};

window.theme.dispatchCartUpdate = function dispatchCartUpdate(cart) {
    document.dispatchEvent(new CustomEvent('cart:updated', { detail: { cart } }));
};

window.theme.toast = {
    region: null,

    show(message, type = 'success') {
        if (!message) return;

        this.region = this.region || document.querySelector('[data-toast-region]');
        if (!this.region) return;

        const toast = document.createElement('div');
        toast.className = type === 'error' ? 'toast toast--error' : 'toast';
        toast.textContent = message;
        this.region.appendChild(toast);

        requestAnimationFrame(() => toast.classList.add('is-visible'));

        setTimeout(() => {
            toast.classList.remove('is-visible');
            toast.addEventListener('transitionend', () => toast.remove(), { once: true });
        }, 3000);
    }
};

// Shopify's standard money-format algorithm (matches money_format tokens
// configured in Settings > General, e.g. "${{amount}}").
window.theme.formatMoney = function formatMoney(cents, format) {
    format = format || window.theme.settings.moneyFormat || '${{amount}}';
    const value = Number(cents) / 100;

    function withDelimiters(number, precision, thousands, decimal) {
        number = Number(number).toFixed(precision);
        const parts = number.split('.');
        const dollars = parts[0].replace(/(\d)(?=(\d{3})+(?!\d))/g, `$1${thousands}`);
        const decimalPart = parts[1] ? decimal + parts[1] : '';
        return dollars + decimalPart;
    }

    const placeholder = format.match(/\{\{\s*(\w+)\s*\}\}/);
    if (!placeholder) return format;

    let formatted;
    switch (placeholder[1]) {
        case 'amount_no_decimals':
            formatted = withDelimiters(value, 0, ',', '.');
            break;
        case 'amount_with_comma_separator':
            formatted = withDelimiters(value, 2, '.', ',');
            break;
        case 'amount_with_space_separator':
            formatted = withDelimiters(value, 2, ' ', ',');
            break;
        case 'amount_no_decimals_with_comma_separator':
            formatted = withDelimiters(value, 0, '.', ',');
            break;
        default:
            formatted = withDelimiters(value, 2, ',', '.');
    }

    return format.replace(placeholder[0], formatted);
};

// Cart (add to cart)
document.addEventListener('submit', async (event) => {
    const form = event.target.closest('form[action*="/cart/add"]');
    if (!form) return;

    event.preventDefault();

    const submitter = event.submitter;
    const wasDisabled = submitter?.disabled;
    if (submitter) submitter.disabled = true;

    try {
        const routes = window.theme.routes || {};
        const response = await fetch(routes.cartAdd || '/cart/add.js', {
            method: 'POST',
            headers: { Accept: 'application/json' },
            body: new FormData(form)
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.description || window.theme.strings?.addToCartError);

        window.theme.dispatchCartUpdate(data);

        if (window.theme.settings.cartType === 'page') {
            window.location.href = routes.cartUrl || '/cart';
        }
    } catch (error) {
        console.error(error);
        window.theme.toast.show(error.message || window.theme.strings?.addToCartError, 'error');
    } finally {
        if (submitter) submitter.disabled = wasDisabled;
    }
});

// Product (variant picker)
class VariantPicker extends HTMLElement {
    connectedCallback() {
        const json = this.querySelector('[data-variant-json]');
        this.variants = json ? JSON.parse(json.textContent) : [];
        this.form = this.closest('form');
        this.productInfo = this.closest('product-info');

        this.addEventListener('change', (event) => {
            if (event.target.closest('[data-option-input]')) this.onOptionChange();
        });
    }

    getSelectedOptions() {
        return Array.from(this.querySelectorAll('[data-option-position]'))
            .sort((a, b) => Number(a.dataset.optionPosition) - Number(b.dataset.optionPosition))
            .map((fieldset) => {
                const checked = fieldset.querySelector('[data-option-input]:checked');
                if (checked) return checked.value;
                const select = fieldset.querySelector('select[data-option-input]');
                return select ? select.value : null;
            });
    }

    findMatchingVariant(selected) {
        return this.variants.find((variant) =>
            variant.options.every((value, index) => value === selected[index])
        );
    }

    onOptionChange() {
        this.updateVariant(this.findMatchingVariant(this.getSelectedOptions()));
    }

    updateVariant(variant) {
        const variantInput = this.form?.querySelector('[data-variant-id-input]');
        if (variantInput) variantInput.value = variant ? variant.id : '';

        this.updatePrice(variant);
        this.updateSku(variant);
        this.updateInventory(variant);
        this.updateBuyButton(variant);
        this.updateQuantity(variant);
        this.updateMedia(variant);
        this.updateUrl(variant);

        document.dispatchEvent(new CustomEvent('variant:change', { detail: { variant } }));
    }

    updatePrice(variant) {
        const priceEl = this.form?.querySelector('[data-product-price]');
        if (!priceEl || !variant) return;

        priceEl.innerHTML = variant.compare_at_price > variant.price
            ? `<span class="product__price-compare">${window.theme.formatMoney(variant.compare_at_price)}</span>
               <span class="product__price-sale">${window.theme.formatMoney(variant.price)}</span>`
            : `<span>${window.theme.formatMoney(variant.price)}</span>`;
    }

    updateSku(variant) {
        const skuWrapper = this.form?.querySelector('[data-product-sku]');
        const skuValue = this.form?.querySelector('[data-product-sku-value]');
        if (!skuWrapper || !skuValue || !variant) return;

        skuValue.textContent = variant.sku || '';
        skuWrapper.hidden = !variant.sku;
    }

    updateInventory(variant) {
        const inventoryEl = this.form?.querySelector('[data-product-inventory]');
        if (!inventoryEl) return;

        if (!variant) {
            inventoryEl.hidden = true;
            return;
        }

        inventoryEl.hidden = false;

        const threshold = Number(inventoryEl.dataset.lowStockThreshold) || 0;
        const tracked = variant.inventory_management === 'shopify' && variant.inventory_policy === 'deny';

        if (!variant.available) {
            inventoryEl.dataset.state = 'out-of-stock';
            inventoryEl.textContent = window.theme.strings?.outOfStock || 'Out of stock';
        } else if (tracked && variant.inventory_quantity <= threshold && variant.inventory_quantity > 0) {
            inventoryEl.dataset.state = 'low-stock';
            inventoryEl.textContent = (window.theme.strings?.lowStock || 'Only [count] left in stock').replace(
                '[count]',
                variant.inventory_quantity
            );
        } else {
            inventoryEl.dataset.state = 'in-stock';
            inventoryEl.textContent = window.theme.strings?.inStock || 'In stock';
        }
    }

    updateBuyButton(variant) {
        const button = this.form?.querySelector('[data-product-atc-button]');
        if (!button) return;

        const available = Boolean(variant && variant.available);
        button.disabled = !available;
        button.textContent = !variant
            ? window.theme.strings?.unavailable || 'Unavailable'
            : available
                ? window.theme.strings?.addToCart || 'Add to cart'
                : window.theme.strings?.soldOut || 'Sold out';
    }

    updateQuantity(variant) {
        const quantitySelector = this.form?.querySelector('quantity-selector');
        if (!quantitySelector || !variant) return;

        let max = variant.quantity_rule?.max ?? 0;
        if (variant.inventory_management === 'shopify' && variant.inventory_policy === 'deny') {
            max = max > 0 ? Math.min(max, variant.inventory_quantity) : variant.inventory_quantity;
        }

        quantitySelector.setMax(max);
    }

    updateMedia(variant) {
        if (!variant?.featured_media) return;

        const mediaId = String(variant.featured_media.id);
        const slide = this.productInfo?.querySelector(`[data-media-id="${mediaId}"]`);
        if (!slide) return;

        const slider = slide.closest('[data-slider]');
        if (slider?.swiper) {
            const index = Array.from(slider.querySelectorAll('[data-media-id]')).indexOf(slide);
            if (index > -1) slider.swiper.slideTo(index);
        } else {
            slide.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }
    }

    updateUrl(variant) {
        const productUrl = this.productInfo?.dataset.productUrl;
        if (!productUrl || !variant) return;

        // Only rewrite the address bar when this picker lives on that product's
        // own page - e.g. Featured Product or Quick View can embed a picker for
        // a product that isn't the current page, where this would be wrong.
        const productPath = productUrl.split('?')[0];
        if (window.location.pathname !== productPath) return;

        history.replaceState({}, '', `${productPath}?variant=${variant.id}`);
    }
}

customElements.define('variant-picker', VariantPicker);
