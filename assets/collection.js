class CollectionSort extends HTMLElement {
    connectedCallback() {
        this.select = this.querySelector('[data-sort-select]');
        this.select?.addEventListener('change', () => this.applySort());
    }

    applySort() {
        const url = new URL(window.location.href);
        url.searchParams.set('sort_by', this.select.value);
        url.searchParams.delete('page');
        window.location.href = url.toString();
    }
}

customElements.define('collection-sort', CollectionSort);
