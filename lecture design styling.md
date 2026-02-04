# Lecture Design & Styling Reference

This document serves as a comprehensive style guide for the "Lecture Style Blueprint" page in the Catalyst Copy project. Use this reference to ensure consistency in design, styling, and visual structure for all lecture-related views and components.

## 1. Core Visual Identity

### Fonts & Typography
*   **Primary Font**: `font-sans` (System Default / Inter) - Used for body text, UI elements, and general content.
*   **Headings**: `font-light tracking-tight` (Inter Tight styling) - Used for all major headers to ensure a clean, modern, and academic aesthetic.
*   **Math**: KaTeX (via `LatexText` component) for all mathematical expressions.

**Markdown Content Typography (`LECTURE_TYPOGRAPHY`):**
*   **Container**: `prose prose-stone dark:prose-invert text-stone-600 dark:text-stone-400 leading-relaxed max-w-none font-sans`
*   **H1**: `text-4xl font-light tracking-tight text-stone-900 dark:text-stone-100 mt-12 mb-6 border-b border-stone-200 dark:border-stone-800 pb-4`
*   **H2**: `text-3xl font-light tracking-tight text-stone-900 dark:text-stone-100 mt-12 mb-6`
*   **H3**: `text-2xl font-medium tracking-tight text-stone-900 dark:text-stone-100 mt-8 mb-4`
*   **H4**: `text-xl font-bold text-stone-900 dark:text-stone-100 mt-6 mb-3`
*   **Paragraph (P)**: `mb-6 text-stone-700 dark:text-stone-300 text-base leading-relaxed`
*   **List Item (LI)**: `text-stone-700 dark:text-stone-300 text-base leading-relaxed mb-2`
*   **Lists**: `list-disc/list-decimal pl-5 mb-6 space-y-2`

### Color Palette
*   **Backgrounds**:
    *   Global Page: `bg-stone-100 dark:bg-stone-950`
    *   Containers/Cards: `bg-white dark:bg-stone-900` or `bg-stone-950`
    *   Active Tabs/Items: `bg-stone-100 dark:bg-stone-800`
*   **Text**:
    *   Primary: `text-stone-900` / `text-black`
    *   Secondary: `text-stone-700` / `text-stone-600`
    *   Muted/Meta: `text-stone-500` / `text-stone-400`
*   **Accents**:
    *   **Brand Orange**: `#FF4A1C` (Used on hover states, e.g., video titles)
    *   **Purple/Indigo**: `from-indigo-600 to-purple-600` (Used for "Generate" primary buttons)
    *   **Blue**: `text-blue-500` (Analysis states)
*   **Borders**: `border-stone-200` (Light) / `border-stone-800` (Dark) / `border-gray-300` (Cards)

### Background Patterns
The main content area supports layered background patterns:
1.  **Grid**: `bg-[linear-gradient(...)] bg-[size:24px_24px]` with a detailed `opacity-25` gray/white grid.
    *   *Mask*: Overlaid with `bg-gradient-to-b from-white via-transparent to-white` to soften the edges.
2.  **Dots**: `bg-pattern-dots opacity-100` (Alternative).

---

## 2. Layout & Structure

### Main Page Container
*   **Wrapper**: `flex h-full w-full py-3 pr-3 pl-0 gap-0 overflow-hidden bg-stone-100 dark:bg-stone-950`
*   **Sidebar (Left)**:
    *   Dimensions: `w-[250px]` (Hidden on mobile `hidden lg:flex`)
    *   Style: `bg-white dark:bg-stone-900 border-l border-stone-200 rounded-2xl shadow-xl ring-1 ring-black/5 overflow-hidden`
    *   *Note*: The sidebar is "detached" from the left edge visually but contained within the padded wrapper.
*   **Main Content (Right)**:
    *   Dimensions: `flex-1 ml-3`
    *   Style: `rounded-2xl shadow-xl ring-1 ring-black/5 bg-white dark:bg-stone-950 overflow-hidden relative`
    *   *Note*: Has the same `rounded-2xl` and `shadow-xl` treatment as the sidebar for a "card-like" UI.

### Sticky Header
*   **Placement**: `relative z-30 w-full`
*   **Style**: `bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800`
*   **Padding**: `px-6 py-5`
*   **Elements**:
    *   **Left (Title)**: `text-xl font-normal text-black dark:text-stone-100 tracking-tight leading-tight`
    *   **Center Bezel (Absolute)**:
        *   Container: `absolute inset-0 flex items-center justify-center pointer-events-none`
        *   Pill: `bg-white/50 dark:bg-stone-900/50 backdrop-blur-sm px-4 py-1 rounded-full`
        *   Text: `text-sm font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider`
    *   **Right (Actions)**: Flex container `gap-2`.
        *   *Buttons*: `px-3 py-1.5 border rounded-lg text-xs font-medium transition-all shadow-sm active:scale-95`
        *   *Primary Button (View Document)*: `bg-stone-900 text-white hover:bg-stone-800` (Light mode inverted).

---

## 3. UI Components

### Navigation Sidebar Items
*   **List Container**: `space-y-0.5`
*   **Section Header**: `px-2 mb-2 text-xs font-medium text-stone-500 uppercase tracking-wider`
*   **Tab Button**:
    *   Base: `w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm font-medium transition-colors`
    *   **Active**: `bg-stone-100 dark:bg-stone-800 text-black dark:text-white`
    *   **Inactive**: `text-gray-600 hover:bg-gray-50 hover:text-gray-900`
    *   Icons: `w-4 h-4 text-gray-400` (BookOpen, AlignLeft, Sparkles, etc.)

### Prerequisites / Lecture Content Section
*   **Container**: `max-w-5xl mx-auto px-6 pt-32 pb-24`
*   **Page Title**: `text-5xl md:text-6xl tracking-tighter font-light text-stone-900 dark:text-stone-100 mb-16`
*   **Sub-Description**: `text-base text-stone-700 max-w-3xl leading-relaxed`

#### Concept Unit
*   **Wrapper**: `space-y-24 relative`
*   **Header**: `text-4xl md:text-5xl font-light tracking-tight text-stone-800 dark:text-stone-200 mb-6`
*   **Meta Badge**: `px-3 py-1 bg-stone-100 dark:bg-stone-800 rounded-lg text-xs font-bold uppercase tracking-wider text-stone-500`

#### Video Resource Card
*   **Container**: `bg-white dark:bg-stone-900 rounded-xl border border-gray-300 dark:border-stone-800 shadow-sm overflow-hidden`
*   **Interaction**: `hover:border-gray-400 hover:shadow-md transition-all cursor-pointer group/card`
*   **Header Row**:
    *   Text: `text-xl font-medium text-stone-900 group-hover/card:text-[#FF4A1C] transition-colors`
    *   Reroll Button: `hover:text-stone-600`
*   **Thumbnail**:
    *   Wrapper: `relative aspect-video rounded-lg overflow-hidden bg-black shadow-sm`
    *   Image: `opacity-90 group-hover/card:opacity-100 transition-opacity`
    *   Play Overlay: `w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm`

### Empty State / Generation Screen
*   **Card**: `bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 p-12 text-center`
*   **Icon Circle**: `w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center`
*   **Main Action Button**:
    *   Style: `px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold`
    *   hover: `hover:shadow-xl hover:from-indigo-700 hover:to-purple-700 hover:-translate-y-0.5`

### Chat & Practice Area
*   **Container**: `w-full h-full`
*   **Padding**: `lg:pr-[262px]` (Right padding to balance the layout, though often handled by the container width).
*   **Problem Bank Sidebar** (in Practice view):
    *   Absolute positioning implies overlay or side-docking.
    *   Button: `bg-white border-STONE-200 hover:bg-stone-50`

---

## 4. Implementation Rules

1.  **Typography**: ABSOLUTELY use `font-light` and `tracking-tight` for all H1/H2/H3 headers. This is the signature look of the lecture blueprint.
2.  **Shadows**: Use `shadow-xl` for the main content container to give it depth against the `bg-stone-100` background.
3.  **Borders**: Keep borders subtle (`border-stone-200`). Do not use heavy borders on the main containers; rely on shadows and rounded corners (`rounded-2xl`).
4.  **Badges**: Use the `uppercase tracking-wider` style for all meta labels (Overview, Prerequisites, etc.).
5.  **Interactive Elements**: All cards should have a `hover:border-gray-400` or `hover:shadow-md` transition to indicate interactivity.
