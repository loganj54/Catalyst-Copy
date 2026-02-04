# Design & Styling Reference

This document serves as a comprehensive style guide for the Catalyst Copy project, specifically focusing on the "Homework Style Blueprint" aesthetic. Use this reference to ensure consistency in design, styling, and visual structure for all future blueprint pages and styling decisions.

## 1. Core Visual Identity

### Fonts & Typography
*   **Primary Font**: `font-sans` (Inter / System Default) - Used for body text, UI elements.
*   **Display Font**: `font-display` (Inter Tight) - Used for Headers (H1, H2) and large titles.
*   **Math Font**: KaTeX fonts (via `LatexText` component).

**Hierarchy & Classes:**
*   **Page Title (H1)**: `text-4xl md:text-5xl tracking-tighter font-light text-stone-900 dark:text-stone-100`
    *   *Note*: Often accompanied by `mb-6` spacing.
*   **Section Header (H2)**: `text-3xl font-light tracking-tight text-stone-900 dark:text-stone-100 mt-12 mb-6`
*   **Sub-Header (H3)**: `text-2xl font-medium tracking-tight text-stone-900 dark:text-stone-100 mt-8 mb-4`
*   **Card Title (H4)**: `text-xl font-medium text-stone-900 dark:text-stone-100`
*   **Body Text (P)**: `text-base text-stone-700 dark:text-stone-300 leading-relaxed max-w-none`
*   **Meta/Labels**: `text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400`

### Color Palette
*   **Base Backgrounds**:
    *   Light: `bg-stone-50` or `bg-stone-100`
    *   Dark: `bg-stone-950`
    *   Cards/Containers: `bg-white` (Light) / `bg-stone-900` (Dark)
*   **Text Colors**:
    *   Primary: `text-stone-900` / `text-stone-100` (Title, Headings)
    *   Secondary: `text-stone-700` / `text-stone-300` (Body)
    *   Muted: `text-stone-500` / `text-stone-400` (Meta, Placeholders)
*   **Accents**:
    *   **Orange**: `#FF4A1C` (Brand highlight, "Practice" tags, hover states)
    *   **Blue**: `text-blue-600` (Links, "Learn" tags)
    *   **Green**: `text-green-600` (Success, "Completed" tags)
*   **Borders**: `border-stone-200` (Light) / `border-stone-700` (Dark) / `border-stone-800` (Subtle)

### Backgrounds & Textures
*   **Main Wrapper**: `bg-stone-100 dark:bg-stone-950`
*   **Patterns**:
    *   **Grid**: Linear gradient grid `bg-[size:24px_24px]` with `opacity-25`.
    *   **Dots**: `bg-pattern-dots opacity-100`.
*   **Gradients**: Often used as a fade mask over the background pattern: `bg-gradient-to-b from-white via-transparent to-white`.

---

## 2. Layout & Structure

### Main Page Layout
The application uses a **Sidebar + Main Content** layout.
*   **Container**: `flex h-full w-full py-3 pr-3 pl-0 gap-0 overflow-hidden`
*   **Sidebar (Left)**:
    *   Width: `w-[250px]`
    *   Style: `bg-white dark:bg-stone-900 rounded-2xl shadow-xl border-l border-stone-200`
    *   Placement: Hidden on mobile, flex on LG screens.
*   **Main Content (Right)**:
    *   Style: `flex-1 flex flex-col min-w-0 ml-3 rounded-2xl shadow-xl bg-white dark:bg-stone-950`
    *   *Critical*: The main content area has its own `rounded-2xl` and `shadow-xl`, distinct from the sidebar.

### Header Structure (Sticky)
*   **Placement**: `relative z-30 w-full`
*   **Style**: `bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800`
*   **Content**:
    *   **Left**: Page Title (`text-xl font-normal tracking-tight`).
    *   **Right**: Action Buttons (View Document, New Thread, History).
    *   **Center Overlay**: Absolute positioned pills for section titles or chat titles (`bg-white/50 backdrop-blur-sm rounded-full`).

---

## 3. UI Components

### Buttons
*   **Primary Action**:
    *   `bg-black dark:bg-white text-white dark:text-black`
    *   `hover:opacity-80` or `hover:bg-stone-800`
    *   `rounded-lg px-4 py-2 font-medium text-sm`
    *   `shadow-sm active:scale-95 transition-all`
*   **Secondary/Outline**:
    *   `bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300`
    *   `border border-stone-200 dark:border-stone-700`
    *   `hover:bg-stone-50 dark:hover:bg-stone-700`
*   **Ghost/Icon**:
    *   `p-2 hover:bg-stone-100 rounded-lg transition-colors`
*   **Navigation Tabs (Sidebar)**:
    *   Active: `bg-stone-100 text-black`
    *   Inactive: `text-gray-600 hover:bg-gray-50 hover:text-gray-900`
    *   Style: `w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm font-medium`

### Cards & Containers
*   **Main Content Section (Central Column)**:
    *   `bg-white` (Light) / `bg-stone-950` (Dark)
    *   `rounded-2xl`
    *   `shadow-xl`
    *   *Note*: borders are explicitly removed to allow the content to flow naturally into the backdrop.
*   **Standard/Internal Card**:
    *   `bg-white dark:bg-stone-900`
    *   `rounded-xl`
    *   `border border-stone-200 dark:border-stone-700`
    *   `shadow-sm`
*   **Interactive Card**:
    *   Add `hover:border-gray-400 hover:shadow-md transition-all cursor-pointer`
*   **Inner Well**:
    *   `bg-stone-50 dark:bg-stone-900`
    *   `border border-stone-100 dark:border-stone-700/50`
    *   `rounded-lg`

### Badges & Pills
*   **Standard**: `px-3 py-1 bg-stone-100 text-xs font-bold uppercase tracking-wider text-stone-500 rounded-lg`
*   **Success (Green)**: `bg-green-500/10 text-green-600 rounded-full`
*   **Brand (Orange)**: `bg-white/90 text-[#FF4A1C] backdrop-blur-sm`

---

## 4. Page-Specific Styling

### Blueprint Section ("Prerequisites" / "Lecture")
*   **Layout**: `max-w-5xl mx-auto px-6 pt-32 pb-24`
*   **Typography**: Relies heavily on `LECTURE_TYPOGRAPHY` (prose-stone, font-light headers).
*   **Resource Table**:
    *   `rounded-xl border border-gray-300 overflow-hidden`
    *   Header: `bg-stone-50 uppercase text-xs font-medium text-stone-500`
    *   Rows: `hover:bg-stone-50 transition-colors`

### Tools: Chat with Document
*   **Layout**: Full height, flex column.
*   **Empty State**:
    *   Centered content `pt-[max(2rem,calc(50vh-20.25rem))]`
    *   Large Title: `text-4xl md:text-5xl font-display`
*   **Input Area**:
    *   `bg-white dark:bg-stone-900`
    *   `rounded-2xl shadow-xl border border-gray-300`
    *   `focus-within:ring-2 focus-within:ring-black/5`
*   **Messages**:
    *   User: `bg-black text-white rounded-2xl px-6 py-4`
    *   Assistant: `bg-white border border-stone-200 text-stone-800 rounded-2xl px-6 py-4`

### Tools: Generate Practice Problems
*   **Layout**: `grid grid-cols-1 xl:grid-cols-3 gap-8`
*   **Problem Card**:
    *   `bg-white rounded-xl border border-gray-300 shadow-sm`
    *   Header: `font-semibold text-lg text-stone-800`
*   **Problem Bank Sidebar** (Right):
    *   `absolute top-0 right-0 h-full w-80 bg-white border-l`
    *   `shadow-2xl` when open.

---

## 5. Implementation Checklist (For New Blueprints)

1.  **Wrapper**: Start with the `bg-stone-100` wrapper and the 2-column Sidebar/Main layout.
2.  **Header**: Implement the sticky header with `z-30` and the center absolute pil.
3.  **Typography**: Apply `font-light tracking-tight` to all major headings. Avoid bold weights for H1/H2.
4.  **Borders**: Ensure subtle `border-stone-200` is used for separation, avoiding harsh blacks/grays.
5.  **Shadows**: Use `shadow-xl` for the main content block and sidebar. The main content block should have NO border, while internal cards use `shadow-sm` and subtle borders.
6.  **Spacing**: Use consistent spacing units: `gap-8` for major grids, `p-6` or `p-8` for content padding.
