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

class CarouselSlider extends HTMLElement {
  connectedCallback() {
    this.track = this.querySelector('[data-carousel-track]');
    this.slides = Array.from(this.querySelectorAll('[data-carousel-slide]'));
    this.dots = Array.from(this.querySelectorAll('[data-carousel-dot]'));
    this.prevButton = this.querySelector('[data-carousel-prev]');
    this.nextButton = this.querySelector('[data-carousel-next]');
    this.loop = this.dataset.loop === 'true';
    this.currentIndex = 0;

    if (!this.track || this.slides.length <= 1) return;

    this.onScroll = this.onScroll.bind(this);

    this.prevButton?.addEventListener('click', () => this.go(this.currentIndex - 1));
    this.nextButton?.addEventListener('click', () => this.go(this.currentIndex + 1));
    this.dots.forEach((dot, index) => dot.addEventListener('click', () => this.go(index)));
    this.track.addEventListener('scroll', this.onScroll, { passive: true });
  }

  disconnectedCallback() {
    this.track?.removeEventListener('scroll', this.onScroll);
  }

  go(index) {
    const total = this.slides.length;
    const nextIndex = this.loop ? (index + total) % total : Math.min(Math.max(index, 0), total - 1);
    this.slides[nextIndex].scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
  }

  onScroll() {
    const trackLeft = this.track.getBoundingClientRect().left;
    let closestIndex = 0;
    let closestDistance = Infinity;

    this.slides.forEach((slide, index) => {
      const distance = Math.abs(slide.getBoundingClientRect().left - trackLeft);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    if (closestIndex === this.currentIndex) return;
    this.currentIndex = closestIndex;
    this.dots.forEach((dot, index) => {
      const isActive = index === this.currentIndex;
      dot.classList.toggle('is-active', isActive);
      dot.setAttribute('aria-current', isActive ? 'true' : 'false');
    });
  }
}

customElements.define('carousel-slider', CarouselSlider);

document.addEventListener('change', (event) => {
  if (event.target.matches('[data-localization-form-select]')) {
    event.target.form.submit();
  }
});
