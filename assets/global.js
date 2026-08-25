window.theme = window.theme || {};
window.theme.settings = window.theme.settings || {};


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

        // Resolve CSS variables before passing config to Swiper.
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

        // Already pixels.
        if (value.endsWith('px')) {
            return numericValue;
        }

        // Convert relative CSS units such as rem/em/%/vw/etc.
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