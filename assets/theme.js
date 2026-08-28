window.theme = window.theme || {};
window.theme.settings = window.theme.settings || {};

window.theme.debounce = function debounce(fn, delay = 400) {
    let timeoutId;
    return function debounced(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
};

window.theme.formatMoney = function formatMoney(cents, currencyCode) {
    try {
        return new Intl.NumberFormat(document.documentElement.lang || 'en', {
            style: 'currency',
            currency: currencyCode,
        }).format(cents / 100);
    } catch (error) {
        return (cents / 100).toFixed(2);
    }
};

window.theme.dispatchCartUpdate = function dispatchCartUpdate(cart) {
    document.dispatchEvent(new CustomEvent('cart:updated', { detail: { cart } }));
};

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
        const step = Number(this.input.step) || 1;
        const min = Number(this.input.min) || 1;
        const current = Number(this.input.value) || min;
        this.input.value = current + direction * step;
        this.clamp();
        this.input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    clamp() {
        if (!this.input) return;
        const min = Number(this.input.min) || 1;
        const max = this.input.max ? Number(this.input.max) : Infinity;
        const step = Number(this.input.step) || 1;

        let value = Number(this.input.value) || min;
        value = min + Math.round((value - min) / step) * step;
        value = Math.min(Math.max(value, min), max);

        this.input.value = value;
    }

    setMin(min) {
        if (!this.input) return;
        this.input.min = min;
        if (Number(this.input.value) < min) this.input.value = min;
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

    setStep(step) {
        if (!this.input) return;
        this.input.step = step > 0 ? step : 1;
    }

    setDisabled(disabled) {
        if (!this.input) return;
        this.input.disabled = disabled;
        if (this.decreaseBtn) this.decreaseBtn.disabled = disabled;
        if (this.increaseBtn) this.increaseBtn.disabled = disabled;
    }
}

customElements.define('quantity-selector', QuantitySelector);

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
            if (typeof window.Swiper === 'undefined') throw new Error('Swiper is not available');
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

        const prevEl = slider.querySelector('[slider-prev]');
        const nextEl = slider.querySelector('[slider-next]');
        const scrollbarEl = slider.querySelector('[slider-scrollbar]');
        const paginationEl = slider.querySelector('[slider-pagination]');

        if (prevEl && nextEl) {
            config.navigation = {
                ...config.navigation,
                prevEl,
                nextEl
            };
        }

        if (scrollbarEl) {
            config.scrollbar = {
                draggable: true,
                ...config.scrollbar,
                el: scrollbarEl
            };
        } else if (paginationEl) {
            config.pagination = {
                clickable: true,
                ...config.pagination,
                el: paginationEl
            };
        }

        return config;
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
        document.addEventListener('shopify:section:load', (event) => this.init(event.target));
        document.addEventListener('shopify:section:unload', (event) => this.destroy(event.target));
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

    swapVariantPicker(doc, trigger) {
        const source = doc.querySelector('variant-picker');
        if (!source || !this.variantPicker) return;

        this.variantPicker.innerHTML = source.innerHTML;
        this.variantPicker.dataset.featuredMediaId = source.dataset.featuredMediaId || '';

        if (trigger?.id) this.variantPicker.querySelector(`#${trigger.id}`)?.focus();
    }

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

window.theme.debounce = function debounce(fn, wait = 300) {
    let timer;

    function debounced(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), wait);
    }

    debounced.cancel = () => clearTimeout(timer);

    return debounced;
};

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

            const cart = await this.updateCartCount();
            Toast.show(window.theme.strings?.addedToCart, 'success');
            window.theme.dispatchCartUpdate(cart);

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
