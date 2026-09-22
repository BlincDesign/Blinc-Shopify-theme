window.theme = window.theme || {};

const STORAGE_KEY = 'theme:recently-viewed';
const MAX_STORED = 16;

window.theme.recentlyViewed = {
    record(handle) {
        if (!handle) return;

        let handles = this._read();
        handles = handles.filter((h) => h !== handle);
        handles.unshift(handle);
        handles = handles.slice(0, MAX_STORED);

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(handles));
        } catch (error) {
            console.error('Could not save recently viewed products:', error);
        }
    },

    list(excludeHandle, limit) {
        let handles = this._read().filter((h) => h !== excludeHandle);
        if (limit) handles = handles.slice(0, limit);
        return handles;
    },

    _read() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            return [];
        }
    }
};

function recordCurrentProduct() {
    document.querySelectorAll('[data-recently-viewed-record]').forEach((el) => {
        window.theme.recentlyViewed.record(el.dataset.recentlyViewedRecord);
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', recordCurrentProduct);
} else {
    recordCurrentProduct();
}

class RecentlyViewedProducts extends HTMLElement {
    connectedCallback() {
        this.loadProducts();
    }

    async loadProducts() {
        const limit = Number(this.dataset.limit) || 4;
        const handles = window.theme.recentlyViewed.list(this.dataset.excludeHandle, limit);

        if (handles.length === 0) return;

        const cards = await Promise.all(handles.map((handle) => this.fetchCard(handle)));
        const validCards = cards.filter(Boolean);

        if (validCards.length === 0) return;

        validCards.forEach((card) => this.appendChild(card));

        const section = this.closest('[data-recently-viewed-section]');
        if (section) section.hidden = false;
    }

    async fetchCard(handle) {
        try {
            const response = await fetch(`/products/${handle}?section_id=recently-viewed-card`);
            if (!response.ok) throw new Error(`Request failed with status ${response.status}`);

            const text = await response.text();
            const doc = document.createElement('div');
            doc.innerHTML = text;

            return doc.querySelector('.product-card');
        } catch (error) {
            console.error(`Recently viewed: failed to load product "${handle}":`, error);
            return null;
        }
    }
}

if (!customElements.get('recently-viewed-products')) {
    customElements.define('recently-viewed-products', RecentlyViewedProducts);
}
