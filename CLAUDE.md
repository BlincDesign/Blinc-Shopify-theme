# Blinc Theme — Project Constitution

Blinc Theme is a custom Shopify Online Store 2.0 theme built from scratch for wholesale (B2B) businesses. This document defines the coding standards, architecture, and conventions that every contributor must follow.

**Read this file before making any changes to the project.**

---

# Project Goals

Every contribution should improve one or more of the following:

- Performance
- Reusability
- Maintainability
- Accessibility
- Scalability
- User Experience

---

# Shopify Development

Use the Shopify Dev MCP whenever platform-specific information is required.

Examples:

- Liquid objects and filters
- Theme schema
- Theme blocks
- Shopify APIs
- Shopify best practices

Do not rely on memory for Shopify platform-specific features.

---

# Project Architecture

- Follow Shopify Online Store 2.0 best practices.
- Use JSON templates.
- Keep the project modular.
- One responsibility per file.
- Prefer reusable solutions over duplicate implementations.
- Extend existing functionality instead of recreating it.

---

# Naming Conventions

## Files

Use kebab-case.

Examples:

```text
hero-banner.liquid
product-main.liquid
collection-list.css
product-gallery.js
```

---

## CSS

Use BEM naming.

```css
.hero-banner {}
.hero-banner__content {}
.hero-banner__heading {}
.hero-banner--full-width {}
```

---

## JavaScript

Use descriptive class names and custom elements.

```

---

## Schema

Use descriptive snake_case IDs.

```text
show_price
button_label
enable_slider
heading_size
```

Avoid abbreviations.

---

# Reusability

Always check whether code already exists before creating new code.

## Snippets

If markup or logic can be reused across multiple sections, create a reusable snippet instead of duplicating the code.

## CSS

Before writing new CSS:

- Check if an existing utility class can be used.
- Reuse global utility classes whenever possible.
- Do not duplicate styles.

## JavaScript

Before writing JavaScript:

- Check if similar functionality already exists.
- Reuse existing utilities and components.
- Move reusable functionality into global JavaScript files.

---

# Global Utility Classes

Prefer utility classes over repeating CSS.

Examples:

```text
.flex
.flex-wrap
.flex-column

.items-center
.items-start
.items-end

.justify-center
.justify-between

.text-left
.text-center
.text-right

.grid

.hidden

.container

.w-full
```

---

# CSS Guidelines

- Keep reusable CSS in global stylesheets.
- Only place dynamic CSS inside the section.
- Keep selectors shallow.
- Avoid duplicate styles.
- Reuse utility classes whenever possible.

---

# JavaScript Guidelines

- Use Vanilla JavaScript only.
- Avoid unnecessary JavaScript.
- Keep section files focused on initialization.
- Move reusable logic into global JavaScript files.
- Do not use inline JavaScript.
- Do not use jQuery.

---

# Liquid Guidelines

- Always use `{%- -%}` syntax.
- Use semantic HTML.
- Keep Liquid readable.
- Avoid duplicate logic.
- Reuse snippets whenever possible.

---

# Images

Optimize image loading:

- Use `loading="eager"` and `fetchpriority="high"` for above-the-fold (LCP) images.
- Use `loading="lazy"` for images below the fold.
- Always provide appropriate `width`, `height`, and `sizes` attributes.

---

# Accessibility

Every feature should:

- Use semantic HTML.
- Be keyboard accessible.
- Have visible focus states.
- Support screen readers.
- Follow WCAG best practices.

---

# Before Creating New Code

Always ask:

- Does this already exist?
- Can I reuse a snippet?
- Can I reuse a component?
- Can I reuse existing CSS?
- Can I reuse existing JavaScript?

Prefer extending existing code over creating new implementations.

---

# Before Completing a Task

Verify that:

- The code follows the project architecture.
- The section is responsive.
- The schema is valid.
- Settings are organized.
- CSS is placed in the correct location.
- JavaScript is only added when necessary.
- No duplicate code has been introduced.
- Accessibility has been considered.

---

# Golden Rules

- Never duplicate code.
- Reuse before creating.
- Use snippets for reusable markup.
- Use global utility classes before writing new CSS.
- Move reusable JavaScript into global assets.
- Keep sections modular.
- Keep settings organized and consistent.
- Prioritize performance.
- Prioritize accessibility.
- Keep the code clean, readable, and maintainable.