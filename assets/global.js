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

document.addEventListener('change', (event) => {
  if (event.target.matches('[data-localization-form-select]')) {
    event.target.form.submit();
  }
});
