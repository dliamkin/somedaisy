import { clampView, coverScale, cropOf, keptSize, MOST_ZOOM, moveView, PICTURE_SHAPE, shownSize, startView, zoomView } from '../picture-crop';

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
});
