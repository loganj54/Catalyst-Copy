/**
 * Calculates the Tailwind rounded corner classes for a grid item
 * to create a merged "blob" effect with smooth internal transitions.
 * 
 * Logic:
 * 1. External corners (no neighbors on either side): rounded-2xl (16px)
 * 2. Join edges (neighbor on one side): rounded-none (Flat)
 * 3. Internal intersections (neighbors on both sides): rounded-lg (8px)
 *    - This creates the "smooth inside corners" (fillets) at card intersections
 *    - And rounds the "concave elbow" of L-shaped backgrounds
 * 
 * @param {number} index Index of the current item
 * @param {number} total Total number of items
 * @param {number} cols Number of columns in the grid
 * @returns {string} Tailwind class string
 */
export const getCornerClasses = (index, total, cols) => {
    if (cols <= 1) {
        // Single column behavior: Round top of first, bottom of last, flat middle
        const isFirst = index === 0;
        const isLast = index === total - 1;
        if (isFirst && isLast) return 'rounded-2xl';
        if (isFirst) return 'rounded-t-2xl rounded-b-none';
        if (isLast) return 'rounded-b-2xl rounded-t-none';
        return 'rounded-none';
    }

    const row = Math.floor(index / cols);
    const col = index % cols;

    const hasLeft = col > 0;
    const hasRight = col < cols - 1 && index + 1 < total;
    const hasTop = row > 0;
    const hasBottom = index + cols < total;

    const classes = [];

    // TL Corner
    if (!hasTop && !hasLeft) classes.push('rounded-tl-2xl');
    else classes.push('rounded-tl-none'); // Smooth fillet will be handled by SVG Gooey Filter

    // TR Corner
    if (!hasTop && !hasRight) classes.push('rounded-tr-2xl');
    else classes.push('rounded-tr-none');

    // BL Corner
    if (!hasBottom && !hasLeft) classes.push('rounded-bl-2xl');
    else classes.push('rounded-bl-none');

    // BR Corner
    if (!hasBottom && !hasRight) classes.push('rounded-br-2xl');
    else classes.push('rounded-br-none');

    return classes.join(' ');
};
