class CountdownTimer extends HTMLElement {
    connectedCallback() {
        this.target = new Date(this.dataset.target).getTime();
        this.completed = false;

        if (Number.isNaN(this.target)) {
            console.error('Countdown timer: invalid target date', this.dataset.target);
            return;
        }

        this.daysEl = this.querySelector('[data-days]');
        this.hoursEl = this.querySelector('[data-hours]');
        this.minutesEl = this.querySelector('[data-minutes]');
        this.secondsEl = this.querySelector('[data-seconds]');
        this.statusEl = this.querySelector('[data-countdown-status]');

        this.tick();
        this.interval = setInterval(() => this.tick(), 1000);
    }

    disconnectedCallback() {
        clearInterval(this.interval);
    }

    tick() {
        const diff = this.target - Date.now();

        if (diff <= 0) {
            clearInterval(this.interval);
            this.render(0, 0, 0, 0);
            if (!this.completed) this.complete();
            return;
        }

        const days = Math.floor(diff / 86400000);
        const hours = Math.floor((diff % 86400000) / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);

        this.render(days, hours, minutes, seconds);
    }

    render(days, hours, minutes, seconds) {
        if (this.daysEl) this.daysEl.textContent = String(days).padStart(2, '0');
        if (this.hoursEl) this.hoursEl.textContent = String(hours).padStart(2, '0');
        if (this.minutesEl) this.minutesEl.textContent = String(minutes).padStart(2, '0');
        if (this.secondsEl) this.secondsEl.textContent = String(seconds).padStart(2, '0');
    }

    complete() {
        this.completed = true;
        const behavior = this.dataset.completionBehavior;
        const message = this.dataset.completionMessage || 'This offer has ended.';

        if (behavior === 'hide') {
            this.closest('.countdown-timer')?.remove();
        } else if (behavior === 'message') {
            const unitsEl = this.querySelector('.countdown-timer__units');
            if (unitsEl) unitsEl.hidden = true;

            const messageEl = document.createElement('p');
            messageEl.className = 'countdown-timer__message text-body';
            messageEl.textContent = message;
            this.appendChild(messageEl);
        }

        if (this.statusEl) this.statusEl.textContent = message;
    }
}

if (!customElements.get('countdown-timer')) {
    customElements.define('countdown-timer', CountdownTimer);
}
