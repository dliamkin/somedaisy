import { gather, GATHER_MS } from '../live';

describe('gather', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('does the work once for a burst of asks', () => {
    const work = jest.fn();
    const g = gather(work);
    g.ask();
    g.ask();
    g.ask();
    expect(work).not.toHaveBeenCalled();
    jest.advanceTimersByTime(GATHER_MS);
    expect(work).toHaveBeenCalledTimes(1);
  });

  it('does not keep putting the work off while asks keep coming', () => {
    const work = jest.fn();
    const g = gather(work, 200);
    g.ask();
    jest.advanceTimersByTime(150);
    g.ask();
    jest.advanceTimersByTime(50);
    expect(work).toHaveBeenCalledTimes(1);
  });

  it('runs again for an ask that comes after the work was done', () => {
    const work = jest.fn();
    const g = gather(work, 200);
    g.ask();
    jest.advanceTimersByTime(200);
    g.ask();
    jest.advanceTimersByTime(200);
    expect(work).toHaveBeenCalledTimes(2);
  });

  it('an ask made while the work runs is not lost', () => {
    const g = gather(() => {
      calls += 1;
      if (calls === 1) g.ask();
    }, 100);
    let calls = 0;
    g.ask();
    jest.advanceTimersByTime(100);
    expect(calls).toBe(1);
    jest.advanceTimersByTime(100);
    expect(calls).toBe(2);
  });

  it('cancel drops a run that is waiting', () => {
    const work = jest.fn();
    const g = gather(work);
    g.ask();
    g.cancel();
    jest.advanceTimersByTime(GATHER_MS * 4);
    expect(work).not.toHaveBeenCalled();
    // And it can be used again afterwards.
    g.ask();
    jest.advanceTimersByTime(GATHER_MS);
    expect(work).toHaveBeenCalledTimes(1);
  });
});
