window.theme = window.theme || {};
window.theme.settings = window.theme.settings || {};

class StickyHeader extends HTMLElement {
    constructor() {
        super();
        this.onScroll = this.onScroll.bind(this);
    }

    connectedCallback() {
        this.type = this.dataset.stickyType;

        if (!this.type || this.type === 'none') return;

        this.lastScrollY = window.scrollY;
        window.addEventListener('scroll', this.onScroll, { passive: true });
    }

    disconnectedCallback() {
        window.removeEventListener('scroll', this.onScroll);
    }

    onScroll() {
        const currentScrollY = window.scrollY;

        if (this.type === 'always-reduce-logo-size') {
            this.classList.toggle('header--condensed', currentScrollY > 50);
        }

        if (this.type === 'on-scroll-up') {
            const scrollingDown = currentScrollY > this.lastScrollY;
            this.classList.toggle('header--hidden', scrollingDown && currentScrollY > this.offsetHeight);
        }

        this.lastScrollY = currentScrollY;
    }
}

customElements.define('sticky-header', StickyHeader);

const Utils = {
    safeQueryAll(selector, container = document) {
        try {
            if (!container || typeof container.querySelectorAll !== 'function') return [];
            return Array.from(container.querySelectorAll(selector));
        } catch (error) {
            console.error('safeQueryAll failed:', error);
            return [];
        }
    }
};

class Slider {
    constructor(options = {}) {
        const themeDefaults = window.theme.settings.slider ?? {};
        this.defaults = this.merge(themeDefaults);
        this.instances = new Map();
    }

    init(container = document) {
        Utils.safeQueryAll('[data-slider]', container).forEach((slider) => this.initOne(slider));
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
        Utils.safeQueryAll('[data-slider]', container).forEach((slider) => this.destroyOne(slider));
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

window.theme.slider = new Slider();

document.addEventListener('DOMContentLoaded', () => {
    window.theme.slider.init();
    window.theme.slider.bindShopifySections();
});

document.addEventListener('change', (event) => {
    if (event.target.matches('[data-localization-form-select]')) {
        event.target.form.submit();
    }
});