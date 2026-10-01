import { StickerCoin, StickerStar } from '../svg/stickers';
import { Marquee } from '../ui/marquee';

type Tile = { text: string; italic: boolean; tone: 'paper' | 'ember' | 'blue' | 'sunburst' | 'mint' | 'lilac' };

const ROW_1: Tile[] = [
  { text: 'Mượn', italic: false, tone: 'paper' },
  { text: 'Mua', italic: true, tone: 'ember' },
  { text: 'Giao', italic: false, tone: 'blue' },
  { text: 'Đọc', italic: true, tone: 'paper' },
];

const ROW_2: Tile[] = [
  { text: 'Open Boox', italic: false, tone: 'blue' },
  { text: 'Trả & mượn tiếp', italic: true, tone: 'sunburst' },
  { text: 'Open Boox', italic: false, tone: 'mint' },
  { text: 'Trả & mượn tiếp', italic: true, tone: 'lilac' },
];

function Tiles({ tiles, sticker }: { tiles: Tile[]; sticker: 'coin' | 'star' }) {
  return tiles.map((tile, i) => (
    <span key={i} className={`obx-tile obx-tile--${tile.tone}`}>
      <span className={`obx-display obx-tile__text${tile.italic ? ' obx-italic' : ''}`}>{tile.text}</span>
      {i === 1 && (sticker === 'coin' ? <StickerCoin /> : <StickerStar />)}
    </span>
  ));
}

// Section 7 [SM §4 #7]: two rows of display tiles on the black frame, running in opposite directions.
export function WordMarquee() {
  return (
    <section className="obx-sheet obx-sheet--frame obx-words" aria-label="Mượn, mua, giao, đọc">
      <Marquee speed={15} repeat={2}>
        <Tiles tiles={ROW_1} sticker="coin" />
      </Marquee>
      <Marquee speed={20} reverse repeat={2}>
        <Tiles tiles={ROW_2} sticker="star" />
      </Marquee>
    </section>
  );
}
