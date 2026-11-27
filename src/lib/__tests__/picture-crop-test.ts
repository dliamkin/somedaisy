import { bandPlace, clampView, coverScale, cropOf, keptSize, middleBand, MOST_ZOOM, moveView, PICTURE_SHAPE, shownSize, startView, zoomView } from '../picture-crop';

// A frame the shape an idea's picture is shown in, as wide as it is on an ordinary phone.
const frame = { width: 360, height: 360 / PICTURE_SHAPE };
// A photo taken holding a phone upright, and one taken holding it sideways.
const upright = { width: 1500, height: 2000 };
const sideways = { width: 2400, height: 1200 };
const wide = { width: 3000, height: 1000 };

describe('a photo behind the frame', () => {
  it('starts just covering the frame, with its middle in the middle', () => {
    expect(coverScale(upright, frame)).toBeCloseTo(0.24);
    expect(shownSize(upright, frame, 1)).toEqual({ width: 360, height: 480 });
    expect(startView(upright, frame)).toEqual({ zoom: 1, x: 0, y: -150 });
    expect(startView(wide, frame)).toEqual({ zoom: 1, x: -90, y: 0 });
  });

  it('shows the middle of an upright photo until it is moved, which is what was kept before', () => {
    expect(cropOf(upright, frame, startView(upright, frame))).toEqual({ originX: 0, originY: 625, width: 1500, height: 750 });
  });

  it('keeps all of a photo that is already the right shape', () => {
    expect(cropOf(sideways, frame, startView(sideways, frame))).toEqual({ originX: 0, originY: 0, width: 2400, height: 1200 });
  });

  it('can be dragged up and down to show the top or the bottom', () => {
    const top = moveView(upright, frame, startView(upright, frame), 0, 1000);
    expect(top.y).toBe(0);
    expect(cropOf(upright, frame, top)).toEqual({ originX: 0, originY: 0, width: 1500, height: 750 });
    const bottom = moveView(upright, frame, startView(upright, frame), 0, -1000);
    expect(bottom.y).toBe(-300);
    expect(cropOf(upright, frame, bottom)).toEqual({ originX: 0, originY: 1250, width: 1500, height: 750 });
  });

  it('cannot be dragged so far that the frame shows past its edge', () => {
    const view = moveView(upright, frame, startView(upright, frame), 500, 0);
    expect(view.x).toBe(0);
    expect(moveView(wide, frame, startView(wide, frame), -5000, 40)).toEqual({ zoom: 1, x: -180, y: 0 });
  });

  it('gets bigger about the middle of the frame, so what was in the middle stays there', () => {
    const start = startView(upright, frame);
    const closer = zoomView(upright, frame, start, 2);
    expect(closer).toEqual({ zoom: 2, x: -180, y: -390 });
    const before = cropOf(upright, frame, start);
    const after = cropOf(upright, frame, closer);
    expect(after.width).toBe(750);
    expect(after.height).toBe(375);
    // To within the one dot that cutting on whole dots can cost.
    expect(Math.abs(after.originX + after.width / 2 - (before.originX + before.width / 2))).toBeLessThanOrEqual(1);
    expect(Math.abs(after.originY + after.height / 2 - (before.originY + before.height / 2))).toBeLessThanOrEqual(1);
  });

  it('gets bigger about the spot between two fingers', () => {
    const corner = zoomView(upright, frame, { zoom: 1, x: 0, y: 0 }, 2, { x: 0, y: 0 });
    expect(corner).toEqual({ zoom: 2, x: 0, y: 0 });
  });

  it('is never smaller than the frame, nor bigger than four times that', () => {
    expect(zoomView(upright, frame, startView(upright, frame), 0.2).zoom).toBe(1);
    expect(zoomView(upright, frame, startView(upright, frame), 99).zoom).toBe(MOST_ZOOM);
    expect(clampView(upright, frame, { zoom: 9, x: 50, y: 50 })).toEqual({ zoom: MOST_ZOOM, x: 0, y: 0 });
  });

  it('pulls a photo back over the frame when it is made smaller near an edge', () => {
    const near = moveView(upright, frame, zoomView(upright, frame, startView(upright, frame), 3), -5000, -5000);
    const back = zoomView(upright, frame, near, 1);
    expect(back.x).toBe(0);
    expect(back.y).toBe(-300);
  });

  it('always cuts out a part that is inside the photo and the shape of the frame', () => {
    for (const photo of [upright, sideways, wide, { width: 333, height: 777 }]) {
      for (const zoom of [1, 1.7, 4]) {
        for (const [dx, dy] of [[0, 0], [-9999, -9999], [9999, 9999], [37, -81]]) {
          const part = cropOf(photo, frame, moveView(photo, frame, zoomView(photo, frame, startView(photo, frame), zoom), dx, dy));
          expect(part.originX).toBeGreaterThanOrEqual(0);
          expect(part.originY).toBeGreaterThanOrEqual(0);
          expect(part.originX + part.width).toBeLessThanOrEqual(photo.width);
          expect(part.originY + part.height).toBeLessThanOrEqual(photo.height);
          expect(Math.abs(part.width / part.height - PICTURE_SHAPE)).toBeLessThan(0.05);
        }
      }
    }
  });
});

describe('the size a cut-out part is kept at', () => {
  it('is no wider than the app keeps any picture', () => {
    expect(keptSize({ width: 2400, height: 1200 })).toEqual({ width: 1280, height: 640 });
  });

  it('is left alone when it is already small enough', () => {
    expect(keptSize({ width: 1280, height: 640 })).toBeNull();
    expect(keptSize({ width: 600, height: 300 })).toBeNull();
  });

  it('can be asked for narrower, as a cover is', () => {
    expect(keptSize({ width: 2400, height: 1600 }, 1200)).toEqual({ width: 1200, height: 800 });
    expect(keptSize({ width: 1200, height: 800 }, 1200)).toBeNull();
  });
});

describe('the band a wider strip shows of the frame', () => {
  it('is across the middle, as tall as the strip is at the frame\'s width', () => {
    // A frame 358 by 240, and a card on Home 358 by 96.
    const band = middleBand({ width: 358, height: 240 }, 358 / 96);
    expect(band?.height).toBeCloseTo(96);
    expect(band?.top).toBeCloseTo(72);
  });

  it('gets smaller with the frame', () => {
    const band = middleBand({ width: 179, height: 120 }, 358 / 96);
    expect(band?.height).toBeCloseTo(48);
    expect(band?.top).toBeCloseTo(36);
  });

  it('is nothing when the strip shows all of the frame, or the sizes are not known', () => {
    expect(middleBand({ width: 300, height: 150 }, 2)).toBeNull();
    expect(middleBand({ width: 300, height: 150 }, 1.5)).toBeNull();
    expect(middleBand({ width: 300, height: 150 }, 0)).toBeNull();
    expect(middleBand({ width: 0, height: 0 }, 3)).toBeNull();
    expect(middleBand({ width: 300, height: 150 }, Number.NaN)).toBeNull();
  });
});

describe('a photo that only has to stay behind a band of the frame', () => {
  // The photo is drawn 300 by 400 behind a frame 300 by 200. The band is the middle 80 of the frame.
  const photo = { width: 1500, height: 2000 };
  const box = { width: 300, height: 200 };
  const band = { top: 60, height: 80 };
  const start = startView(photo, box);

  it('stops at the frame without a band, as it always did', () => {
    expect(moveView(photo, box, start, 0, 9999).y).toBe(0);
    expect(moveView(photo, box, start, 0, -9999).y).toBe(-200);
  });

  it('can be slid until its own top or bottom edge reaches the band, and no further', () => {
    expect(moveView(photo, box, start, 0, 9999, band).y).toBe(60);
    expect(moveView(photo, box, start, 0, -9999, band).y).toBe(60 + 80 - 400);
    expect(clampView(photo, box, { zoom: 1, x: 0, y: 500 }, band).y).toBe(60);
  });

  it('still cannot be slid sideways off the frame', () => {
    const big = zoomView(photo, box, start, 2, undefined, band);
    expect(moveView(photo, box, big, 9999, 0, band).x).toBe(0);
    expect(moveView(photo, box, big, -9999, 0, band).x).toBe(300 - 600);
  });

  it('keeps the same part as without a band while the photo covers the whole frame', () => {
    for (const zoom of [1, 2.5]) {
      for (const dy of [0, -40, 70]) {
        const view = moveView(photo, box, zoomView(photo, box, start, zoom), 0, dy);
        expect(cropOf(photo, box, view, band)).toEqual(cropOf(photo, box, view));
        expect(bandPlace(photo, box, view, band)).toBe(0.5);
      }
    }
  });

  it('keeps only what there is of the photo when it is slid past the bottom of the frame', () => {
    // The photo's bottom edge is at the band's: 140 of the frame's 200 has photo behind it.
    const low = moveView(photo, box, start, 0, -9999, band);
    const part = cropOf(photo, box, low, band);
    expect(part).toEqual({ originX: 0, originY: 1300, width: 1500, height: 700 });
    expect(part.originY + part.height).toBe(photo.height);
    // The band is the bottom of what is kept.
    expect(bandPlace(photo, box, low, band)).toBe(1);
  });

  it('and past the top', () => {
    const high = moveView(photo, box, start, 0, 9999, band);
    expect(cropOf(photo, box, high, band)).toEqual({ originX: 0, originY: 0, width: 1500, height: 700 });
    expect(bandPlace(photo, box, high, band)).toBe(0);
  });

  it('says where the band is in between, as a share of what a strip leaves out', () => {
    // 30 past the bottom of the frame: 170 is kept, the band starts 60 down it, and a strip 80 tall leaves out 90.
    const view = clampView(photo, box, { zoom: 1, x: 0, y: -230 }, band);
    expect(cropOf(photo, box, view, band).height).toBe(850);
    expect(bandPlace(photo, box, view, band)).toBeCloseTo(60 / 90, 3);
  });

  it('is the middle when the band is all that is kept', () => {
    // A photo drawn exactly as tall as the band, at its biggest... which cannot happen at zoom 1, so a wide one made to fit.
    const strip = { width: 3000, height: 800 };
    const tight = { width: 300, height: 80 };
    expect(bandPlace(strip, tight, startView(strip, tight), { top: 0, height: 80 })).toBe(0.5);
  });

  it('keeps to the band when the photo is made bigger or smaller', () => {
    const low = moveView(photo, box, start, 0, -9999, band);
    for (const zoom of [1, 1.6, 4]) {
      const view = zoomView(photo, box, low, zoom, undefined, band);
      const shown = shownSize(photo, box, view.zoom);
      expect(view.y).toBeLessThanOrEqual(band.top);
      expect(view.y + shown.height).toBeGreaterThanOrEqual(band.top + band.height - 1e-9);
    }
  });

  it('always cuts out a part that is inside the photo', () => {
    for (const zoom of [1, 1.7, 4]) {
      for (const [dx, dy] of [[0, 0], [-9999, -9999], [9999, 9999], [37, -181], [-12, 155]]) {
        const view = moveView(photo, box, zoomView(photo, box, start, zoom, undefined, band), dx, dy, band);
        const part = cropOf(photo, box, view, band);
        expect(part.originX).toBeGreaterThanOrEqual(0);
        expect(part.originY).toBeGreaterThanOrEqual(0);
        expect(part.originX + part.width).toBeLessThanOrEqual(photo.width);
        expect(part.originY + part.height).toBeLessThanOrEqual(photo.height);
        const place = bandPlace(photo, box, view, band);
        expect(place).toBeGreaterThanOrEqual(0);
        expect(place).toBeLessThanOrEqual(1);
      }
    }
  });
});
