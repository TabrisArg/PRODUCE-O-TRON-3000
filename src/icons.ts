import saveGif from './assets/gifs/save.gif';
import shieldGif from './assets/gifs/shield.gif';
import rocketGif from './assets/gifs/rocket.gif';
import homeGif from './assets/gifs/home.gif';
import costGif from './assets/gifs/cost.gif';
import arquitectGif from './assets/gifs/arquitect.gif';

/**
 * Central registry for application icons/gifs.
 * Replace the placeholder URLs with your final GIF/Image URLs.
 */
export const ICONS = {
  RECALCULATE: "https://placehold.co/16x16/red/red.png",
  MOVE_LEFT: "https://placehold.co/16x16/red/red.png",
  MOVE_RIGHT: "https://placehold.co/16x16/red/red.png",
  COLOR_PICKER: "https://placehold.co/16x16/red/red.png",
  DELETE: "https://placehold.co/16x16/red/red.png",
  DUPLICATE: "https://placehold.co/16x16/red/red.png",
  SUGGEST: "https://placehold.co/16x16/red/red.png",
  ADD_PHASE: "https://placehold.co/16x16/red/red.png",
  ADD_ROLE: "https://placehold.co/16x16/red/red.png",
  SAVE: saveGif,
  EXPORT: "https://placehold.co/16x16/red/red.png",
  IMPORT: "https://placehold.co/16x16/red/red.png",
  CLOSE: "https://placehold.co/16x16/red/red.png",
  UP_ARROW: "https://placehold.co/16x16/red/red.png",
  DOWN_ARROW: "https://placehold.co/16x16/red/red.png",
  FOLDER: "https://placehold.co/16x16/red/red.png",
  SHIELD: shieldGif,
  ROCKET: rocketGif,
  ALERT: "https://placehold.co/16x16/red/red.png",
  HOME: homeGif,
  MONEY: costGif,
  CALENDAR: arquitectGif,
  BRUSH: "https://placehold.co/16x16/red/red.png",
  TRASH: "https://placehold.co/16x16/red/red.png",
  COPY: "https://placehold.co/16x16/red/red.png",
  DISK: "https://placehold.co/16x16/red/red.png",
  HOURGLASS: "https://placehold.co/16x16/red/red.png",
};

export type IconKey = keyof typeof ICONS;
