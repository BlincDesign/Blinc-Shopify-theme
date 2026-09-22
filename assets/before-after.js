class BeforeAfterSlider extends HTMLElement {
    connectedCallback() {
        this.frame = this.querySelector('.before-after__frame');
        this.afterImage = this.querySelector('.before-after__image--after');
        this.handle = this.querySelector('.before-after__handle');

        if (!this.frame || !this.afterImage || !this.handle) return;

        this.dragging = false;

        const initial = Number(this.dataset.initial);
        this.setPosition(Number.isNaN(initial) ? 50 : initial);

        this.handle.addEventListener('pointerdown', (event) => {
            this.dragging = true;
            this.handle.setPointerCapture(event.pointerId);
        });

        this.handle.addEventListener('pointermove', (event) => {
            if (!this.dragging) return;
            this.updateFromClientX(event.clientX);
        });

        this.handle.addEventListener('pointerup', () => {
            this.dragging = false;
        });

        this.handle.addEventListener('pointercancel', () => {
            this.dragging = false;
        });

        this.handle.addEventListener('keydown', (event) => {
            const step = event.shiftKey ? 10 : 2;
            let position = Number(this.handle.getAttribute('aria-valuenow'));

            if (event.key === 'ArrowLeft') {
                position -= step;
            } else if (event.key === 'ArrowRight') {
                position += step;
            } else if (event.key === 'Home') {
                position = 0;
            } else if (event.key === 'End') {
                position = 100;
            } else {
                return;
            }

            event.preventDefault();
            this.setPosition(position);
        });

        // Clicking/tapping anywhere in the frame jumps the slider to that point.
        this.frame.addEventListener('pointerdown', (event) => {
            if (event.target === this.handle) return;
            this.updateFromClientX(event.clientX);
        });
    }

    updateFromClientX(clientX) {
        const rect = this.frame.getBoundingClientRect();
        const position = ((clientX - rect.left) / rect.width) * 100;
        this.setPosition(position);
    }

    setPosition(position) {
        position = Math.min(100, Math.max(0, position));

        this.afterImage.style.clipPath = `inset(0 ${100 - position}% 0 0)`;
        this.handle.style.left = `${position}%`;
        this.handle.setAttribute('aria-valuenow', String(Math.round(position)));
    }
}

if (!customElements.get('before-after-slider')) {
    customElements.define('before-after-slider', BeforeAfterSlider);
}
