
/* CHECK IF EXPLAINER SHOULD BE VISIBLE */
// Whenever currentUnits changes (tab switch), check if the open explainers belong to a visible unit
const { explainers, updateExplainer } = useUiState();

useEffect(() => {
    if (!explainers) return;

    explainers.forEach(explainer => {
        if (explainer.isOpen && explainer.unitId) {
            // Check if the explainer's unitId is in the currently visible units
            const isVisible = currentUnits.some(u => u.unit_id === explainer.unitId);

            // Update isHidden state directly without closing/resetting data
            // avoiding triggers if state is already correct
            if (isVisible && explainer.isHidden) {
                updateExplainer(explainer.id, { isHidden: false });
            } else if (!isVisible && !explainer.isHidden) {
                updateExplainer(explainer.id, { isHidden: true });
            }
        }
    });
}, [currentUnits, explainers, updateExplainer]);
