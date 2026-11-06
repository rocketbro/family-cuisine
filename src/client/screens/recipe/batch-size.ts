// Changing a recipe's batch size. The screen moves at once, and for a planned meal the plan is
// saved behind it. A save that fails puts the screen back on what the plan actually has, unless
// a later tap has already moved on. Retrying a failed save moves the screen again once it lands.
type Run = (write: () => Promise<unknown>) => Promise<boolean>;

export function batchSizeChanger(start: number, show: (size: number) => void, run: Run) {
  let saved = start;
  let latest = 0;
  return async (size: number, save: (() => Promise<unknown>) | null) => {
    const mine = ++latest;
    show(size);
    if (!save) { saved = size; return; }
    const landed = await run(async () => {
      await save();
      saved = size;
      if (mine === latest) show(size);
    });
    if (!landed && mine === latest) show(saved);
  };
}
