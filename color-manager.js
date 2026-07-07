import { PLAYER_COLORS } from './config.js';

export const ColorManager = {
    selectedIndices: { p1: 0, p2: 0 },

    getColor(playerKey) {
        return PLAYER_COLORS[this.selectedIndices[playerKey]];
    },

    nextColor(playerKey) {
        let idx = this.selectedIndices[playerKey];
        idx = (idx + 1) % PLAYER_COLORS.length;
        this.selectedIndices[playerKey] = idx;
        return PLAYER_COLORS[idx];
    }
};