/* eslint-disable @typescript-eslint/no-explicit-any */
// Seamless, centered, draggable loop. Port of GSAP's official helper
// https://gsap.com/docs/v3/HelperFunctions/helpers/seamlessLoop (horizontalLoop), trimmed to the options the
// category carousel uses and with destroy() so React can unmount it. Logic kept as upstream on purpose.
import { Draggable, gsap } from '../motion/gsap';

export interface LoopConfig {
  paused?: boolean;
  center?: boolean;
  draggable?: boolean;
  onChange?: (el: HTMLElement, index: number) => void;
}

export interface HorizontalLoop extends gsap.core.Timeline {
  toIndex(index: number, vars?: gsap.TweenVars): any;
  next(vars?: gsap.TweenVars): any;
  previous(vars?: gsap.TweenVars): any;
  current(): number;
  closestIndex(setCurrent?: boolean): number;
  destroy(): void;
}

export function horizontalLoop(items: HTMLElement[], config: LoopConfig = {}): HorizontalLoop {
  const length = items.length;
  const container = items[0].parentNode as HTMLElement;
  const startX = items[0].offsetLeft;
  const times: number[] = [];
  const widths: number[] = [];
  const spaceBefore: number[] = [];
  const xPercents: number[] = [];
  const pixelsPerSecond = 100;
  const snap = gsap.utils.snap(1);
  let lastIndex = 0;
  let curIndex = 0;
  let indexIsDirty = false;
  let totalWidth = 0;
  let timeOffset = 0;
  let timeWrap: (value: number) => number = (value) => value;
  let draggable: Draggable | null = null;
  const proxy = document.createElement('div');

  const tl = gsap.timeline({
    paused: config.paused,
    defaults: { ease: 'none' },
    onUpdate: () => {
      if (!config.onChange) return;
      const i = tl.closestIndex();
      if (lastIndex !== i) {
        lastIndex = i;
        config.onChange(items[i], i);
      }
    },
    onReverseComplete: () => {
      tl.totalTime(tl.rawTime() + tl.duration() * 100);
    },
  }) as HorizontalLoop;

  const scaleX = (el: HTMLElement) => Number(gsap.getProperty(el, 'scaleX'));
  const getTotalWidth = () =>
    items[length - 1].offsetLeft +
    (xPercents[length - 1] / 100) * widths[length - 1] -
    startX +
    spaceBefore[0] +
    items[length - 1].offsetWidth * scaleX(items[length - 1]);

  const populateWidths = () => {
    let b1 = container.getBoundingClientRect();
    items.forEach((el, i) => {
      widths[i] = parseFloat(String(gsap.getProperty(el, 'width', 'px')));
      xPercents[i] = snap(
        (parseFloat(String(gsap.getProperty(el, 'x', 'px'))) / widths[i]) * 100 + Number(gsap.getProperty(el, 'xPercent')),
      );
      const b2 = el.getBoundingClientRect();
      spaceBefore[i] = b2.left - (i ? b1.right : b1.left);
      b1 = b2;
    });
    gsap.set(items, { xPercent: (i: number) => xPercents[i] });
    totalWidth = getTotalWidth();
  };

  const populateOffsets = () => {
    timeOffset = config.center ? (tl.duration() * (container.offsetWidth / 2)) / totalWidth : 0;
    if (config.center) {
      times.forEach((_, i) => {
        times[i] = timeWrap(tl.labels['label' + i] + (tl.duration() * widths[i]) / 2 / totalWidth - timeOffset);
      });
    }
  };

  const getClosest = (values: number[], value: number, wrap: number) => {
    let closest = 1e10;
    let index = 0;
    values.forEach((v, i) => {
      let d = Math.abs(v - value);
      if (d > wrap / 2) d = wrap - d;
      if (d < closest) {
        closest = d;
        index = i;
      }
    });
    return index;
  };

  const populateTimeline = () => {
    tl.clear();
    items.forEach((item, i) => {
      const curX = (xPercents[i] / 100) * widths[i];
      const distanceToStart = item.offsetLeft + curX - startX + spaceBefore[0];
      const distanceToLoop = distanceToStart + widths[i] * scaleX(item);
      tl.to(
        item,
        { xPercent: snap(((curX - distanceToLoop) / widths[i]) * 100), duration: distanceToLoop / pixelsPerSecond },
        0,
      )
        .fromTo(
          item,
          { xPercent: snap(((curX - distanceToLoop + totalWidth) / widths[i]) * 100) },
          {
            xPercent: xPercents[i],
            duration: (curX - distanceToLoop + totalWidth - curX) / pixelsPerSecond,
            immediateRender: false,
          },
          distanceToLoop / pixelsPerSecond,
        )
        .add('label' + i, distanceToStart / pixelsPerSecond);
      times[i] = distanceToStart / pixelsPerSecond;
    });
    timeWrap = gsap.utils.wrap(0, tl.duration());
  };

  const refresh = (deep?: boolean) => {
    const progress = tl.progress();
    tl.progress(0, true);
    populateWidths();
    if (deep) populateTimeline();
    populateOffsets();
    if (deep && draggable) tl.time(times[curIndex], true);
    else tl.progress(progress, true);
  };
  const onResize = () => refresh(true);

  gsap.set(items, { x: 0 });
  populateWidths();
  populateTimeline();
  populateOffsets();
  window.addEventListener('resize', onResize);

  const toIndex = (index: number, vars: gsap.TweenVars = {}) => {
    if (Math.abs(index - curIndex) > length / 2) index += index > curIndex ? -length : length;
    const newIndex = gsap.utils.wrap(0, length, index);
    let time = times[newIndex];
    if (time > tl.time() !== index > curIndex && index !== curIndex) {
      time += tl.duration() * (index > curIndex ? 1 : -1);
    }
    if (time < 0 || time > tl.duration()) vars.modifiers = { time: timeWrap };
    curIndex = newIndex;
    vars.overwrite = true;
    gsap.killTweensOf(proxy);
    return vars.duration === 0 ? tl.time(timeWrap(time)) : tl.tweenTo(time, vars);
  };

  tl.toIndex = toIndex;
  tl.closestIndex = (setCurrent?: boolean) => {
    const index = getClosest(times, tl.time(), tl.duration());
    if (setCurrent) {
      curIndex = index;
      indexIsDirty = false;
    }
    return index;
  };
  tl.current = () => (indexIsDirty ? tl.closestIndex(true) : curIndex);
  tl.next = (vars) => toIndex(tl.current() + 1, vars);
  tl.previous = (vars) => toIndex(tl.current() - 1, vars);
  tl.progress(1, true).progress(0, true);

  if (config.draggable) {
    const wrap = gsap.utils.wrap(0, 1);
    let ratio = 0;
    let startProgress = 0;
    let lastSnap = 0;
    let initChangeX = 0;
    const align = () => tl.progress(wrap(startProgress + (draggable!.startX - draggable!.x) * ratio));
    const syncIndex = () => tl.closestIndex(true);
    draggable = Draggable.create(proxy, {
      trigger: container,
      type: 'x',
      inertia: true,
      overshootTolerance: 0,
      onPressInit() {
        const x = draggable!.x;
        gsap.killTweensOf(tl);
        tl.pause();
        startProgress = tl.progress();
        refresh();
        ratio = 1 / totalWidth;
        initChangeX = startProgress / -ratio - x;
        gsap.set(proxy, { x: startProgress / -ratio });
      },
      onDrag: align,
      onThrowUpdate: align,
      snap(value: number) {
        if (Math.abs(startProgress / -ratio - draggable!.x) < 10) return lastSnap + initChangeX;
        const time = -(value * ratio) * tl.duration();
        const wrappedTime = timeWrap(time);
        const snapTime = times[getClosest(times, wrappedTime, tl.duration())];
        let dif = snapTime - wrappedTime;
        if (Math.abs(dif) > tl.duration() / 2) dif += dif < 0 ? tl.duration() : -tl.duration();
        lastSnap = (time + dif) / tl.duration() / -ratio;
        return lastSnap;
      },
      onRelease() {
        syncIndex();
        if (draggable!.isThrowing) indexIsDirty = true;
      },
      onThrowComplete: syncIndex,
    })[0];
  }

  tl.closestIndex(true);
  lastIndex = curIndex;
  config.onChange?.(items[curIndex], curIndex);

  tl.destroy = () => {
    window.removeEventListener('resize', onResize);
    draggable?.kill();
    tl.kill();
  };
  return tl;
}
