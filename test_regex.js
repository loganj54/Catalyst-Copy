
const text = "The ** Finite Difference Method ** discretizes differential equations...";

// Regex from ExplainerOverlay.jsx line 1083
// cleanText = cleanText.replace(/\*\*\s*([^*]+?)\s*\*\*/g, '**$1**');

function clean(input) {
    let cleanText = input;
    cleanText = cleanText.replace(/\*\*\s*([^*]+?)\s*\*\*/g, '**$1**');
    return cleanText;
}

const cleaned = clean(text);
console.log("Original:", text);
console.log("Cleaned: ", cleaned);

if (cleaned === "The **Finite Difference Method** discretizes differential equations...") {
    console.log("PASS: Spaces removed correctly.");
} else {
    console.log("FAIL: Spaces NOT removed.");
}

const text2 = "** In comparison with FE and FV:**";
console.log("Cleaned 2:", clean(text2));
