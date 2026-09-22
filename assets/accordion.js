class AccordionGroup extends HTMLElement {
    connectedCallback() {
        this.allowMultiple = this.hasAttribute('data-allow-multiple');

        this.addEventListener('click', (event) => {
            const trigger = event.target.closest('.accordion-item__trigger');
            if (!trigger || !this.contains(trigger)) return;
            this.toggle(trigger);
        });
    }

    toggle(trigger) {
        const expanded = trigger.getAttribute('aria-expanded') === 'true';

        if (!this.allowMultiple && !expanded) {
            this.querySelectorAll('.accordion-item__trigger[aria-expanded="true"]').forEach((other) => {
                if (other !== trigger) this.setExpanded(other, false);
            });
        }

        this.setExpanded(trigger, !expanded);
    }

    setExpanded(trigger, expanded) {
        trigger.setAttribute('aria-expanded', String(expanded));

        const panel = this.querySelector(`#${trigger.getAttribute('aria-controls')}`);
        if (panel) panel.classList.toggle('accordion-item__panel--open', expanded);
    }
}

if (!customElements.get('accordion-group')) {
    customElements.define('accordion-group', AccordionGroup);
}

// Table of contents links (data-toc-link) point at an accordion trigger's id.
// Expand the target panel before the browser's native fragment scroll runs,
// so keyboard/screen reader users land on visible content, not a collapsed header.
document.addEventListener('click', (event) => {
    const link = event.target.closest('[data-toc-link]');
    if (!link) return;

    const targetId = link.getAttribute('href').slice(1);
    const trigger = document.getElementById(targetId);
    if (!trigger || trigger.getAttribute('aria-expanded') !== 'false') return;

    trigger.click();
});
