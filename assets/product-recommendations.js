class ProductRecommendations extends HTMLElement {
    connectedCallback() {
        const observer = new IntersectionObserver(
            (entries, obs) => {
                if (!entries[0].isIntersecting) return;
                obs.unobserve(this);
                this.loadRecommendations();
            },
            { rootMargin: '0px 0px 400px 0px' }
        );

        observer.observe(this);
    }

    async loadRecommendations() {
        const url = this.dataset.url;
        if (!url) return;

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Request failed with status ${response.status}`);

            const text = await response.text();
            const doc = document.createElement('div');
            doc.innerHTML = text;

            const newContent = doc.querySelector('product-recommendations');

            if (newContent && newContent.innerHTML.trim()) {
                this.innerHTML = newContent.innerHTML;
            } else {
                this.closest('.recommended-products')?.remove();
            }
        } catch (error) {
            console.error('Product recommendations failed to load:', error);
            this.closest('.recommended-products')?.remove();
        }
    }
}

if (!customElements.get('product-recommendations')) {
    customElements.define('product-recommendations', ProductRecommendations);
}
