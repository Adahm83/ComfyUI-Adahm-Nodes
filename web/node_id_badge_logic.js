export const NODE_ID_BADGE_MODES = Object.freeze({
    OFF: "All Off",
    SELECTED_ONLY: "On selection",
    ALL: "All On",
});

export function nextNodeIdBadgeMode(mode) {
    switch (mode) {
        case NODE_ID_BADGE_MODES.OFF:
            return NODE_ID_BADGE_MODES.SELECTED_ONLY;
        case NODE_ID_BADGE_MODES.SELECTED_ONLY:
            return NODE_ID_BADGE_MODES.ALL;
        default:
            return NODE_ID_BADGE_MODES.OFF;
    }
}

export function shouldShowNodeId(mode, selected) {
    return mode === NODE_ID_BADGE_MODES.ALL ||
        (mode === NODE_ID_BADGE_MODES.SELECTED_ONLY && selected === true);
}
